/** Nodes del bloc personal al compte d'explotació. */
export const NODE_SOUS_SALARIS = 13;
export const NODE_INDEMNITZACIONS = 14;
export const NODE_SEGURETAT_SOCIAL = 15;
export const NODE_ALTRES_DESPESES_SOCIALS = 16;
export const NODE_TOTAL_COST_SALARIAL = 17;
/** Contractes ETT (detall dins TOTAL COST SALARIAL). */
export const NODE_CONTRACTES_ETT = 44;

/** Detalls que sumen al subtotal 17 (repartiment, gestió, comparativa SAP). */
export const NODES_PERSONAL_DETALL = [
  NODE_SOUS_SALARIS,
  NODE_INDEMNITZACIONS,
  NODE_SEGURETAT_SOCIAL,
  NODE_ALTRES_DESPESES_SOCIALS,
  NODE_CONTRACTES_ETT,
] as const;

export const NODES_PERSONAL_COMpte = [...NODES_PERSONAL_DETALL, NODE_TOTAL_COST_SALARIAL] as const;

export function esNodePersonalCompte(node: number): boolean {
  return (NODES_PERSONAL_COMpte as readonly number[]).includes(node);
}

/** Suma valors SAP/directe del bloc personal (exclou el subtotal 17). */
export function sumaNodesPersonalDetall(nodes: Map<number, number> | undefined): number {
  if (!nodes) return 0;
  return NODES_PERSONAL_DETALL.reduce((s, n) => s + (nodes.get(n) ?? 0), 0);
}

/** Quin import del payroll aplica a cada node (signe positiu; Gestió el fa negatiu). */
export type CampPayroll = "importBrut" | "totalSegSocial" | "costPersonal" | "zero";

export function campPayrollPerNode(node: number): CampPayroll | null {
  switch (node) {
    case NODE_SOUS_SALARIS:
      return "importBrut";
    case NODE_INDEMNITZACIONS:
    case NODE_ALTRES_DESPESES_SOCIALS:
    case NODE_CONTRACTES_ETT:
      return "zero";
    case NODE_SEGURETAT_SOCIAL:
      return "totalSegSocial";
    case NODE_TOTAL_COST_SALARIAL:
      return "costPersonal";
    default:
      return null;
  }
}
