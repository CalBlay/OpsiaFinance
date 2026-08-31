/**
 * Base Gestió de personal (centre × mes).
 *
 * Pipeline (docs/gestio-i-cost-personal.md):
 *   SAP + ajustos manuals
 *     → traspassos confirmats (± a sous / cost)
 *
 * La nòmina/millores (payroll) és només informativa / comparativa:
 * no substitueix ni alimenta aquesta base.
 *
 * Consumidors: compte centre/LN/empresa Gestió, cost-personal (vista gestió),
 * repartiment (base personal).
 */

import {
  NODES_PERSONAL_COMpte,
  NODE_ALTRES_DESPESES_SOCIALS,
  NODE_CONTRACTES_ETT,
  NODE_INDEMNITZACIONS,
  NODE_SEGURETAT_SOCIAL,
  NODE_SOUS_SALARIS,
  NODE_TOTAL_COST_SALARIAL,
} from "@/lib/cost-personal-centre/nodes";
import { db } from "@/lib/db";
import type { RangMesos } from "@/lib/periodes";
import { prismaPeriodFilter } from "@/lib/periodes";
import { cache } from "react";

/** Origen de la cel·la Gestió personal (sempre SAP+ajust; payroll no hi entra). */
export type OrigenBasePersonal = "sap";

/** Imports amb signe de compte (costos ≤ 0). */
export interface ImportsPersonalGestio {
  importBrut: number;
  indemnitzacions: number;
  totalSegSocial: number;
  altresDespesesSocials: number;
  contractesEtt: number;
  /** = brut + indem + SS + altres + ETT; + deltaTraspass. */
  costPersonal: number;
}

export interface CelBaseGestioPersonal {
  centreId: string;
  mes: number;
  imports: ImportsPersonalGestio;
  origen: OrigenBasePersonal;
  /** Delta de traspass aplicat a sous i al total (signe compte). */
  deltaTraspass: number;
}

/** centreId → mes → cel·la */
export type BaseGestioPersonal = Map<string, Map<number, CelBaseGestioPersonal>>;

export type FiltreBaseGestio = {
  any: number;
  /** null / undefined = tot l'any */
  mes?: number | null;
  centreId?: string;
  liniaNegociId?: string;
  /** Restringeix a un conjunt de centres (p.ex. grup Cal Blay). */
  centreIds?: string[];
};

function emptyImports(): ImportsPersonalGestio {
  return {
    importBrut: 0,
    indemnitzacions: 0,
    totalSegSocial: 0,
    altresDespesesSocials: 0,
    contractesEtt: 0,
    costPersonal: 0,
  };
}

function normalitzaCost(imp: ImportsPersonalGestio): ImportsPersonalGestio {
  return {
    ...imp,
    costPersonal:
      imp.importBrut +
      imp.indemnitzacions +
      imp.totalSegSocial +
      imp.altresDespesesSocials +
      imp.contractesEtt,
  };
}

function periodWhere(any: number, mes: number | null | undefined) {
  return mes != null ? { any, mes } : { any };
}

function whereCentre(filtre: FiltreBaseGestio) {
  if (filtre.centreId) return { centreId: filtre.centreId };
  if (filtre.centreIds?.length) {
    return { centreId: { in: filtre.centreIds } };
  }
  if (filtre.liniaNegociId) {
    return { centre: { liniaNegociId: filtre.liniaNegociId, isActive: true } };
  }
  return { centre: { isActive: true } };
}

async function carregarConceptesPersonal(): Promise<Map<string, number>> {
  const rows = await db.concepteResultat.findMany({
    where: {
      isActive: true,
      node: { in: [...NODES_PERSONAL_COMpte] },
    },
    select: { id: true, node: true },
  });
  return new Map(rows.map((r) => [r.id, r.node]));
}

/** SAP + ajustos per centre×mes (detall personal 13–16, 44; el 17 es deriva). Sense payroll ni traspass. */
export async function carregarBaseDirectePersonal(
  filtre: FiltreBaseGestio
): Promise<BaseGestioPersonal> {
  return carregarSapAjustos(filtre, true);
}

/**
 * Només dades SAP importades (dadaResultat), sense ajustos ni traspass ni payroll.
 * Usat a la comparativa Cost personal ↔ SAP.
 */
export async function carregarBaseSapNomesPersonal(
  filtre: FiltreBaseGestio
): Promise<BaseGestioPersonal> {
  return carregarSapAjustos(filtre, false);
}

