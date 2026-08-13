/**
 * Capes del compte d'explotació (cadena acumulativa).
 *
 * SAP → Ajustos (només delta) → Directe (SAP+ajustos) → + Traspassos → Gestió (+repartiment)
 */
export type VistaCompte = "sap" | "ajustos" | "directe" | "traspassos" | "gestio";

/** Totes les capes del C.Explotació. */
export const VISTA_COMPTE_CADENA: VistaCompte[] = [
  "sap",
  "ajustos",
  "directe",
  "traspassos",
  "gestio",
];

/** SAP / Ajustos / Directe (sense capes de Gestió). */
export const VISTA_COMPTE_SENSE_GESTIO: VistaCompte[] = ["sap", "ajustos", "directe"];

/** Només Directe/Gestió (cost personal, cost salarial, etc.). */
export const VISTA_COMPTE_BINARIA: VistaCompte[] = ["directe", "gestio"];

export function parseVistaCompte(
  raw: string | undefined | null,
  opts?: { permetCapesGestio?: boolean }
): VistaCompte {
  const permet = opts?.permetCapesGestio !== false;
  if (raw === "sap") return "sap";
  if (raw === "ajustos") return "ajustos";
  if (permet && raw === "traspassos") return "traspassos";
  if (permet && raw === "gestio") return "gestio";
  return "directe";
}

export function etiquetaVistaCompte(vista: VistaCompte): string {
  switch (vista) {
    case "sap":
      return "SAP";
    case "ajustos":
      return "Ajustos";
    case "directe":
      return "Directe";
    case "traspassos":
      return "+ Traspassos";
    case "gestio":
      return "Gestió";
  }
}

export function vistaInclouAjustos(vista: VistaCompte): boolean {
  return vista !== "sap";
}

/** Només la capa d’ajustos (Directe − SAP), sense el saldo SAP. */
export function vistaNomesAjustos(vista: VistaCompte): boolean {
  return vista === "ajustos";
}

export function vistaInclouTraspassos(vista: VistaCompte): boolean {
  return vista === "traspassos" || vista === "gestio";
}

export function vistaInclouRepartiment(vista: VistaCompte): boolean {
  return vista === "gestio";
}

/** Capes que requereixen permisos de Gestió (repartiment / traspass agregat). */
export function vistaRequereixGestio(vista: VistaCompte): boolean {
  return vista === "traspassos" || vista === "gestio";
}
