import { db } from "@/lib/db";
import { inferDepartamentSalarial } from "@/lib/traspass-personal/departament";
import { parseExcelMapeigCentres } from "@/lib/traspass-personal/importar-mapeig";
import {
  type MapeigCentre,
  type MovimentTraspassCalculat,
  calcularTraspassosPersonal,
} from "@/lib/traspass-personal/motor";
import { periodeDesDelNomFitxerHores } from "@/lib/traspass-personal/nom-fitxer";
import { parseExcelHoresTreball } from "@/lib/traspass-personal/parser";

const MESOS: Record<number, string> = {
  1: "Gener",
  2: "Febrer",
  3: "Març",
  4: "Abril",
  5: "Maig",
  6: "Juny",
  7: "Juliol",
  8: "Agost",
  9: "Setembre",
  10: "Octubre",
  11: "Novembre",
  12: "Desembre",
};

export async function ensureConfigTraspassPersonal(): Promise<number> {
  const cfg = await db.configTraspassPersonal.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", tarifaHora: 18 },
  });
  return Number(cfg.tarifaHora);
}

export async function getTarifaHoraTraspass(): Promise<number> {
  const cfg = await db.configTraspassPersonal.findUnique({ where: { id: "default" } });
  return cfg ? Number(cfg.tarifaHora) : 18;
}

/**
 * Omple departament als mapeigs existents inferint-lo del text
 * (només quan el text ho deixa clar). Font de veritat: columna persistida.
 */
export async function backfillDepartamentsMapeig(): Promise<number> {
  const rows = await db.mapeigTextCentreTreball.findMany({
    select: { id: true, text: true, departament: true },
  });
  let updated = 0;
  for (const r of rows) {
    const inferred = inferDepartamentSalarial(r.text);
    if (!inferred || inferred === r.departament) continue;
    await db.mapeigTextCentreTreball.update({
      where: { id: r.id },
      data: { departament: inferred },
    });
    updated++;
  }
  return updated;
}

async function carregarMapeigs(): Promise<MapeigCentre[]> {
  const raw = await db.mapeigTextCentreTreball.findMany({
    where: { isActive: true },
    include: { centre: { select: { id: true, codi: true, nom: true } } },
    orderBy: { ordre: "asc" },
  });

  return raw.map((m) => ({
    text: m.text,
    centreId: m.centre.id,
    centreCodi: m.centre.codi,
    centreNom: m.centre.nom,
    departament: m.departament,
  }));
}

async function assegurarPeriode(mes: number, any: number) {
  return db.period.upsert({
    where: { any_mes: { any, mes } },
    update: {},
    create: { any, mes, nom: `${MESOS[mes]} ${any}` },
  });
}

export async function calcularExecucioTraspassPersonal(
  periodId: string,
  buffer: Buffer,
  nomFitxer: string,
  importacioId?: string
): Promise<{
  moviments: MovimentTraspassCalculat[];
  alertes: ReturnType<typeof calcularTraspassosPersonal>["alertes"];
  tarifaHora: number;
}> {
  const tarifaHora = await getTarifaHoraTraspass();
  await backfillDepartamentsMapeig();
  const mapeigs = await carregarMapeigs();
  const { files } = parseExcelHoresTreball(buffer);
  const resultat = calcularTraspassosPersonal(files, mapeigs, tarifaHora);

  const existent = await db.execucioTraspassPersonal.findUnique({
    where: { periodId },
    select: { id: true, estat: true, foraCentreSnapshotJson: true },
  });
  if (existent?.estat === "CONFIRMAT") {
    const { parseForaCentreSnapshot, restaurarForaCentreDesDeSnapshot } = await import(
      "./fora-centre"
    );
    await restaurarForaCentreDesDeSnapshot(
      periodId,
      parseForaCentreSnapshot(existent.foraCentreSnapshotJson)
    );
  }

  const execucio = await db.execucioTraspassPersonal.upsert({
    where: { periodId },
    update: {
      estat: "BORRADOR",
      importacioId: importacioId ?? null,
      nomFitxer,
      calculatAt: new Date(),
      confirmatAt: null,
      confirmatPer: null,
      foraCentreSnapshotJson: null,
      alertesJson: resultat.alertes.length ? JSON.stringify(resultat.alertes) : null,
    },
    create: {
      periodId,
      importacioId: importacioId ?? null,
      nomFitxer,
      calculatAt: new Date(),
      alertesJson: resultat.alertes.length ? JSON.stringify(resultat.alertes) : null,
    },
  });

  await db.movimentTraspassPersonal.deleteMany({ where: { execucioId: execucio.id } });

  if (resultat.moviments.length) {
    await db.movimentTraspassPersonal.createMany({
      data: resultat.moviments.map((m) => ({
        execucioId: execucio.id,
        centreOrigenId: m.centreOrigenId,
        centreDestiId: m.centreDestiId,
        departament: m.departament,
        minuts: m.minuts,
        hores: m.hores,
        tarifaHora: m.tarifaHora,
        import_: m.import_,
        concepteNode: m.concepteNode,
      })),
    });
  }

  return {
    moviments: resultat.moviments,
    alertes: resultat.alertes,
    tarifaHora,
  };
}

