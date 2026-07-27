import type { GrupConsolidacio, TipusNormaConsolidacio } from "@prisma/client";

export type NormaConsolidacioSeed = {
  codi: string;
  nom: string;
  descripcio: string;
  grup: GrupConsolidacio;
  tipus: TipusNormaConsolidacio;
  ordre: number;
  actiu: boolean;
  nodeExcloure?: number;
  nodesAjust?: number[];
  grupEmpresaOrigen?: string;
  nodeOrigen?: number;
  grupEmpresaDesti?: string;
  nodeDesti?: number;
};

/** Nodes SAP rellevants per a les regles de consolidació. */
export const NODE_CONSUMS_INTERNS = 9;
export const NODE_MOVIMENTS_INTERNS = 29;
export const NODE_ALTRES_INGRESSOS = 4;
export const NODE_COMPRES_DETALL = 7;

export const NORMES_CONSOLIDACIO_SEED: NormaConsolidacioSeed[] = [
  {
    codi: "CALBLAY_CONSUMS_INTERNS",
    nom: "Consums interns (Central → LN)",
    descripcio:
      "Les compres de Central apareixen com a COMPRES a LN00000 i com a CONSUMS INTERNS a les LN operatives. El total empresa elimina el doble comptatge.",
    grup: "CALBLAY_INTRA",
    tipus: "EXCLURE_NODE",
    ordre: 10,
    actiu: true,
    nodeExcloure: NODE_CONSUMS_INTERNS,
    nodesAjust: [11, 12, 32, 40, 42],
  },
  {
    codi: "CALBLAY_MOVIMENTS_INTERNS",
    nom: "Moviments interns",
    descripcio:
      "Elimina moviments interns entre LN del grup Cal Blay abans de calcular el total empresa.",
    grup: "CALBLAY_INTRA",
    tipus: "EXCLURE_NODE",
    ordre: 20,
    actiu: true,
    nodeExcloure: NODE_MOVIMENTS_INTERNS,
    nodesAjust: [30, 31, 32, 40, 42],
  },
  {
    codi: "GRUP_COMPRES_FDLC_CONSUMS",
    nom: "Compres Cal Blay ↔ consums FDLC",
    descripcio:
      "Pendent: eliminar parell compra Cal Blay (node 7 / LN00000) i consum intern FDLC (node 9). Activar quan la consulta Consolidat estigui operativa.",
    grup: "GRUP_EMPRESARIAL",
    tipus: "ELIMINAR_PARELL_INTER",
    ordre: 110,
    actiu: false,
    grupEmpresaOrigen: "calblay",
    nodeOrigen: NODE_COMPRES_DETALL,
    grupEmpresaDesti: "fdlc",
    nodeDesti: NODE_CONSUMS_INTERNS,
  },
  {
    codi: "GRUP_LLOGUER_CANON",
    nom: "Lloguer / cànon espais (Cal Blay → FDLC)",
    descripcio:
      "Pendent: eliminar parell despesa Cal Blay i ingress FDLC (node 4 Altres ingressos). Confirmar node contrapartida Cal Blay abans d'activar.",
    grup: "GRUP_EMPRESARIAL",
    tipus: "ELIMINAR_PARELL_INTER",
    ordre: 120,
    actiu: false,
    grupEmpresaOrigen: "fdlc",
    nodeOrigen: NODE_ALTRES_INGRESSOS,
    grupEmpresaDesti: "calblay",
    nodeDesti: 26,
  },
];
