import { db } from "@/lib/db";
import { CODI_LN_CENTRAL, NODE_COST_GESTIO, NODE_COST_SALARIAL } from "@/lib/repartiment/nodes";
import {
  GRUPS_REPARTIMENT,
  type NormaSeed,
  normesConfirmades,
} from "@/lib/repartiment/normes-seed";
import { SUPORT_PERSONAL_PRECUINATS_CENTRES } from "@/lib/repartiment/personal-precuinats";

async function getLnByCodi(): Promise<Map<string, string>> {
  return new Map(
    (await db.liniaNegoci.findMany({ select: { id: true, codi: true } })).map((l) => [l.codi, l.id])
  );
}

export async function syncGrupsRepartiment(): Promise<void> {
  const lnByCodi = await getLnByCodi();

  for (const g of GRUPS_REPARTIMENT) {
    await db.repartimentGrup.upsert({
      where: { codi: g.codi },
      update: { nom: g.nom },
      create: { codi: g.codi, nom: g.nom, ordre: 0 },
    });
    const grup = await db.repartimentGrup.findUnique({ where: { codi: g.codi } });
    if (!grup) continue;
    const membresActius: string[] = [];
    let ordre = 0;
    for (const codiLn of g.membres) {
      const lnId = lnByCodi.get(codiLn);
      if (!lnId) continue;
      membresActius.push(lnId);
      await db.repartimentGrupMembre.upsert({
        where: { grupId_liniaNegociId: { grupId: grup.id, liniaNegociId: lnId } },
        update: { ordre: ordre++ },
        create: { grupId: grup.id, liniaNegociId: lnId, ordre: ordre++ },
      });
    }
    await db.repartimentGrupMembre.deleteMany({
      where: {
        grupId: grup.id,
        liniaNegociId: { notIn: membresActius },
      },
    });
  }
}

/** Converteix la regla històrica de Precuinats en quatre normes editables per centre. */
export async function syncNormaPersonalPrecuinats(): Promise<void> {
  const [lnPrecuinats, lnCentral] = await Promise.all([
    db.liniaNegoci.findUnique({
      where: { codi: "LN00004" },
      select: { id: true },
    }),
    db.liniaNegoci.findUnique({
      where: { codi: CODI_LN_CENTRAL },
      select: { id: true },
    }),
  ]);
  if (!lnPrecuinats || !lnCentral) return;

  const normes = await db.normaRepartiment.findMany({
    where: {
      liniaNegociDestiId: lnPrecuinats.id,
      concepteNode: NODE_COST_SALARIAL,
      tipus: "REPARTIMENT_PROPORCIONAL",
    },
    select: { id: true },
  });

  if (normes.length) {
    await db.normaRepartiment.deleteMany({
      where: { id: { in: normes.map((norma) => norma.id) } },
    });
  }

  const existents = await db.normaRepartiment.findMany({
    where: {
      liniaNegociDestiId: lnPrecuinats.id,
      concepteNode: NODE_COST_SALARIAL,
      nom: { in: SUPORT_PERSONAL_PRECUINATS_CENTRES.map((regla) => regla.nomNorma) },
    },
    select: { id: true, nom: true },
  });
  const existentByNom = new Map(existents.map((norma) => [norma.nom, norma.id]));

  for (const regla of SUPORT_PERSONAL_PRECUINATS_CENTRES) {
    const id = existentByNom.get(regla.nomNorma);
    if (id) {
      await db.normaRepartiment.update({
        where: { id },
        data: {
          tipus: "PERCENT_POOL_CENTRAL",
          grupId: null,
          liniaNegociOrigenId: lnCentral.id,
          concepteNode: NODE_COST_SALARIAL,
          ordre: regla.ordre,
        },
      });
      continue;
    }
    await db.normaRepartiment.create({
      data: {
        nom: regla.nomNorma,
        tipus: "PERCENT_POOL_CENTRAL",
        ordre: regla.ordre,
        liniaNegociDestiId: lnPrecuinats.id,
        liniaNegociOrigenId: lnCentral.id,
        concepteNode: NODE_COST_SALARIAL,
        valorPercent: regla.percentDefecte,
      },
    });
  }

  await db.normaRepartiment.updateMany({
    where: {
      liniaNegociDestiId: lnPrecuinats.id,
      concepteNode: NODE_COST_GESTIO,
      tipus: "PERCENT_POOL_CENTRAL",
    },
    data: { ordre: 455 },
  });
}

async function crearNormes(
  normes: NormaSeed[],
  lnByCodi: Map<string, string>,
  centralId: string
): Promise<number> {
  const grupsByCodi = new Map((await db.repartimentGrup.findMany()).map((g) => [g.codi, g.id]));

  let creats = 0;
  for (const n of normes) {
    const destId = lnByCodi.get(n.destCodi);
    if (!destId) continue;
    await db.normaRepartiment.create({
      data: {
        nom: n.nom,
        tipus: n.tipus,
        ordre: n.ordre,
        liniaNegociDestiId: destId,
        liniaNegociOrigenId: centralId,
        concepteNode: n.concepteNode,
        grupId: n.grupCodi ? grupsByCodi.get(n.grupCodi) : null,
        valorPercent: n.valorPercent ?? null,
        valorImport: n.valorImport ?? null,
      },
    });
    creats++;
  }
  return creats;
}

