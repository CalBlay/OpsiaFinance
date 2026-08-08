import type {
  FontImportConsolidacio,
  GrupConsolidacio,
  TipusNormaConsolidacio,
} from "@prisma/client";

export type NormaConsolidacioImportSeed = {
  any: number;
  mes: number;
  import: number;
  nota?: string;
};

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
  nodesOrigen?: number[];
  nodesDesti?: number[];
  fontImport?: FontImportConsolidacio;
  notaOrigen?: string;
  notaDesti?: string;
  imports?: NormaConsolidacioImportSeed[];
};

/** Nodes SAP rellevants per a les regles de consolidació. */
export const NODE_VENDES = 2;
export const NODE_CONSUMS_INTERNS = 9;
export const NODE_MOVIMENTS_INTERNS = 29;
export const NODE_ALTRES_INGRESSOS = 4;
export const NODE_COMPRES_DETALL = 7;
export const NODE_ALTRES_APROVISIONAMENTS = 8;
export const NODE_ARRENDAMENTS_CANONS = 18;

/** Factures Central → Masia la Blayeta (FDLC), client C019081 · projectes ENTREGUES. */
export const FACTURES_BLAYETA_2026: NormaConsolidacioImportSeed[] = [
  { any: 2026, mes: 1, import: 6209.31, nota: "ENTREGUES GENER LA BLAYETA · C019081" },
  { any: 2026, mes: 2, import: 4892.71, nota: "ENTREGUES FEBRER LA BLAYETA · C019081" },
  { any: 2026, mes: 3, import: 6570.91, nota: "ENTREGUES MARÇ LA BLAYETA · C019081" },
  { any: 2026, mes: 4, import: 7950.45, nota: "ENTREGUES ABRIL LA BLAYETA · C019081" },
  { any: 2026, mes: 5, import: 10414.38, nota: "ENTREGUES MAIG LA BLAYETA · C019081" },
  { any: 2026, mes: 6, import: 6117.73, nota: "ENTREGUES JUNY LA BLAYETA · C019081" },
];

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
    codi: "GRUP_LLOGUER_CANON",
    nom: "Lloguer / cànon espais (Cal Blay → FDLC)",
    descripcio:
      "Cal Blay paga lloguer/cànon (node 18, p.ex. CCB00005) i FDLC el cobra com a altres ingressos (node 4). Al consolidat del grup s'elimina el parell coincident.",
    grup: "GRUP_EMPRESARIAL",
    tipus: "ELIMINAR_PARELL_INTER",
    ordre: 100,
    actiu: true,
    fontImport: "MIN_COINCIDENT",
    grupEmpresaOrigen: "calblay",
    nodeOrigen: NODE_ARRENDAMENTS_CANONS,
    grupEmpresaDesti: "fdlc",
    nodeDesti: NODE_ALTRES_INGRESSOS,
  },
  {
    codi: "GRUP_FACTURA_FDLC_VENDES",
    nom: "Factura subministrament FDLC (Central → Blayeta)",
    descripcio:
      "Cal Blay factura a Masia la Blayeta (FDLC) el subministrament del restaurant. L'ingrés queda dins CCC00002 · Vendes (LN00000) sense cel·la pròpia; la despesa a FDLC als nodes 7+8. Al consolidat s'elimina l'import de la factura (taula mensual). El cost de compra externa a Cal Blay (CCR00008) no s'elimina.",
    grup: "GRUP_EMPRESARIAL",
    tipus: "ELIMINAR_PARELL_INTER",
    ordre: 105,
    actiu: true,
    fontImport: "IMPORT_FIX_MENSUAL",
    grupEmpresaOrigen: "calblay",
    nodeOrigen: NODE_VENDES,
    nodesOrigen: [NODE_VENDES],
    grupEmpresaDesti: "fdlc",
    nodeDesti: NODE_COMPRES_DETALL,
    nodesDesti: [NODE_COMPRES_DETALL, NODE_ALTRES_APROVISIONAMENTS],
    notaOrigen: "LN00000 · CCC00002 CENTRAL · ENTREGUES Masia la Blayeta (C019081)",
    notaDesti: "FDLC · nodes 7 Compres + 8 Altres aprovisionaments",
    imports: FACTURES_BLAYETA_2026,
  },
];
