import { revalidateConsultesDades } from "@/lib/consultes-cache";
import { db } from "@/lib/db";
import {
  MOTIU_ETT,
  NODES_AJUST_ETT,
  NODE_ALTRES_DESPESES,
  NODE_CONTRACTES_ETT,
} from "@/lib/despeses-ett/constants";
import { agregarPerCentrePeriode, parseDespesesEtt } from "@/lib/despeses-ett/parser";
import { ensureConceptesCompteBase } from "@/lib/fdlc/conceptes-base";
import { MESOS_LLARGS } from "@/lib/periodes";
import { revalidatePath } from "next/cache";

export type DespesesEttResumCentre = {
  periodNom: string;
  periodAny: number;
  periodMes: number;
  centreCodi: string;
  centreNom: string;
  importBrut: number;
  /** Import a ETT (negatiu). */
  importEtt: number;
  /** Import a ALTRES DESPESES (positiu = treure despesa). */
  importAltres: number;
  files: number;
};

export type ImportDespesesEttResult = {
  ok: boolean;
  missatge: string;
  errors?: string[];
  avisos?: string[];
  resums?: DespesesEttResumCentre[];
  ajustosCreats?: number;
};

async function upsertPeriode(any: number, mes: number): Promise<string> {
  const period = await db.period.upsert({
    where: { any_mes: { any, mes } },
    update: {},
    create: { any, mes, nom: `${MESOS_LLARGS[mes - 1]} ${any}` },
  });
  return period.id;
}

async function resolCentre(
  codi: string,
  liniaNegociCodi: string | null
): Promise<{ id: string; codi: string; nom: string } | null> {
  const candidats = await db.centre.findMany({
    where: { codi: codi.toUpperCase(), isActive: true },
    select: {
      id: true,
      codi: true,
      nom: true,
      liniaNegoci: { select: { codi: true } },
    },
    orderBy: { ordre: "asc" },
  });
  if (!candidats.length) return null;
  if (candidats.length === 1) {
    return { id: candidats[0].id, codi: candidats[0].codi, nom: candidats[0].nom };
  }
  if (liniaNegociCodi) {
    const match = candidats.find((c) => c.liniaNegoci.codi === liniaNegociCodi);
    if (match) return { id: match.id, codi: match.codi, nom: match.nom };
  }
  return { id: candidats[0].id, codi: candidats[0].codi, nom: candidats[0].nom };
}

function refreshPaths() {
  revalidateConsultesDades();
  revalidatePath("/dades/despeses-ett");
  revalidatePath("/dades/ajustos");
  revalidatePath("/consultes/centre");
  revalidatePath("/consultes/linia");
  revalidatePath("/consultes/empresa");
  revalidatePath("/consultes/evolucio");
  revalidatePath("/consultes/comparativa");
  revalidatePath("/dades/repartiment");
}

/**
 * Importa l'Excel ETT i crea parells d'ajustos per centre×mes:
 * - CONTRACTES ETT (44): −|total|
 * - ALTRES DESPESES (26): +|total|  (resta la despesa d'altres)
 * Motiu: «ETT». Reimportació del mateix període×centre substitueix els ajustos ETT previs.
 */
export async function importarDespesesEttDesDeBuffer(
  buffer: Buffer,
  opts: { creatPer: string; nomFitxer?: string }
): Promise<ImportDespesesEttResult> {
  const parsed = parseDespesesEtt(buffer);
  if (parsed.files.length === 0) {
    return {
      ok: false,
      missatge: parsed.errors[0] ?? "Cap dada importable.",
      errors: parsed.errors,
      avisos: parsed.avisos,
    };
  }

  await ensureConceptesCompteBase();

  const conceptes = await db.concepteResultat.findMany({
    where: { node: { in: [...NODES_AJUST_ETT] } },
    select: { id: true, node: true },
  });
  const concepteIdByNode = new Map(conceptes.map((c) => [c.node, c.id]));
  const idEtt = concepteIdByNode.get(NODE_CONTRACTES_ETT);
  const idAltres = concepteIdByNode.get(NODE_ALTRES_DESPESES);
  if (!idEtt || !idAltres) {
    return {
      ok: false,
      missatge: "Falten els conceptes CONTRACTES ETT (44) o ALTRES DESPESES (26) a la base.",
    };
  }

  const agregats = agregarPerCentrePeriode(parsed.files);
  const errors: string[] = [...parsed.errors];
  const avisos: string[] = [...parsed.avisos];
  const resums: DespesesEttResumCentre[] = [];
  const rows: {
    periodId: string;
    concepteResultatId: string;
    centreId: string;
    liniaNegociId: null;
    import_: number;
    motiu: string;
    creatPer: string;
  }[] = [];

  const periodCache = new Map<string, string>();
  const centresTocada = new Map<string, { periodId: string; centreId: string }>();

  for (const agg of agregats.values()) {
    if (agg.total === 0) continue;

    const centre = await resolCentre(agg.centreCodi, agg.liniaNegociCodi);
    if (!centre) {
      errors.push(`Centre «${agg.centreCodi}» no trobat a dimensions (omitit).`);
      continue;
    }

    const pKey = `${agg.any}-${agg.mes}`;
    let periodId = periodCache.get(pKey);
    if (!periodId) {
      periodId = await upsertPeriode(agg.any, agg.mes);
      periodCache.set(pKey, periodId);
    }

    const importBrut = Math.abs(agg.total);
    // Reclassificació: despesa Excel (Cargo−Abono) → ETT en negatiu, restar d'ALTRES DESPESES.
    const importEtt = -agg.total;
    const importAltres = agg.total;

    centresTocada.set(`${periodId}::${centre.id}`, { periodId, centreId: centre.id });

    rows.push(
      {
        periodId,
        concepteResultatId: idEtt,
        centreId: centre.id,
        liniaNegociId: null,
        import_: importEtt,
        motiu: MOTIU_ETT,
        creatPer: opts.creatPer,
      },
      {
        periodId,
        concepteResultatId: idAltres,
        centreId: centre.id,
        liniaNegociId: null,
        import_: importAltres,
        motiu: MOTIU_ETT,
        creatPer: opts.creatPer,
      }
    );

    resums.push({
      periodNom: `${MESOS_LLARGS[agg.mes - 1]} ${agg.any}`,
      periodAny: agg.any,
      periodMes: agg.mes,
      centreCodi: centre.codi,
      centreNom: centre.nom,
      importBrut,
      importEtt,
      importAltres,
      files: agg.files,
    });
  }

  if (rows.length === 0) {
    return {
      ok: false,
      missatge: errors[0] ?? "Cap centre vàlid per crear ajustos.",
      errors,
      avisos,
    };
  }

  // Substitueix ajustos ETT previs dels mateixos centre×període
  for (const { periodId, centreId } of centresTocada.values()) {
    await db.ajust.deleteMany({
      where: {
        periodId,
        centreId,
        motiu: MOTIU_ETT,
        liniaNegociId: null,
      },
    });
  }

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.ajust.createMany({ data: rows.slice(i, i + BATCH) });
  }

  refreshPaths();

  const centresOk = resums.length;
  const periodes = [...new Set(resums.map((r) => r.periodNom))].join(", ");
  const labelFitxer = opts.nomFitxer ? `«${opts.nomFitxer}» · ` : "";

  return {
    ok: true,
    missatge: `${labelFitxer}${rows.length} ajustos (${centresOk} centres) · ${periodes}`,
    errors: errors.length ? errors : undefined,
    avisos: avisos.length ? avisos : undefined,
    resums,
    ajustosCreats: rows.length,
  };
}