/** Esborra normes i execucions (moviments + pesos). Conserva grups. */
export async function resetNormesRepartiment(): Promise<{ ok: boolean; missatge: string }> {
  const lnByCodi = await getLnByCodi();
  const centralId = lnByCodi.get(CODI_LN_CENTRAL);
  if (!centralId) {
    return { ok: false, missatge: "Cal tenir LN00000 a l'arbre de dimensions." };
  }

  await db.execucioRepartiment.deleteMany();
  const esborrades = await db.normaRepartiment.deleteMany();
  await syncGrupsRepartiment();

  return {
    ok: true,
    missatge: `${esborrades.count} normes esborrades. Execucions mensuals eliminades. Grups sincronitzats.`,
  };
}

function clauNormaSeed(n: NormaSeed): string {
  return `${n.destCodi}:${n.concepteNode}:${n.tipus}:${n.valorPercent ?? ""}:${n.valorImport ?? ""}:${n.grupCodi ?? ""}`;
}

/** Afegeix normes del seed que encara no existeixen (sense esborrar les actuals). */
export async function syncNormesNovesDesDeSeed(): Promise<{ ok: boolean; missatge: string }> {
  const lnByCodi = await getLnByCodi();
  const centralId = lnByCodi.get(CODI_LN_CENTRAL);
  if (!centralId) {
    return { ok: false, missatge: "Cal tenir LN00000 a l'arbre de dimensions." };
  }

  await syncGrupsRepartiment();
  await syncNormaPersonalPrecuinats();

  const existents = await db.normaRepartiment.findMany({
    include: { liniaNegociDesti: { select: { codi: true } }, grup: { select: { codi: true } } },
  });

  const clausExistents = new Set(
    existents.map((n) =>
      clauNormaSeed({
        nom: "",
        destCodi: n.liniaNegociDesti?.codi ?? "",
        concepteNode: n.concepteNode,
        tipus: n.tipus,
        valorPercent: n.valorPercent != null ? Number(n.valorPercent) : undefined,
        valorImport: n.valorImport != null ? Number(n.valorImport) : undefined,
        grupCodi: n.grup?.codi,
        ordre: n.ordre,
      })
    )
  );

  const noves = normesConfirmades().filter((n) => !clausExistents.has(clauNormaSeed(n)));
  if (noves.length === 0) {
    return { ok: true, missatge: "Cap norma nova al seed. Tot sincronitzat." };
  }

  const creats = await crearNormes(noves, lnByCodi, centralId);
  return { ok: true, missatge: `${creats} norma(es) nova(es) afegides des del seed.` };
}

/** Reinicia i carrega totes les normes confirmades del seed. */
export async function reiniciarAmbNormesSeed(): Promise<{ ok: boolean; missatge: string }> {
  const reset = await resetNormesRepartiment();
  if (!reset.ok) return reset;

  const lnByCodi = await getLnByCodi();
  const centralId = lnByCodi.get(CODI_LN_CENTRAL);
  if (!centralId) {
    return {
      ok: false,
      missatge: "Cal tenir LN00000 a l'arbre de dimensions abans de carregar el seed.",
    };
  }
  const creats = await crearNormes(normesConfirmades(), lnByCodi, centralId);
  await syncNormaPersonalPrecuinats();

  return {
    ok: true,
    missatge: `Reinici fet. ${creats} norma(es) carregades (${normesConfirmades().length} al seed).`,
  };
}

export async function ensureNormesRepartimentInicials(): Promise<{
  ok: boolean;
  missatge: string;
}> {
  const lnByCodi = await getLnByCodi();
  const centralId = lnByCodi.get(CODI_LN_CENTRAL);
  if (!centralId) {
    return {
      ok: false,
      missatge: "Cal tenir LN00000 a l'arbre de dimensions abans d'inicialitzar normes.",
    };
  }

  await syncGrupsRepartiment();

  const existents = await db.normaRepartiment.count();
  if (existents > 0) {
    return syncNormesNovesDesDeSeed();
  }

  const creats = await crearNormes(normesConfirmades(), lnByCodi, centralId);
  return { ok: true, missatge: `${creats} norma(es) carregades des del seed.` };
}

export async function getNormesVigents(date = new Date()) {
  return db.normaRepartiment.findMany({
    where: {
      actiu: true,
      vigentDesDe: { lte: date },
      OR: [{ vigentFins: null }, { vigentFins: { gte: date } }],
    },
    orderBy: { ordre: "asc" },
  });
}
