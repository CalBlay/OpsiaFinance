export const NODE_LABELS_FALLBACK: Record<number, string> = {
  2: "VENDES",
  4: "ALTRES INGRESSOS",
  7: "COMPRES",
  8: "ALTRES APROVISIONAMENTS",
  9: "CONSUMS INTERNS",
  11: "TOTAL COMPRES",
  12: "MARGE BRUT",
  18: "ARRENDAMENTS I CANONS",
  29: "MOVIMENTS INTERNS",
  30: "TOTAL DESPESES GESTIO",
  31: "MARGE OPERATIU",
  32: "EBITDA",
  40: "RESULTAT ABANS D'IMPOSTOS",
  42: "RESULTAT DESPRES D'IMPOSTOS",
};

export function labelNode(labels: Record<number, string>, node: number | null | undefined): string {
  if (node == null) return "—";
  return labels[node] ?? NODE_LABELS_FALLBACK[node] ?? `Node ${node}`;
}

export const GRUP_CONSOLIDACIO_LABELS: Record<string, string> = {
  CALBLAY_INTRA: "Cal Blay (intra-empresa)",
  GRUP_EMPRESARIAL: "Grup empresarial (Cal Blay + FDLC)",
};

export const TIPUS_NORMA_LABELS: Record<string, string> = {
  EXCLURE_NODE: "Excloure node",
  ELIMINAR_PARELL_INTER: "Eliminar parell inter-empresa",
};

export const FONT_IMPORT_LABELS: Record<string, string> = {
  MIN_COINCIDENT: "Mínim coincident (cel·les)",
  IMPORT_FIX_MENSUAL: "Import fix mensual (taula)",
};

export const GRUP_EMPRESA_NORMA_LABELS: Record<string, string> = {
  calblay: "Cal Blay",
  fdlc: "FDLC",
};