/** SAP (± ajustos) per centre×mes (detall personal 13–16, 44; el 17 es deriva). */
async function carregarSapAjustos(
  filtre: FiltreBaseGestio,
  incloureAjustos: boolean
): Promise<BaseGestioPersonal> {
  const nodeById = await carregarConceptesPersonal();
  const ids = [...nodeById.keys()];
  if (!ids.length) return new Map();

  const wc = whereCentre(filtre);
  const pw = periodWhere(filtre.any, filtre.mes);

  const [dades, ajustos] = await Promise.all([
    db.dadaResultat.findMany({
      where: { ...wc, concepteResultatId: { in: ids }, period: pw },
      select: {
        centreId: true,
        concepteResultatId: true,
        import_: true,
        period: { select: { mes: true } },
      },
    }),
    incloureAjustos
      ? db.ajust.findMany({
          where: { ...wc, concepteResultatId: { in: ids }, period: pw },
          select: {
            centreId: true,
            concepteResultatId: true,
            import_: true,
            period: { select: { mes: true } },
          },
        })
      : Promise.resolve(
          [] as Array<{
            centreId: string | null;
            concepteResultatId: string;
            import_: unknown;
            period: { mes: number };
          }>
        ),
  ]);

  const out: BaseGestioPersonal = new Map();

  for (const d of [...dades, ...ajustos]) {
    if (!d.centreId) continue;
    const node = nodeById.get(d.concepteResultatId);
    if (!node || node === NODE_TOTAL_COST_SALARIAL) continue;

    let perMes = out.get(d.centreId);
    if (!perMes) {
      perMes = new Map();
      out.set(d.centreId, perMes);
    }
    const mes = d.period.mes;
    let cel = perMes.get(mes);
    if (!cel) {
      cel = {
        centreId: d.centreId,
        mes,
        imports: emptyImports(),
        origen: "sap",
        deltaTraspass: 0,
      };
      perMes.set(mes, cel);
    }
    const v = Number(d.import_);
    if (node === NODE_SOUS_SALARIS) cel.imports.importBrut += v;
    else if (node === NODE_INDEMNITZACIONS) cel.imports.indemnitzacions += v;
    else if (node === NODE_SEGURETAT_SOCIAL) cel.imports.totalSegSocial += v;
    else if (node === NODE_ALTRES_DESPESES_SOCIALS) cel.imports.altresDespesesSocials += v;
    else if (node === NODE_CONTRACTES_ETT) cel.imports.contractesEtt += v;
  }

  for (const perMes of out.values()) {
    for (const [mes, cel] of perMes) {
      perMes.set(mes, { ...cel, imports: normalitzaCost(cel.imports) });
    }
  }

  return out;
}

/**
 * Deltas de traspass confirmats per centre × mes (node 17, presentació a sous).
 * Origen +, destí − (costos negatius al compte).
 */
export async function carregarDeltasTraspassPersonalCentreMes(
  any: number,
  rang: RangMesos,
  centreIds?: string[]
): Promise<Map<string, Map<number, number>>> {
  const execucions = await db.execucioTraspassPersonal.findMany({
    where: {
      estat: "CONFIRMAT",
      period: prismaPeriodFilter(any, rang),
    },
    select: {
      period: { select: { mes: true } },
      moviments: {
        where: centreIds?.length
          ? {
              OR: [{ centreOrigenId: { in: centreIds } }, { centreDestiId: { in: centreIds } }],
            }
          : undefined,
        select: {
          centreOrigenId: true,
          centreDestiId: true,
          import_: true,
        },
      },
    },
  });

  const out = new Map<string, Map<number, number>>();
  const add = (centreId: string, mes: number, delta: number) => {
    if (centreIds?.length && !centreIds.includes(centreId)) return;
    let perMes = out.get(centreId);
    if (!perMes) {
      perMes = new Map();
      out.set(centreId, perMes);
    }
    perMes.set(mes, (perMes.get(mes) ?? 0) + delta);
  };

  for (const ex of execucions) {
    const mes = ex.period.mes;
    for (const m of ex.moviments) {
      const imp = Number(m.import_);
      add(m.centreOrigenId, mes, imp);
      add(m.centreDestiId, mes, -imp);
    }
  }
  return out;
}

/**
 * Carrega la base Gestió de personal: SAP(+ajust) → traspass (per mes).
 * Sense nòmina/millores.
 * Cache per petició (mateixa clau = un sol load en Directe+Gestió / LN+empresa).
 */
export async function carregarBaseGestioPersonal(
  filtre: FiltreBaseGestio
): Promise<BaseGestioPersonal> {
  const centreIdsKey = (filtre.centreIds ?? []).slice().sort().join(",");
  return carregarBaseGestioPersonalCached(
    filtre.any,
    filtre.mes ?? null,
    filtre.centreId ?? null,
    filtre.liniaNegociId ?? null,
    centreIdsKey || null
  );
}

