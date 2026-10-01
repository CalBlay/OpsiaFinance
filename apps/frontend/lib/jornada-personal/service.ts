import { crearCarregaFitxer } from "@/lib/carrega-fitxer";
import { revalidateConsultesDades } from "@/lib/consultes-cache";
import { type MapeigRow, resolMapeigPerFila } from "@/lib/cost-personal-centre/service";
import { db } from "@/lib/db";
import { periodeDesDelNomFitxerJornada } from "@/lib/jornada-personal/nom-fitxer";
import { parseJornadaPersonal } from "@/lib/jornada-personal/parser";
import { MESOS_LLARGS } from "@/lib/periodes";
import { revalidatePath } from "next/cache";

export type ImportJornadaResult = {
  ok: boolean;
  missatge: string;
  errors?: string[];
  avisos?: string[];
};

export type RegistreJornadaDTO = {
  id: string;
  centreCodi: string;
  centreNom: string;
  dept: string;
  nombrePersones: number;
  horesSetmanals: number;
  periodNom: string;
  periodAny: number;
  periodMes: number;
};

function refresh() {
  revalidateConsultesDades();
  revalidatePath("/dades/jornada-personal");
  revalidatePath("/consultes/cost-personal");
  revalidatePath("/rrhh");
  revalidatePath("/rrhh/centre");
  revalidatePath("/rrhh/departament");
  revalidatePath("/rrhh/comparativa");
}

async function upsertPeriode(any: number, mes: number): Promise<string> {
  const period = await db.period.upsert({
    where: { any_mes: { any, mes } },
    update: {},
    create: { any, mes, nom: `${MESOS_LLARGS[mes - 1]} ${any}` },
  });
  return period.id;
}

/**
 * Importa l'Excel de jornada: agrega persones i hores setmanals per centre×dept
 * via el mapeig de Cost personal (columna C).
 * Substitueix les dades del període.
 */