export async function processarFitxerHoresTreball(
  buffer: Buffer,
  nomFitxer: string,
  userId: string
): Promise<{ periodId: string; execucioId: string; missatge: string }> {
  const periode = periodeDesDelNomFitxerHores(nomFitxer);
  if (!periode) {
    throw new Error(
      "No s'ha pogut extreure el període del nom del fitxer. Usa «Hores Centres de Treball mm_aaaa.xlsx»."
    );
  }

  const period = await assegurarPeriode(periode.mes, periode.any);

  let format = await db.formatInforme.findFirst({
    where: { tipusInforme: "HORES_CENTRES_TREBALL" },
  });
  if (!format) {
    format = await db.formatInforme.create({
      data: {
        nom: "Hores Centres de Treball",
        tipusInforme: "HORES_CENTRES_TREBALL",
        descripcio: "Traspassos de personal entre centres",
      },
    });
  }

  const importacio = await db.importacio.create({
    data: {
      nomFitxer,
      estat: "CLASSIFICAT",
      formatInformeId: format.id,
      periodId: period.id,
      creatPer: userId,
      notes: "Import hores per traspassos de personal",
    },
  });

  await calcularExecucioTraspassPersonal(period.id, buffer, nomFitxer, importacio.id);

  const execucio = await db.execucioTraspassPersonal.findUniqueOrThrow({
    where: { periodId: period.id },
    select: { id: true },
  });

  return {
    periodId: period.id,
    execucioId: execucio.id,
    missatge: `Hores processades per ${period.nom}. Revisa els traspassos abans de confirmar.`,
  };
}

export async function confirmarExecucioTraspassPersonal(
  execucioId: string,
  userId: string
): Promise<{ foraCentreSnapshot: import("./fora-centre").ForaCentreSnapshot }> {
  const execucio = await db.execucioTraspassPersonal.findUnique({
    where: { id: execucioId },
    include: {
      moviments: {
        include: { centreDesti: { select: { codi: true, nom: true } } },
      },
    },
  });
  if (!execucio) throw new Error("Execució no trobada.");
  if (execucio.estat === "CONFIRMAT") {
    const { parseForaCentreSnapshot } = await import("./fora-centre");
    return {
      foraCentreSnapshot: parseForaCentreSnapshot(execucio.foraCentreSnapshotJson) ?? {
        canvis: [],
      },
    };
  }

  const { aplicarForaCentreDesDeTraspass } = await import("./fora-centre");
  const foraCentreSnapshot = await aplicarForaCentreDesDeTraspass(
    execucio.periodId,
    execucio.moviments
  );

  await db.execucioTraspassPersonal.update({
    where: { id: execucioId },
    data: {
      estat: "CONFIRMAT",
      confirmatAt: new Date(),
      confirmatPer: userId,
      foraCentreSnapshotJson: JSON.stringify(foraCentreSnapshot),
    },
  });

  // Important: el repartiment Central → LN s'ha de recalcular amb els traspassos
  // d'hores confirmats per evitar doble comptatge a la vista Gestió.
  const { calcularExecucioRepartiment, confirmarExecucioRepartiment } = await import(
    "@/lib/repartiment/service"
  );
  const execRepart = await calcularExecucioRepartiment(execucio.periodId);
  if (execRepart) {
    await confirmarExecucioRepartiment(execRepart.id, userId);
  }

  return { foraCentreSnapshot };
}

