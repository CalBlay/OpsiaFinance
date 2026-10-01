/** Totes les LN entre les quals es reparteix explícitament cada departament de Central. */
export const CODIS_LN_PERSONAL_CONFIG = [
  "LN00000",
  "LN00001",
  "LN00002",
  "LN00003",
  "LN00004",
  "LN00005",
  "LN00006",
] as const;

/**
 * Centres SC fora del repartiment personal (sencer): el cost va per traspassos
 * i queda comptabilitzat directament a cada LN.
 */
export const CODIS_CENTRE_SC_EXCLOSOS_REPARTIMENT = ["CCC00008"] as const;

/**
 * Departaments SC fora del repartiment (dins d'un centre que sí es reparteix).
 * Ex.: SERVEIS LOGISTICA dins LOGISTICA — va per traspassos a cada LN.
 */
export const CODIS_DEPT_SC_EXCLOSOS_REPARTIMENT = ["DCL0005"] as const;

/** True si tot el centre queda fora del repartiment personal. */
export function esCentreScExclosRepartiment(codi: string, nom?: string | null): boolean {
  const c = codi.trim().toUpperCase();
  if ((CODIS_CENTRE_SC_EXCLOSOS_REPARTIMENT as readonly string[]).includes(c)) {
    return true;
  }
  return /serveis?\s*externs?/i.test(nom ?? "");
}

/** True si el departament (o el seu centre) queda fora del repartiment personal. */
export function esDeptScExclosRepartiment(input: {
  centreCodi: string;
  centreNom?: string | null;
  deptCodi: string;
  deptNom?: string | null;
}): boolean {
  if (esCentreScExclosRepartiment(input.centreCodi, input.centreNom)) return true;
  const dept = input.deptCodi.trim().toUpperCase();
  if ((CODIS_DEPT_SC_EXCLOSOS_REPARTIMENT as readonly string[]).includes(dept)) {
    return true;
  }
  return /serveis?\s*log[ií]stic/i.test(input.deptNom ?? "");
}

/**
 * Compatibilitat amb configuracions antigues. La nova matriu no deixa sobrants
 * automàtics: cada fila de departament ha de sumar el 100%.
 */
export const CODIS_LN_PERSONAL_COMERCIAL = [] as const;

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