const carregarBaseGestioPersonalCached = cache(
  async (
    any: number,
    mes: number | null,
    centreId: string | null,
    liniaNegociId: string | null,
    centreIdsKey: string | null
  ): Promise<BaseGestioPersonal> => {
    const filtre: FiltreBaseGestio = {
      any,
      mes,
      centreId: centreId ?? undefined,
      liniaNegociId: liniaNegociId ?? undefined,
      centreIds: centreIdsKey ? centreIdsKey.split(",") : undefined,
    };
    return carregarBaseGestioPersonalImpl(filtre);
  }
);

async function carregarBaseGestioPersonalImpl(
  filtre: FiltreBaseGestio
): Promise<BaseGestioPersonal> {
  const mes = filtre.mes ?? null;
  const rang: RangMesos = mes != null ? { des: mes, fins: mes } : { des: 1, fins: 12 };

  // Resol centres permesos (LN / llista) abans del traspass per no barrejar altres LN.
  let centreIdsScope = filtre.centreIds;
  if (!filtre.centreId && !centreIdsScope?.length && filtre.liniaNegociId) {
    const centresLn = await db.centre.findMany({
      where: { liniaNegociId: filtre.liniaNegociId, isActive: true },
      select: { id: true },
    });
    centreIdsScope = centresLn.map((c) => c.id);
  }
  const filtreScoped: FiltreBaseGestio = {
    ...filtre,
    centreIds: filtre.centreId ? undefined : centreIdsScope,
  };

  const centreIdsTraspass = filtre.centreId ? [filtre.centreId] : centreIdsScope;

  const [sap, traspass] = await Promise.all([
    carregarSapAjustos(filtreScoped, true),
    carregarDeltasTraspassPersonalCentreMes(filtre.any, rang, centreIdsTraspass),
  ]);

  const centreIds = new Set([...sap.keys(), ...traspass.keys()]);
  if (centreIdsScope?.length) {
    for (const id of [...centreIds]) {
      if (!centreIdsScope.includes(id)) centreIds.delete(id);
    }
  }

  const mesos = mes != null ? [mes] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const out: BaseGestioPersonal = new Map();

  for (const centreId of centreIds) {
    const perMes = new Map<number, CelBaseGestioPersonal>();
    for (const m of mesos) {
      const sapCel = sap.get(centreId)?.get(m);
      const delta = traspass.get(centreId)?.get(m) ?? 0;

      if (!sapCel && !delta) continue;

      const imports: ImportsPersonalGestio = sapCel ? { ...sapCel.imports } : emptyImports();

      if (delta) {
        imports.importBrut += delta;
        imports.costPersonal += delta;
      }

      perMes.set(m, {
        centreId,
        mes: m,
        imports,
        origen: "sap",
        deltaTraspass: delta,
      });
    }
    if (perMes.size) out.set(centreId, perMes);
  }

  return out;
}

/** Agrega una base a Map<centreId, Imports> (suma de mesos). */
export function agregarBasePerCentre(base: BaseGestioPersonal): Map<string, ImportsPersonalGestio> {
  const out = new Map<string, ImportsPersonalGestio>();
  for (const [centreId, perMes] of base) {
    const tot = emptyImports();
    for (const cel of perMes.values()) {
      tot.importBrut += cel.imports.importBrut;
      tot.indemnitzacions += cel.imports.indemnitzacions;
      tot.totalSegSocial += cel.imports.totalSegSocial;
      tot.altresDespesesSocials += cel.imports.altresDespesesSocials;
      tot.costPersonal += cel.imports.costPersonal;
    }
    out.set(centreId, tot);
  }
  return out;
}

/** Vector de 12 mesos (cost absolut) per un conjunt de centres. */
export function costAbsMensualDeBase(base: BaseGestioPersonal, centreIds?: Set<string>): number[] {
  const out = new Array(12).fill(0);
  for (const [centreId, perMes] of base) {
    if (centreIds && !centreIds.has(centreId)) continue;
    for (const [mes, cel] of perMes) {
      if (mes >= 1 && mes <= 12) out[mes - 1] += Math.abs(cel.imports.costPersonal);
    }
  }
  return out;
}

export {
  NODE_ALTRES_DESPESES_SOCIALS,
  NODE_CONTRACTES_ETT,
  NODE_INDEMNITZACIONS,
  NODE_SEGURETAT_SOCIAL,
  NODE_SOUS_SALARIS,
  NODE_TOTAL_COST_SALARIAL,
};
