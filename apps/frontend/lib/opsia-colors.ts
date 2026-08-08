/**
 * Opsia Finance — Colors corporatius per a gràfics i números (TS).
 * Espill de `styles/opsia-corporate-colors.css`. Preferiu CSS vars als modules CSS;
 * useu aquestes constants quan calgui un hex (Recharts, inline styles).
 *
 * Sense negre pur: text fort = ink (#22313F).
 */

export const OPSIA_GREEN = {
  50: "#f2f7f5",
  100: "#e0ece9",
  200: "#b9d2cc",
  300: "#87b3aa",
  400: "#5a9a8f",
  500: "#3d8579",
  600: "#2f6f6d",
  700: "#245956",
  800: "#1a4442",
} as const;

export const OPSIA_YELLOW = {
  50: "#fbf7ef",
  100: "#f5edd9",
  200: "#e8d5a8",
  300: "#d9bc7a",
  400: "#d0ae68",
  500: "#c59b57",
  600: "#a67f3f",
  700: "#866533",
  800: "#6b5028",
} as const;

export const OPSIA_ORANGE = {
  50: "#faf4ef",
  100: "#f3e4d4",
  200: "#e5c4a0",
  300: "#d4a070",
  400: "#c98a52",
  500: "#b8733d",
  600: "#9a5f32",
  700: "#7c4c28",
  800: "#5f3a1f",
} as const;

/** Text / ink corporatiu (no #000). */
export const OPSIA_INK = {
  strong: "#22313f",
  soft: "#5c6b73",
} as const;

/** Colors de números / deltas. */
export const OPSIA_NUM = {
  positive: OPSIA_GREEN[700],
  positiveFill: OPSIA_GREEN[500],
  warning: OPSIA_YELLOW[700],
  warningFill: OPSIA_YELLOW[500],
  warm: OPSIA_ORANGE[700],
  warmFill: OPSIA_ORANGE[500],
  neutral: OPSIA_INK.soft,
  strong: OPSIA_INK.strong,
} as const;

/** Semàfor. */
export const OPSIA_SEMAFOR = {
  verd: OPSIA_GREEN[500],
  ambre: OPSIA_ORANGE[500],
  groc: OPSIA_YELLOW[500],
} as const;

/**
 * Sèrie per defecte de gràfics (verd → groc → taronja, matisos).
 * Evita índigos/roses genèrics fora de marca.
 */
export const OPSIA_CHART_SERIES = [
  OPSIA_GREEN[600],
  OPSIA_YELLOW[500],
  OPSIA_ORANGE[500],
  OPSIA_GREEN[400],
  OPSIA_YELLOW[400],
  OPSIA_ORANGE[400],
  OPSIA_GREEN[300],
  OPSIA_YELLOW[300],
] as const;

export const OPSIA_CHART = {
  ebitda: OPSIA_GREEN[600],
  ingressos: OPSIA_GREEN[400],
  vendes: OPSIA_GREEN[400],
  personal: OPSIA_GREEN[500],
  compres: OPSIA_YELLOW[500],
  gestio: OPSIA_ORANGE[400],
  cuina: OPSIA_ORANGE[500],
  sala: OPSIA_GREEN[500],
  series: OPSIA_CHART_SERIES,
} as const;

/** Costos clau: Personal / Compres / Gestió. */
export const OPSIA_COST_SERIES = [
  OPSIA_CHART.personal,
  OPSIA_CHART.compres,
  OPSIA_CHART.gestio,
] as const;
