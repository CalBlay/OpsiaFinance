import { db } from "@/lib/db";
import { CODI_LN_CENTRAL } from "@/lib/repartiment/nodes";
import type {
  ConfigPersonalDept,
  ConfigPersonalLn,
  CostDeptMes,
  PesDefecteComercial,
} from "@/lib/repartiment/personal-departaments";
import {
  CODIS_LN_PERSONAL_COMERCIAL,
  CODIS_LN_PERSONAL_CONFIG,
} from "@/lib/repartiment/personal-departaments-constants";

export type ArbreDeptSc = {
  centreId: string;
  centreCodi: string;
  centreNom: string;
  departaments: {
    id: string;
    codi: string;
    nom: string;
  }[];
};

/** Departaments actius de tots els centres de Serveis Centrals. */
export async function carregarArbreDeptSc(): Promise<ArbreDeptSc[]> {
  const central = await db.liniaNegoci.findUnique({
    where: { codi: CODI_LN_CENTRAL },
    select: { id: true },
  });
  if (!central) return [];

  const centres = await db.centre.findMany({
    where: { liniaNegociId: central.id, isActive: true },
    orderBy: [{ ordre: "asc" }, { codi: "asc" }],
    select: {
      id: true,
      codi: true,
      nom: true,
      departaments: {
        where: { isActive: true },
        orderBy: [{ ordre: "asc" }, { codi: "asc" }],
        select: { id: true, codi: true, nom: true },
      },
    },
  });

  return centres.map((c) => ({
    centreId: c.id,
    centreCodi: c.codi,
    centreNom: c.nom,
    departaments: c.departaments,
  }));
}

/** Cost nòmina + millores per departament SC d'un mes. */
export async function carregarCostPersonalDeptSc(any: number, mes: number): Promise<CostDeptMes[]> {
  const arbre = await carregarArbreDeptSc();
  const centreIds = arbre.map((c) => c.centreId);
  if (!centreIds.length) return [];

  const rows = await db.costPersonalCentre.findMany({
    where: {
      centreId: { in: centreIds },
      period: { any, mes },
    },
    select: {
      centreId: true,
      departamentId: true,
      costPersonal: true,
      departament: { select: { id: true, codi: true, nom: true } },
    },
  });

  const centreById = new Map(arbre.map((c) => [c.centreId, c]));
  const costByDept = new Map<string, number>();

  for (const r of rows) {
    const centre = centreById.get(r.centreId);
    if (!centre) continue;
    const deptId = r.departamentId ?? `__sense__:${r.centreId}`;
    costByDept.set(deptId, (costByDept.get(deptId) ?? 0) + Math.abs(Number(r.costPersonal)));
  }

  const result: CostDeptMes[] = [];

  for (const centre of arbre) {
    if (centre.departaments.length === 0) {
      const key = `__sense__:${centre.centreId}`;
      const senseCost = costByDept.get(key) ?? 0;
      if (senseCost <= 0) continue; // No mostrar centre sense dept. i sense cost salarial.
      result.push({
        departamentId: key,
        centreId: centre.centreId,
        centreCodi: centre.centreCodi,
        centreNom: centre.centreNom,
        deptCodi: "—",
        deptNom: "Sense departament",
        costPersonal: senseCost,
      });
      continue;
    }

    for (const dept of centre.departaments) {
      result.push({
        departamentId: dept.id,
        centreId: centre.centreId,
        centreCodi: centre.centreCodi,
        centreNom: centre.centreNom,
        deptCodi: dept.codi,
        deptNom: dept.nom,
        costPersonal: costByDept.get(dept.id) ?? 0,
      });
    }

    const senseKey = `__sense__:${centre.centreId}`;
    const senseCost = costByDept.get(senseKey) ?? 0;
    if (senseCost > 0) {
      result.push({
        departamentId: senseKey,
        centreId: centre.centreId,
        centreCodi: centre.centreCodi,
        centreNom: centre.centreNom,
        deptCodi: "—",
        deptNom: "Sense departament (nòmina)",
        costPersonal: senseCost,
      });
    }
  }

  return result;
}

