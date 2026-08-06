/**
 * Fase 1 — Una sola base Gestió de personal (centre × mes).
 *
 * Pipeline:
 *   SAP + ajustos manuals
 *     → payroll (substitueix Sous i salaris + SS el mes que hi ha fitxer)
 *     → traspassos confirmats (± a sous / cost)
 *
 * Consumidors: compte centre/LN/empresa Gestió, cost-personal, repartiment (directe personal).
 */

import {
  NODE_ALTRES_DESPESES_SOCIALS,
  NODE_INDEMNITZACIONS,
  NODE_SEGURETAT_SOCIAL,
  NODE_SOUS_SALARIS,
  NODE_TOTAL_COST_SALARIAL,
} from "@/lib/cost-personal-centre/nodes";
import { db } from "@/lib/db";
import type { RangMesos } from "@/lib/periodes";
import { prismaPeriodFilter } from "@/lib/periodes";

export type OrigenBasePersonal = "sap" | "payroll";

/** Imports amb signe de compte (costos ≤ 0). */
export interface ImportsPersonalGestio {
  importBrut: number;
  indemnitzacions: number;
  totalSegSocial: number;
  altresDespesesSocials: number;
  /** = brut + indem + SS + altres (després de payroll); + deltaTraspass. */
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
    costPersonal: 0,
  };
}

function normalitzaCost(imp: ImportsPersonalGestio): ImportsPersonalGestio {
  return {
    ...imp,
    costPersonal:
      imp.importBrut + imp.indemnitzacions + imp.totalSegSocial + imp.altresDespesesSocials,
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
      node: {
        in: [
          NODE_SOUS_SALARIS,
          NODE_INDEMNITZACIONS,
          NODE_SEGURETAT_SOCIAL,
          NODE_ALTRES_DESPESES_SOCIALS,
          NODE_TOTAL_COST_SALARIAL,
        ],
      },
    },
    select: { id: true, node: true },
  });
  return new Map(rows.map((r) => [r.id, r.node]));
}

/** SAP + ajustos per centre×mes (nodes 13–16; el 17 es deriva). Sense payroll ni traspass. */
export async function carregarBaseDirectePersonal(
  filtre: FiltreBaseGestio
): Promise<BaseGestioPersonal> {
  return carregarSapAjustos(filtre);
}

/** SAP + ajustos per centre×mes (nodes 13–16; el 17 es deriva). */
async function carregarSapAjustos(filtre: FiltreBaseGestio): Promise<BaseGestioPersonal> {
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
    db.ajust.findMany({
      where: { ...wc, concepteResultatId: { in: ids }, period: pw },
      select: {
        centreId: true,
        concepteResultatId: true,
        import_: true,
        period: { select: { mes: true } },
      },
    }),
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
  }

  for (const perMes of out.values()) {
    for (const [mes, cel] of perMes) {
      perMes.set(mes, { ...cel, imports: normalitzaCost(cel.imports) });
    }
  }

  return out;
}

async function carregarPayrollOverlay(
  filtre: FiltreBaseGestio
): Promise<Map<string, Map<number, ImportsPersonalGestio>>> {
  const wc = whereCentre(filtre);
  const rows = await db.costPersonalCentre.findMany({
    where: { ...wc, period: periodWhere(filtre.any, filtre.mes) },
    select: {
      centreId: true,
      importBrut: true,
      segSocialEmpresa: true,
      costPersonal: true,
      period: { select: { mes: true } },
    },
  });

  const out = new Map<string, Map<number, ImportsPersonalGestio>>();
  for (const f of rows) {
    let perMes = out.get(f.centreId);
    if (!perMes) {
      perMes = new Map();
      out.set(f.centreId, perMes);
    }
    const mes = f.period.mes;
    let acc = perMes.get(mes);
    if (!acc) {
      acc = emptyImports();
      perMes.set(mes, acc);
    }
    const brut = Math.abs(Number(f.importBrut));
    // Als fitxers actuals la columna K (desada temporalment a
    // segSocialEmpresa) és la provisió de pagues extres.
    const provisioPaguesExtres = Math.abs(Number(f.segSocialEmpresa));
    // Les càrregues ja existents van desar la provisió també a totalSegSocial.
    // El total de la fila és fiable i permet recuperar la SS real (columna L).
    const seguretatSocial = Math.max(
      0,
      Math.abs(Number(f.costPersonal)) - brut - provisioPaguesExtres
    );

    // Payroll → signe compte. La provisió és cost retributiu i es presenta a
    // Sous i salaris; la SS real es presenta a Seguretat Social.
    acc.importBrut += -(brut + provisioPaguesExtres);
    acc.totalSegSocial += -seguretatSocial;
  }

  for (const perMes of out.values()) {
    for (const [mes, acc] of perMes) {
      perMes.set(mes, normalitzaCost(acc));
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
 * Carrega la base Gestió de personal: SAP(+ajust) → payroll → traspass (per mes).
 */
export async function carregarBaseGestioPersonal(
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

  const [sap, payroll, traspass] = await Promise.all([
    carregarSapAjustos(filtreScoped),
    carregarPayrollOverlay(filtreScoped),
    carregarDeltasTraspassPersonalCentreMes(filtre.any, rang, centreIdsTraspass),
  ]);

  const centreIds = new Set([...sap.keys(), ...payroll.keys(), ...traspass.keys()]);
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
      const pay = payroll.get(centreId)?.get(m);
      const sapCel = sap.get(centreId)?.get(m);
      const delta = traspass.get(centreId)?.get(m) ?? 0;

      if (!pay && !sapCel && !delta) continue;

      let imports: ImportsPersonalGestio;
      let origen: OrigenBasePersonal;
      if (pay) {
        // El fitxer payroll no conté indemnitzacions (node 14) ni altres
        // despeses socials (node 16): aquests dos conceptes es mantenen de SAP.
        imports = normalitzaCost({
          ...pay,
          indemnitzacions: sapCel?.imports.indemnitzacions ?? 0,
          altresDespesesSocials: sapCel?.imports.altresDespesesSocials ?? 0,
        });
        origen = "payroll";
      } else if (sapCel) {
        imports = { ...sapCel.imports };
        origen = "sap";
      } else {
        imports = emptyImports();
        origen = "sap";
      }

      if (delta) {
        imports.importBrut += delta;
        imports.costPersonal += delta;
      }

      perMes.set(m, {
        centreId,
        mes: m,
        imports,
        origen,
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
  NODE_INDEMNITZACIONS,
  NODE_SEGURETAT_SOCIAL,
  NODE_SOUS_SALARIS,
  NODE_TOTAL_COST_SALARIAL,
};
