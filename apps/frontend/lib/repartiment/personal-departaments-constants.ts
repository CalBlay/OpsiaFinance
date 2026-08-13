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

/** Sobrant del pool Central: 50% a parts iguals 02/03; 50% pel pes de vendes. */
export const CODIS_LN_PERSONAL_COMERCIAL = ["LN00002", "LN00003"] as const;

/** Fracció del sobrant que es reparteix a parts iguals entre LN comercials. */
export const FRACCIO_SOBRANT_IGUALS = 0.5;

/** Fracció del sobrant que es reparteix pel pes de vendes 02/(02+03). */
export const FRACCIO_SOBRANT_VENDES = 0.5;

/** Marca als moviments: el mes ja té la regla 50% iguals + 50% vendes. */
export const MARCA_SOBRANT_PERSONAL = "50% iguals + 50% vendes";

export type CodiLnPersonalConfig = (typeof CODIS_LN_PERSONAL_CONFIG)[number];
export type CodiLnPersonalComercial = (typeof CODIS_LN_PERSONAL_COMERCIAL)[number];
