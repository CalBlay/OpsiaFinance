/**
 * % anual Compres (food cost) i Gestió — vista Gestió, acumulat any.
 * API M2M per Cal Blay · Cost de serveis.
 *
 * IMPORTANT: getEvolucioMensualPerVista("gestio") NO aplica repartiment
 * (només Directe). Cal aplicar la mateixa cadena que RESULTATS / Evolució:
 *   Directe → traspassos personal → repartiment Central (Gestió).
 */

import { getArbreSeleccio, getEvolucioMensualPerVista } from "@/lib/consultes";
import type { ConceptePivot } from "@/lib/consultes";
import { aplicarBaseGestioPersonalEvolucioLn } from "@/lib/cost-personal-centre/gestio-consultes";
import { db } from "@/lib/db";
import { assertExternalApiKey } from "@/lib/external/cost-personal-estructura";
import {
  GRUP_EMPRESA_DEFAULT,
  type GrupEmpresa,
  liniesPerConsultaDetall,
  parseGrupEmpresa,
} from "@/lib/grups-empresa";
import { NODE_COMPRES, NODE_COST_GESTIO, NODE_INGRESSOS } from "@/lib/kpi-definitions";
import { aplicarVistaGestioEvolucioLn } from "@/lib/repartiment/gestio-consultes";

export { assertExternalApiKey };

export type PctAnualLnRow = {
  lnCodi: string;
  lnNom: string;
  ingressos: number;
  compres: number;
  gestio: number;
  pctCompres: number | null;
  pctGestio: number | null;
};

export type PctAnualTotals = {
  ingressos: number;
  compres: number;
  gestio: number;
  pctCompres: number | null;
  pctGestio: number | null;
};

export type PctAnualResponse = {
  year: number;
  vista: "gestio";
  grup: GrupEmpresa;
  general: PctAnualTotals;
  lines: PctAnualLnRow[];
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}

function sumValors(valors: number[] | undefined): number {
  if (!valors?.length) return 0;
  return valors.reduce((s, v) => s + (Number(v) || 0), 0);
}

function pctSobreIngressos(costAbs: number, ingressos: number): number | null {
  if (!(ingressos > 0)) return null;
  return round4((costAbs / ingressos) * 100);
}

function totalsFromConcepts(concepts: ConceptePivot[]): PctAnualTotals {
  const ingressos = round2(sumValors(concepts.find((c) => c.node === NODE_INGRESSOS)?.valors));
  const compres = round2(
    Math.abs(sumValors(concepts.find((c) => c.node === NODE_COMPRES)?.valors))
  );
  const gestio = round2(
    Math.abs(sumValors(concepts.find((c) => c.node === NODE_COST_GESTIO)?.valors))
  );
  return {
    ingressos,
    compres,
    gestio,
    pctCompres: pctSobreIngressos(compres, ingressos),
    pctGestio: pctSobreIngressos(gestio, ingressos),
  };
}

/**
 * Evolució LN amb capa Gestió real (com Evolució / Per línia a Opsia).
 * Clona valors perquè aplicar* muta els arrays in-place.
 */
async function evolucioLnVistaGestio(
  lnId: string,
  year: number,
  grup: GrupEmpresa
): Promise<ConceptePivot[]> {
  const ev = await getEvolucioMensualPerVista("linia", lnId, year, grup, "directe");
  let concepts: ConceptePivot[] = (ev.concepts ?? []).map((c) => ({
    ...c,
    valors: [...c.valors],
  }));
  concepts = await aplicarBaseGestioPersonalEvolucioLn(lnId, year, concepts);
  concepts = await aplicarVistaGestioEvolucioLn(lnId, year, concepts);
  return concepts;
}

async function pctForLn(
  ln: { id: string; codi: string; nom: string },
  year: number,
  grup: GrupEmpresa
): Promise<PctAnualLnRow> {
  const concepts = await evolucioLnVistaGestio(ln.id, year, grup);
  const t = totalsFromConcepts(concepts);
  return {
    lnCodi: ln.codi,
    lnNom: ln.nom,
    ...t,
  };
}

export async function buildPctAnualGestio(
  year: number,
  grupRaw?: string | null
): Promise<PctAnualResponse> {
  const grup = parseGrupEmpresa(grupRaw) || GRUP_EMPRESA_DEFAULT;
  const arbre = await getArbreSeleccio();
  const linies = liniesPerConsultaDetall(
    arbre.map((l) => ({ id: l.id, codi: l.codi, nom: l.nom })),
    grup
  ).filter((l) => l.codi !== "LN00000");

  const lnsDb = await db.liniaNegoci.findMany({
    where: {
      isActive: true,
      codi: { in: linies.map((l) => l.codi) },
    },
    orderBy: [{ ordre: "asc" }, { codi: "asc" }],
    select: { id: true, codi: true, nom: true },
  });

  const lines = await Promise.all(lnsDb.map((ln) => pctForLn(ln, year, grup)));

  const general: PctAnualTotals = {
    ingressos: round2(lines.reduce((s, r) => s + r.ingressos, 0)),
    compres: round2(lines.reduce((s, r) => s + r.compres, 0)),
    gestio: round2(lines.reduce((s, r) => s + r.gestio, 0)),
    pctCompres: null,
    pctGestio: null,
  };
  general.pctCompres = pctSobreIngressos(general.compres, general.ingressos);
  general.pctGestio = pctSobreIngressos(general.gestio, general.ingressos);

  return {
    year,
    vista: "gestio",
    grup,
    general,
    lines,
  };
}