export async function importarJornadaPersonalDesDeBuffer(
  buffer: Buffer,
  opts: {
    any: number;
    mes: number;
    nomFitxer: string;
    mida?: number;
    creatPer: string;
  }
): Promise<ImportJornadaResult> {
  const parsed = parseJornadaPersonal(buffer);
  if (!parsed.files.length) {
    return {
      ok: false,
      missatge: parsed.errors[0] ?? "Cap fila importable.",
      errors: parsed.errors,
      avisos: parsed.avisos,
    };
  }

  const mapeigsDb = await db.mapeigCodiCostPersonal.findMany({
    where: { isActive: true },
    select: {
      id: true,
      codi: true,
      text: true,
      centreId: true,
      departamentId: true,
      departamentSalarial: true,
      isActive: true,
    },
  });
  if (!mapeigsDb.length) {
    return {
      ok: false,
      missatge: "No hi ha mapeigs de codi → centre. Configura'ls a Configuració → Cost personal.",
    };
  }

  const byCodi = new Map<string, MapeigRow>(
    mapeigsDb.map((m) => [
      m.codi.trim(),
      {
        id: m.id,
        codi: m.codi,
        text: m.text,
        centreId: m.centreId,
        departamentId: m.departamentId,
        departamentSalarial: m.departamentSalarial,
        isActive: m.isActive,
      },
    ])
  );

  type Agg = {
    centreId: string;
    departamentId: string | null;
    nombrePersones: number;
    horesSetmanals: number;
  };
  const agregats = new Map<string, Agg>();
  const avisSense = new Set<string>();
  let mapejats = 0;

  for (const f of parsed.files) {
    const hit = resolMapeigPerFila(f.codi, f.codi, byCodi);
    if (!hit) {
      if (avisSense.size < 12) avisSense.add(f.codi);
      continue;
    }
    mapejats++;
    const key = `${hit.mapeig.centreId}::${hit.mapeig.departamentId ?? "_"}`;
    const prev = agregats.get(key);
    if (prev) {
      prev.nombrePersones += 1;
      prev.horesSetmanals += f.horesSetmanals;
    } else {
      agregats.set(key, {
        centreId: hit.mapeig.centreId,
        departamentId: hit.mapeig.departamentId,
        nombrePersones: 1,
        horesSetmanals: f.horesSetmanals,
      });
    }
  }

  const finals = [...agregats.values()];

  if (!finals.length) {
    return {
      ok: false,
      missatge: "Cap fila mapejada. Revisa el mapeig de codis a Cost personal.",
      errors: avisSense.size
        ? [`Sense mapeig (exemples): ${[...avisSense].join(", ")}.`]
        : undefined,
      avisos: parsed.avisos,
    };
  }

  const periodId = await upsertPeriode(opts.any, opts.mes);

  // Substitueix tot el període
  await db.plantillaJornada.deleteMany({ where: { periodId } });

  const carregaId = await crearCarregaFitxer({
    tipus: "PLANTILLA_JORNADA",
    nomFitxer: opts.nomFitxer,
    mida: opts.mida ?? null,
    periodId,
    resum: `${finals.length} centres/depts · ${finals.reduce((s, a) => s + a.nombrePersones, 0)} persones · ${finals.reduce((s, a) => s + a.horesSetmanals, 0).toFixed(1)} h/setm.`,
    creatPer: opts.creatPer,
  });

  await db.plantillaJornada.createMany({
    data: finals.map((a) => ({
      periodId,
      centreId: a.centreId,
      departamentId: a.departamentId,
      nombrePersones: a.nombrePersones,
      horesSetmanals: a.horesSetmanals,
      carregaId,
    })),
  });

  refresh();

  const avisos = [...(parsed.avisos ?? [])];
  if (avisSense.size) {
    avisos.push(`Sense mapeig (exemples): ${[...avisSense].join(", ")}.`);
  }
  const nPers = finals.reduce((s, a) => s + a.nombrePersones, 0);
  const nHores = finals.reduce((s, a) => s + a.horesSetmanals, 0);

  return {
    ok: true,
    missatge: `${MESOS_LLARGS[opts.mes - 1]} ${opts.any}: ${nPers} persones · ${nHores.toFixed(1)} h/setmana · ${finals.length} agrupacions (${mapejats}/${parsed.files.length} files mapejades).`,
    avisos: avisos.length ? avisos : undefined,
  };
}

export async function llistaJornadaPersonal(
  any: number | null,
  mes: number | null
): Promise<RegistreJornadaDTO[]> {
  const rows = await db.plantillaJornada.findMany({
    where: {
      ...(any != null
        ? { period: { any, ...(mes != null && mes >= 1 && mes <= 12 ? { mes } : {}) } }
        : {}),
    },
    select: {
      id: true,
      nombrePersones: true,
      horesSetmanals: true,
      centre: { select: { codi: true, nom: true } },
      departament: { select: { codi: true, nom: true } },
      period: { select: { nom: true, any: true, mes: true } },
    },
    orderBy: [
      { period: { any: "desc" } },
      { period: { mes: "desc" } },
      { centre: { codi: "asc" } },
    ],
  });

  return rows.map((r) => ({
    id: r.id,
    centreCodi: r.centre.codi,
    centreNom: r.centre.nom,
    dept: r.departament ? `${r.departament.codi} · ${r.departament.nom}` : "—",
    nombrePersones: r.nombrePersones,
    horesSetmanals: Number(r.horesSetmanals),
    periodNom: r.period.nom,
    periodAny: r.period.any,
    periodMes: r.period.mes,
  }));
}

export async function getAnysAmbJornadaPersonal(): Promise<number[]> {
  const rows = await db.period.findMany({
    where: { plantillesJornada: { some: {} } },
    select: { any: true },
    distinct: ["any"],
  });
  return rows.map((r) => r.any).sort((a, b) => b - a);
}

export { periodeDesDelNomFitxerJornada };