/** Llista agregada dels ajustos amb motiu ETT (per a la pestanya Dades). */
export async function llistaAjustosEtt(filtre?: {
  any?: number | null;
  mes?: number | null;
}): Promise<DespesesEttResumCentre[]> {
  const wherePeriod: { any?: number; mes?: number } = {};
  if (filtre?.any && Number.isFinite(filtre.any)) wherePeriod.any = filtre.any;
  if (filtre?.mes && filtre.mes >= 1 && filtre.mes <= 12) wherePeriod.mes = filtre.mes;

  const ajustos = await db.ajust.findMany({
    where: {
      motiu: MOTIU_ETT,
      ...(Object.keys(wherePeriod).length ? { period: wherePeriod } : {}),
    },
    select: {
      import_: true,
      concepteResultat: { select: { node: true } },
      centre: { select: { codi: true, nom: true } },
      period: { select: { any: true, mes: true, nom: true } },
    },
    orderBy: [{ period: { any: "desc" } }, { period: { mes: "desc" } }],
  });

  type Acc = DespesesEttResumCentre & { _key: string };
  const map = new Map<string, Acc>();

  for (const a of ajustos) {
    if (!a.centre) continue;
    const key = `${a.period.any}-${a.period.mes}::${a.centre.codi}`;
    let acc = map.get(key);
    if (!acc) {
      acc = {
        _key: key,
        periodNom: a.period.nom,
        periodAny: a.period.any,
        periodMes: a.period.mes,
        centreCodi: a.centre.codi,
        centreNom: a.centre.nom,
        importBrut: 0,
        importEtt: 0,
        importAltres: 0,
        files: 0,
      };
      map.set(key, acc);
    }
    const v = Number(a.import_);
    if (a.concepteResultat.node === NODE_CONTRACTES_ETT) {
      acc.importEtt += v;
    } else if (a.concepteResultat.node === NODE_ALTRES_DESPESES) {
      acc.importAltres += v;
    }
    acc.importBrut = Math.max(Math.abs(acc.importEtt), Math.abs(acc.importAltres));
  }

  return [...map.values()]
    .map((row) => {
      const { _key: _, ...rest } = row;
      return rest;
    })
    .sort((a, b) => {
      if (a.periodAny !== b.periodAny) return b.periodAny - a.periodAny;
      if (a.periodMes !== b.periodMes) return b.periodMes - a.periodMes;
      return a.centreCodi.localeCompare(b.centreCodi);
    });
}

export async function getAnysAmbAjustosEtt(): Promise<number[]> {
  const rows = await db.ajust.findMany({
    where: { motiu: MOTIU_ETT },
    select: { period: { select: { any: true } } },
  });
  const anys = [...new Set(rows.map((r) => r.period.any))];
  return anys.sort((a, b) => b - a);
}

/** Esborra tots els ajustos motiu ETT d'un període (opcionalment un centre). */
export async function eliminarAjustosEtt(opts: {
  any: number;
  mes: number;
  centreId?: string | null;
}): Promise<{ ok: boolean; missatge: string; eliminats: number }> {
  const period = await db.period.findUnique({
    where: { any_mes: { any: opts.any, mes: opts.mes } },
    select: { id: true, nom: true },
  });
  if (!period) return { ok: false, missatge: "Període no trobat.", eliminats: 0 };

  const result = await db.ajust.deleteMany({
    where: {
      motiu: MOTIU_ETT,
      periodId: period.id,
      ...(opts.centreId ? { centreId: opts.centreId } : {}),
    },
  });

  refreshPaths();

  const ambit = opts.centreId ? "del centre" : `de ${period.nom}`;
  return {
    ok: true,
    missatge: `S'han eliminat ${result.count} ajustos ETT ${ambit}.`,
    eliminats: result.count,
  };
}
