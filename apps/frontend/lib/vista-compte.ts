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

/** Restauració: resultat final després de traspassos d'hores. */
export const VISTA_COMPTE_RESTAURACIO: VistaCompte[] = ["gestio"];

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

/**
 * Vistes permeses segons rol + navExtra.
 * `null` = cadena completa (comportament habitual).
 * Preferència: scope.vistes desat; si no, defecte RESTAURACIO = Gestió.
 */
export function vistesComptePerUsuari(
  role: string | undefined | null,
  navExtra?: { scope?: { vistes?: readonly string[] } } | null
): readonly VistaCompte[] | null {
  const saved = navExtra?.scope?.vistes;
  if (saved?.length) {
    const ordered = VISTA_COMPTE_CADENA.filter((v) => saved.includes(v));
    return ordered.length ? ordered : VISTA_COMPTE_RESTAURACIO;
  }
  if (role === "RESTAURACIO") return VISTA_COMPTE_RESTAURACIO;
  return null;
}

/** @deprecated Preferir `vistesComptePerUsuari(role, navExtra)`. */
export function vistesComptePerRol(role: string | undefined | null): readonly VistaCompte[] | null {
  return vistesComptePerUsuari(role, null);
}

/** Parseja la vista respectant el rol / permisos (RESTAURACIO → Gestió per defecte). */
export function parseVistaComptePerRol(
  raw: string | undefined | null,
  role: string | undefined | null,
  opts?: {
    permetCapesGestio?: boolean;
    navExtra?: { scope?: { vistes?: readonly string[] } } | null;
  }
): VistaCompte {
  const permeses = vistesComptePerUsuari(role, opts?.navExtra);
  if (permeses?.length) {
    if (raw && (permeses as readonly string[]).includes(raw)) {
      return raw as VistaCompte;
    }
    // Preferència Gestió si està permesa; si no, la primera
    if (permeses.includes("gestio")) return "gestio";
    return permeses[0] ?? "directe";
  }
  return parseVistaCompte(raw, opts);
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

export function vistaNomesAjustos(vista: VistaCompte): boolean {
  return vista === "ajustos";
}

export function vistaInclouTraspassos(vista: VistaCompte): boolean {
  return vista === "traspassos" || vista === "gestio";
}

export function vistaInclouRepartiment(vista: VistaCompte): boolean {
  return vista === "gestio";
}

export function vistaRequereixGestio(vista: VistaCompte): boolean {
  return vista === "traspassos" || vista === "gestio";
}
