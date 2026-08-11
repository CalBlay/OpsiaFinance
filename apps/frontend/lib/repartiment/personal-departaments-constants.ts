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

/** Sobrant del pool Central: pes = vendes_i / (vendes02 + vendes03). */
export const CODIS_LN_PERSONAL_COMERCIAL = ["LN00002", "LN00003"] as const;

export type CodiLnPersonalConfig = (typeof CODIS_LN_PERSONAL_CONFIG)[number];
export type CodiLnPersonalComercial = (typeof CODIS_LN_PERSONAL_COMERCIAL)[number];
