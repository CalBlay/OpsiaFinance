/** Nodes del bloc personal al compte d'explotació. */
export const NODE_SOUS_SALARIS = 13;
export const NODE_INDEMNITZACIONS = 14;
export const NODE_SEGURETAT_SOCIAL = 15;
export const NODE_ALTRES_DESPESES_SOCIALS = 16;
export const NODE_TOTAL_COST_SALARIAL = 17;

export const NODES_PERSONAL_DETALL = [
  NODE_SOUS_SALARIS,
  NODE_INDEMNITZACIONS,
  NODE_SEGURETAT_SOCIAL,
  NODE_ALTRES_DESPESES_SOCIALS,
] as const;

export function esNodePersonalCompte(node: number): boolean {
  return node >= NODE_SOUS_SALARIS && node <= NODE_TOTAL_COST_SALARIAL;
}

/** Quin import del payroll aplica a cada node (signe positiu; Gestió el fa negatiu). */
export type CampPayroll = "importBrut" | "totalSegSocial" | "costPersonal" | "zero";

export function campPayrollPerNode(node: number): CampPayroll | null {
  switch (node) {
    case NODE_SOUS_SALARIS:
      return "importBrut";
    case NODE_INDEMNITZACIONS:
    case NODE_ALTRES_DESPESES_SOCIALS:
      return "zero";
    case NODE_SEGURETAT_SOCIAL:
      return "totalSegSocial";
    case NODE_TOTAL_COST_SALARIAL:
      return "costPersonal";
    default:
      return null;
  }
}
