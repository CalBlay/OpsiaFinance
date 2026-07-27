/**
 * Mapatge comptes PGC del P&L hotel FDLC → nodes del compte d'explotació (SAP).
 */

/** Nodes d'ingressos: signe positiu al model canònic. */
export const FDLC_NODES_INGRESS = new Set([2, 3, 4, 33, 36]);

/** Nodes nous de detall per FDLC (gestió). */
export const FDLC_NODE_NETEJA = 46;
export const FDLC_NODE_SOFTWARE = 47;

export function normalitzarCodiCompte(cuenta: string | number): string {
  return String(cuenta).trim().replace(/\s/g, "");
}

/** Mapatge explícit per subcompte (ingressos separats per KPI). */
const COMPTES_EXPLICIT: Record<string, number> = {
  "70500001": 2, // Allotjaments hotel → Vendes
  "70500002": 3, // Serveis restaurant → Prestació de serveis
  "75200000": 4, // Lloguers i canon → Altres ingressos
};

export function digitsCodiCompte(cuenta: string | number): string {
  return normalitzarCodiCompte(cuenta).replace(/\D/g, "");
}

export function prefixPg3(cuenta: string | number): string {
  const d = digitsCodiCompte(cuenta);
  return d.length >= 3 ? d.slice(0, 3) : d;
}

export function esSubcomptePg(cuenta: string | number): boolean {
  return digitsCodiCompte(cuenta).length > 3;
}

function normalitzarDesc(descripcio: string): string {
  return descripcio.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
}

/**
 * Retorna el node del compte d'explotació per a una fila del P&L FDLC.
 * `null` = fila a ignorar (p.ex. 129 P&G).
 */
export function mapFdlcCompte(cuenta: string | number, descripcio: string): number | null {
  const codi = normalitzarCodiCompte(cuenta);
  const digits = digitsCodiCompte(cuenta);
  if (!digits) return null;

  const desc = normalitzarDesc(descripcio);

  // Resultat comptable — no s'importa
  if (digits.startsWith("129")) return null;

  // ─── Ingressos (subcomptes explícits) ────────────────────────────────────
  const explicit = COMPTES_EXPLICIT[digits];
  if (explicit !== undefined) return explicit;

  if (digits.startsWith("705") || codi.startsWith("705")) {
    if (/RESTAURANT|SERVEIS\s*RESTAUR/.test(desc)) return 3;
    if (/ALLOTJ|HOTEL|HABITACI/.test(desc)) return 2;
    return 2;
  }
  if (digits.startsWith("752") || codi.startsWith("752")) return 4;

  // ─── Compres ─────────────────────────────────────────────────────────────
  if (digits.startsWith("602")) return 8;
  if (digits.startsWith("609") || digits.startsWith("608") || digits.startsWith("607")) return 7;
  if (digits.startsWith("600") || digits.startsWith("601")) return 7;
  if (/^60/.test(digits)) return 7;

  // ─── Personal (640, 642, 646, 649…) ─────────────────────────────────────
  if (digits.startsWith("640")) return 13;
  if (digits.startsWith("641")) return 14;
  if (digits.startsWith("642")) return 15;
  if (digits.startsWith("646") || digits.startsWith("649")) return 16;

  // ─── Gestió ──────────────────────────────────────────────────────────────
  if (digits.startsWith("622")) return 19;
  if (digits.startsWith("623")) return 20;
  if (digits.startsWith("625")) return 22;
  if (digits.startsWith("626")) return 23;
  if (digits.startsWith("628")) return 25;
  if (digits.startsWith("629")) {
    if (/NETEJA/.test(desc)) return FDLC_NODE_NETEJA;
    if (/SAGE|PAYCOMET|SOFTWARE|QUOTA|SUBSCRIP/.test(desc)) return FDLC_NODE_SOFTWARE;
    return 26;
  }
  if (digits.startsWith("621")) return 26;
  if (digits.startsWith("624")) return 24;
  if (digits.startsWith("627")) return 27;

  // ─── Financer, excepcional, amortitzacions, impostos ───────────────────
  if (digits.startsWith("662") || digits.startsWith("661") || digits.startsWith("665")) return 34;
  if (digits.startsWith("769") || digits.startsWith("762") || digits.startsWith("768")) return 33;
  if (digits.startsWith("681") || digits.startsWith("680")) return 39;
  if (digits.startsWith("678") || digits.startsWith("677")) return 37;
  if (digits.startsWith("778") || digits.startsWith("771")) return 36;
  if (digits.startsWith("630") || digits.startsWith("631") || digits.startsWith("633")) return 41;

  return null;
}

/** Normalitza l'import al criteri SAP (ingressos +, despeses −). */
export function normalitzarImportFdlc(node: number, raw: number): number {
  if (raw === 0) return 0;
  if (FDLC_NODES_INGRESS.has(node)) {
    return raw < 0 ? -raw : raw;
  }
  return raw > 0 ? -raw : raw;
}
