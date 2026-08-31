import { recalcularSubtotalsCompte } from "@/lib/compte-subtotals";
import type { ConceptePivot } from "@/lib/consultes";
import {
  type ImportsPersonalGestio,
  carregarBaseGestioPersonal,
} from "@/lib/cost-personal-centre/base-gestio";
import {
  NODE_ALTRES_DESPESES_SOCIALS,
  NODE_CONTRACTES_ETT,
  NODE_INDEMNITZACIONS,
  NODE_SEGURETAT_SOCIAL,
  NODE_SOUS_SALARIS,
  esNodePersonalCompte,
} from "@/lib/cost-personal-centre/nodes";
import { db } from "@/lib/db";
import type { RangMesos } from "@/lib/periodes";

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

function mesosDelRang(rang: RangMesos): number[] {
  const out: number[] = [];
  for (let m = rang.des; m <= rang.fins; m++) out.push(m);
  return out;
}

function sumarImportsMesos(
  perMes: Map<number, { imports: ImportsPersonalGestio }>,
  mesos: number[]
): ImportsPersonalGestio {
  const tot = emptyImports();
  for (const m of mesos) {
    const cel = perMes.get(m);
    if (!cel) continue;
    tot.importBrut += cel.imports.importBrut;
    tot.indemnitzacions += cel.imports.indemnitzacions;
    tot.totalSegSocial += cel.imports.totalSegSocial;
    tot.altresDespesesSocials += cel.imports.altresDespesesSocials;
    tot.contractesEtt += cel.imports.contractesEtt;
    tot.costPersonal += cel.imports.costPersonal;
  }
  return tot;
}

function aplicarImportsAFiles(
  rows: ConceptePivot[],
  colIdx: number,
  imp: ImportsPersonalGestio
): void {
  const byNode = new Map(rows.map((r) => [r.node, r]));
  const sous = byNode.get(NODE_SOUS_SALARIS);
  const indem = byNode.get(NODE_INDEMNITZACIONS);
  const ss = byNode.get(NODE_SEGURETAT_SOCIAL);
  const altres = byNode.get(NODE_ALTRES_DESPESES_SOCIALS);
  const ett = byNode.get(NODE_CONTRACTES_ETT);
  if (sous) sous.valors[colIdx] = imp.importBrut;
  if (indem) indem.valors[colIdx] = imp.indemnitzacions;
  if (ss) ss.valors[colIdx] = imp.totalSegSocial;
  if (altres) altres.valors[colIdx] = imp.altresDespesesSocials;
  if (ett) ett.valors[colIdx] = imp.contractesEtt;
}

function recalcular(rows: ConceptePivot[]): ConceptePivot[] {
  for (const row of rows) {
    row.total = row.valors.reduce((a, b) => a + b, 0);
  }
  return recalcularSubtotalsCompte(
    rows.map((r) => ({ node: r.node, esSubtotal: r.esSubtotal })),
    rows
  );
}

/**
 * Aplica la base Gestió de personal al compte d'un centre (12 mesos):
 * SAP+ajust → traspassos (sense nòmina/millores).
 */
export async function aplicarCostPersonalEvolucioCentre(
  centreId: string,
  any: number,
  rows: ConceptePivot[]
): Promise<ConceptePivot[]> {
  const base = await carregarBaseGestioPersonal({ any, centreId });
  const perMes = base.get(centreId);
  if (!perMes?.size) return rows;

  const merged = rows.map((r) => ({ ...r, valors: [...r.valors] }));
  const byNode = new Map(merged.map((r) => [r.node, r]));

  const sous = byNode.get(NODE_SOUS_SALARIS);
  const indem = byNode.get(NODE_INDEMNITZACIONS);
  const ss = byNode.get(NODE_SEGURETAT_SOCIAL);
  const altres = byNode.get(NODE_ALTRES_DESPESES_SOCIALS);
  const ett = byNode.get(NODE_CONTRACTES_ETT);

  for (const [mes, cel] of perMes) {
    const idx = mes - 1;
    if (idx < 0 || idx > 11) continue;
    const imp = cel.imports;
    if (sous) sous.valors[idx] = imp.importBrut;
    if (indem) indem.valors[idx] = imp.indemnitzacions;
    if (ss) ss.valors[idx] = imp.totalSegSocial;
    if (altres) altres.valors[idx] = imp.altresDespesesSocials;
    if (ett) ett.valors[idx] = imp.contractesEtt;
  }

  return recalcular(merged);
}

/**
 * Vista LN Gestió: substitueix el bloc personal de cada columna centre
 * per la base Gestió (SAP+ajust + traspass). No cal aplicar traspass a part.
 */