export async function carregarConfigPersonal(): Promise<{
  configsLn: ConfigPersonalLn[];
  configsDept: ConfigPersonalDept[];
  pesDefecte: PesDefecteComercial[];
}> {
  const codis = [...CODIS_LN_PERSONAL_CONFIG, ...CODIS_LN_PERSONAL_COMERCIAL];
  const lns = await db.liniaNegoci.findMany({
    where: { codi: { in: codis } },
    select: { id: true, codi: true },
  });
  const lnIds = lns.map((l) => l.id);
  const lnById = new Map(lns.map((l) => [l.id, l.codi]));

  const [configsLnRaw, configsDeptRaw, pesDefecteRaw] = await Promise.all([
    db.configPersonalLn.findMany({ where: { liniaNegociId: { in: lnIds } } }),
    db.configPersonalDept.findMany({ where: { liniaNegociId: { in: lnIds } } }),
    db.pesDefectePersonalComercial.findMany({ where: { liniaNegociId: { in: lnIds } } }),
  ]);

  return {
    configsLn: configsLnRaw
      .filter((c) => CODIS_LN_PERSONAL_CONFIG.includes(lnById.get(c.liniaNegociId) as never))
      .map((c) => ({
        liniaNegociId: c.liniaNegociId,
        codiLn: lnById.get(c.liniaNegociId) ?? "",
        mode: c.mode,
        importFixTotal: c.importFixTotal != null ? Number(c.importFixTotal) : null,
      })),
    configsDept: configsDeptRaw.map((c) => ({
      liniaNegociId: c.liniaNegociId,
      departamentId: c.departamentId,
      actiu: c.actiu,
      percentDept: c.percentDept != null ? Number(c.percentDept) : null,
      pesInternFix: c.pesInternFix != null ? Number(c.pesInternFix) : null,
    })),
    pesDefecte: pesDefecteRaw.map((p) => ({
      liniaNegociId: p.liniaNegociId,
      pesDefecte: Number(p.pesDefecte),
    })),
  };
}

/** Assegura registres de config i pesos per defecte 50/50 comercials. */
export async function ensureConfigPersonalInicial(): Promise<void> {
  const lns = await db.liniaNegoci.findMany({
    where: {
      codi: { in: [...CODIS_LN_PERSONAL_CONFIG, ...CODIS_LN_PERSONAL_COMERCIAL] },
    },
    select: { id: true, codi: true },
  });

  for (const codi of CODIS_LN_PERSONAL_CONFIG) {
    const ln = lns.find((l) => l.codi === codi);
    if (!ln) continue;
    await db.configPersonalLn.upsert({
      where: { liniaNegociId: ln.id },
      update: {},
      create: { liniaNegociId: ln.id, mode: "PERCENT_DEPT" },
    });
  }

  for (const codi of CODIS_LN_PERSONAL_COMERCIAL) {
    const ln = lns.find((l) => l.codi === codi);
    if (!ln) continue;
    await db.pesDefectePersonalComercial.upsert({
      where: { liniaNegociId: ln.id },
      update: {},
      create: {
        liniaNegociId: ln.id,
        pesDefecte: codi === "LN00002" ? 0.5 : 0.5,
      },
    });
  }
}

/** Desactiva normes de personal obsoletes (substituïdes per matriu dept.). */
export async function desactivarNormesPersonalObsoletes(): Promise<number> {
  const { count } = await db.normaRepartiment.updateMany({
    where: {
      concepteNode: 17,
      actiu: true,
      OR: [
        { tipus: "REPARTIMENT_PROPORCIONAL", grup: { codi: "GRUP_PERSONAL_CENTRAL" } },
        {
          tipus: "IMPORT_FIX",
          liniaNegociDesti: { codi: { in: ["LN00001", "LN00005", "LN00006"] } },
        },
        {
          tipus: "PERCENT_VENDES_PROPIES",
          liniaNegociDesti: { codi: { in: ["LN00005", "LN00006", "LN00000"] } },
          concepteNode: 17,
        },
        {
          tipus: "PERCENT_POOL_CENTRAL",
          liniaNegociDesti: { codi: "LN00004" },
          concepteNode: 17,
        },
        { nom: { startsWith: "Precuinats · suport" } },
      ],
    },
    data: { actiu: false },
  });
  return count;
}
