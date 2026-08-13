/**
 * LN amb import fix/% assignat com a destí (es resta del pool SAP Central).
 * LN00000 és una LN destí més (no només «el residual»).
 */
export const CODIS_LN_PERSONAL_CONFIG = [
  "LN00000",
  "LN00001",
  "LN00004",
  "LN00005",
  "LN00006",
] as const;

/** Sobrant del pool Central: mix parts iguals + pes de vendes (fraccions editables). */
export const CODIS_LN_PERSONAL_COMERCIAL = ["LN00002", "LN00003"] as const;

/** Defecte: fracció del sobrant a parts iguals entre LN comercials. */
export const FRACCIO_SOBRANT_IGUALS_DEFECTE = 0.5;

/** Marca als moviments: el mes ja té la regla mix iguals + vendes. */
export const MARCA_SOBRANT_PERSONAL = "sobrant mix iguals+vendes";

export type CodiLnPersonalConfig = (typeof CODIS_LN_PERSONAL_CONFIG)[number];
export type CodiLnPersonalComercial = (typeof CODIS_LN_PERSONAL_COMERCIAL)[number];

export function clampFraccio01(n: number): number {
  if (!Number.isFinite(n)) return FRACCIO_SOBRANT_IGUALS_DEFECTE;
  return Math.min(1, Math.max(0, n));
}

function pctEtiqueta(fraccio: number): string {
  const pct = Math.round(clampFraccio01(fraccio) * 1000) / 10;
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
}

/** Marca amb la fracció vigent, p.ex. «sobrant mix iguals+vendes 60/40». */
export function marcaSobrantPersonal(fraccioIguals: number): string {
  const iguals = clampFraccio01(fraccioIguals);
  return `${MARCA_SOBRANT_PERSONAL} ${pctEtiqueta(iguals)}/${pctEtiqueta(1 - iguals)}`;
}

/** Fracció a parts iguals desada al detall del moviment, o null si no hi ha regla. */
export function fraccioIgualsDesDeDetall(detall: string | null | undefined): number | null {
  if (!detall) return null;
  const mix = detall.match(
    /sobrant mix iguals\+vendes\s+(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/
  );
  if (mix?.[1]) {
    const n = Number(mix[1].replace(",", "."));
    return Number.isFinite(n) ? clampFraccio01(n / 100) : null;
  }
  if (detall.includes("50% iguals + 50% vendes")) return 0.5;
  if (detall.includes(MARCA_SOBRANT_PERSONAL)) return FRACCIO_SOBRANT_IGUALS_DEFECTE;
  return null;
}

export function personalSobrantAlDia(
  detall: string | null | undefined,
  fraccioVigent: number
): boolean {
  const aplicada = fraccioIgualsDesDeDetall(detall);
  if (aplicada == null) return false;
  return Math.abs(aplicada - clampFraccio01(fraccioVigent)) < 0.0005;
}