/** Torna a esborrany i restaura foraCentre als valors anteriors a la confirmació. */
export async function tornarEsborranyExecucioTraspassPersonal(execucioId: string): Promise<void> {
  const execucio = await db.execucioTraspassPersonal.findUnique({
    where: { id: execucioId },
    select: { id: true, periodId: true, estat: true, foraCentreSnapshotJson: true },
  });
  if (!execucio) throw new Error("Execució no trobada.");

  if (execucio.estat === "CONFIRMAT") {
    const { parseForaCentreSnapshot, restaurarForaCentreDesDeSnapshot } = await import(
      "./fora-centre"
    );
    await restaurarForaCentreDesDeSnapshot(
      execucio.periodId,
      parseForaCentreSnapshot(execucio.foraCentreSnapshotJson)
    );
  }

  await db.execucioTraspassPersonal.update({
    where: { id: execucioId },
    data: {
      estat: "BORRADOR",
      confirmatAt: null,
      confirmatPer: null,
      // Mantinim l'snapshot per historial visual fins a una nova confirmació
    },
  });
}

export async function getExecucioTraspassPerPeriode(periodId: string) {
  return db.execucioTraspassPersonal.findUnique({
    where: { periodId },
    include: {
      period: { select: { id: true, nom: true, any: true, mes: true } },
      moviments: {
        orderBy: [
          { centreOrigen: { nom: "asc" } },
          { centreDesti: { nom: "asc" } },
          { departament: "asc" },
        ],
        include: {
          centreOrigen: { select: { id: true, codi: true, nom: true } },
          centreDesti: { select: { id: true, codi: true, nom: true } },
        },
      },
    },
  });
}

async function resoldreCentrePerCodi(
  codi: string,
  nomHint?: string
): Promise<{ id: string } | null> {
  const candidats = await db.centre.findMany({
    where: { codi: codi.toUpperCase(), isActive: true },
    select: { id: true, nom: true },
    orderBy: { ordre: "asc" },
  });
  if (!candidats.length) return null;
  if (candidats.length === 1) return candidats[0];

  if (nomHint) {
    const hint = nomHint.trim().toUpperCase();
    const perNom = candidats.find((c) => c.nom.toUpperCase() === hint);
    if (perNom) return perNom;
  }
  return candidats[0];
}

/** Importa o actualitza el mapeig (A=text, B=codi, C=nom, D=SALA|CUINA opcional). */
export async function importarMapeigCentresDesDeBuffer(
  buffer: Buffer,
  substituirTot = false
): Promise<{ importats: number; errors: string[] }> {
  const { files } = parseExcelMapeigCentres(buffer);
  if (!files.length) {
    throw new Error("No s'han trobat files vàlides a l'excel de mapeig.");
  }

  if (substituirTot) {
    await db.mapeigTextCentreTreball.deleteMany({});
  }

  const errors: string[] = [];
  let importats = 0;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (!f.departament) {
      errors.push(
        `Fila ${i + 1}: no s'ha pogut determinar SALA/CUINA per «${f.text}» (col. D o text).`
      );
      continue;
    }
    const centre = await resoldreCentrePerCodi(f.codiCentre, f.nomCentre);
    if (!centre) {
      errors.push(`Fila ${i + 1}: codi «${f.codiCentre}» no trobat a dimensions.`);
      continue;
    }

    await db.mapeigTextCentreTreball.upsert({
      where: { text: f.text },
      update: {
        centreId: centre.id,
        departament: f.departament,
        isActive: true,
      },
      create: {
        text: f.text,
        centreId: centre.id,
        departament: f.departament,
        ordre: i,
      },
    });
    importats++;
  }

  return { importats, errors };
}