export async function aplicarBaseGestioPersonalCentres(
  any: number,
  rang: RangMesos,
  centreIds: string[],
  rows: ConceptePivot[]
): Promise<ConceptePivot[]> {
  const reals = centreIds.filter((id) => !id.startsWith("__"));
  if (!reals.length) return rows;

  const base = await carregarBaseGestioPersonal({ any, centreIds: reals });
  const mesos = mesosDelRang(rang);
  const merged = rows.map((r) => ({ ...r, valors: [...r.valors] }));

  for (let i = 0; i < centreIds.length; i++) {
    const perMes = base.get(centreIds[i]);
    if (!perMes?.size) continue;
    aplicarImportsAFiles(merged, i, sumarImportsMesos(perMes, mesos));
  }

  return recalcular(merged);
}

/**
 * Vista empresa Gestió: substitueix personal per LN amb la suma de centres
 * de la base Gestió (SAP+ajust + traspass). El repartiment s'aplica després a part.
 */
export async function aplicarBaseGestioPersonalLinies(
  any: number,
  rang: RangMesos,
  lnIds: string[],
  rows: ConceptePivot[]
): Promise<ConceptePivot[]> {
  if (!lnIds.length) return rows;

  const [base, centres] = await Promise.all([
    carregarBaseGestioPersonal({ any }),
    db.centre.findMany({
      where: { isActive: true, liniaNegociId: { in: lnIds } },
      select: { id: true, liniaNegociId: true },
    }),
  ]);

  const mesos = mesosDelRang(rang);
  const perCentre = new Map<string, ImportsPersonalGestio>();
  for (const [centreId, perMes] of base) {
    perCentre.set(centreId, sumarImportsMesos(perMes, mesos));
  }

  const perLn = new Map<string, ImportsPersonalGestio>();
  for (const c of centres) {
    const imp = perCentre.get(c.id);
    if (!imp) continue;
    let acc = perLn.get(c.liniaNegociId);
    if (!acc) {
      acc = emptyImports();
      perLn.set(c.liniaNegociId, acc);
    }
    acc.importBrut += imp.importBrut;
    acc.indemnitzacions += imp.indemnitzacions;
    acc.totalSegSocial += imp.totalSegSocial;
    acc.altresDespesesSocials += imp.altresDespesesSocials;
    acc.contractesEtt += imp.contractesEtt;
    acc.costPersonal += imp.costPersonal;
  }

  const merged = rows.map((r) => ({ ...r, valors: [...r.valors] }));
  for (let i = 0; i < lnIds.length; i++) {
    const imp = perLn.get(lnIds[i]);
    if (!imp) continue;
    aplicarImportsAFiles(merged, i, imp);
  }

  return recalcular(merged);
}

/**
 * Evolució mensual LN Gestió: substitueix el bloc personal (12 mesos)
 * amb la suma de centres de la base Gestió. El repartiment s'aplica després.
 */
export async function aplicarBaseGestioPersonalEvolucioLn(
  liniaNegociId: string,
  any: number,
  rows: ConceptePivot[]
): Promise<ConceptePivot[]> {
  const base = await carregarBaseGestioPersonal({ any, liniaNegociId });
  if (!base.size) return rows;

  const perMes = new Map<number, ImportsPersonalGestio>();
  for (const centreMes of base.values()) {
    for (const [mes, cel] of centreMes) {
      let acc = perMes.get(mes);
      if (!acc) {
        acc = emptyImports();
        perMes.set(mes, acc);
      }
      acc.importBrut += cel.imports.importBrut;
      acc.indemnitzacions += cel.imports.indemnitzacions;
      acc.totalSegSocial += cel.imports.totalSegSocial;
      acc.altresDespesesSocials += cel.imports.altresDespesesSocials;
      acc.contractesEtt += cel.imports.contractesEtt;
      acc.costPersonal += cel.imports.costPersonal;
    }
  }

  const merged = rows.map((r) => ({ ...r, valors: [...r.valors] }));
  const byNode = new Map(merged.map((r) => [r.node, r]));
  const sous = byNode.get(NODE_SOUS_SALARIS);
  const indem = byNode.get(NODE_INDEMNITZACIONS);
  const ss = byNode.get(NODE_SEGURETAT_SOCIAL);
  const altres = byNode.get(NODE_ALTRES_DESPESES_SOCIALS);
  const ett = byNode.get(NODE_CONTRACTES_ETT);

  for (const [mes, imp] of perMes) {
    const idx = mes - 1;
    if (idx < 0 || idx > 11) continue;
    if (sous) sous.valors[idx] = imp.importBrut;
    if (indem) indem.valors[idx] = imp.indemnitzacions;
    if (ss) ss.valors[idx] = imp.totalSegSocial;
    if (altres) altres.valors[idx] = imp.altresDespesesSocials;
    if (ett) ett.valors[idx] = imp.contractesEtt;
  }

  return recalcular(merged);
}

/**
 * Evolució mensual empresa: els traspassos entre centres es cancel·len.
 * Reconstruir el personal des dels centres trenca l'invariant (es perd personal
 * sense centre i es barregen grups): el total ha de coincidir amb Directe.
 */
export async function aplicarBaseGestioPersonalEvolucioEmpresa(
  _any: number,
  rows: ConceptePivot[]
): Promise<ConceptePivot[]> {
  return rows;
}

export { esNodePersonalCompte };
