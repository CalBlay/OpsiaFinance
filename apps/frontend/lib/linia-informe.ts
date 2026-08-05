import type { Prisma } from "@prisma/client";

/** Dada amb LN de l'informe (fitxer importat). */
export type DadaAmbInforme = {
  liniaNegociId: string | null;
  centreId: string | null;
  senseCentre: boolean;
  importacio: { liniaNegociId: string | null };
};

/**
 * LN sota la qual una dada ha d'aparèixer a les consultes per columna LN.
 *
 * Els informes SAP (p.ex. 01_2025_00 = Central) inclouen columnes de centres
 * d'altres LN de l'arbre; totes pertanyen al compte de la LN del fitxer.
 */
export function lnInformePerAgregacio(d: DadaAmbInforme): string | null {
  if (d.centreId || d.senseCentre) {
    return d.importacio.liniaNegociId ?? d.liniaNegociId;
  }
  return d.liniaNegociId ?? d.importacio.liniaNegociId;
}

/**
 * Columna «total LN» del mateix fitxer de la LN (p.ex. columna RESTAURANTS
 * dins l'Excel de Restaurants). És la suma dels centres: si la suméssim
 * amb el detall, les consultes sortiria el doble.
 *
 * No afecta columnes LN d'un altre informe (p.ex. Central amb columna RESTAURANTS).
 */
export function esColumnaTotalLnRedundant(d: DadaAmbInforme): boolean {
  if (d.centreId || d.senseCentre) return false;
  const lnCol = d.liniaNegociId;
  const lnInforme = d.importacio.liniaNegociId;
  return !!lnCol && !!lnInforme && lnCol === lnInforme;
}

export function resolveLiniaNegociImport(
  col: {
    centreId: string | null;
    liniaNegociId: string | null;
    senseCentre: boolean;
    isLnColumna?: boolean;
  },
  lnInformeId: string | null
): string | null {
  if (col.senseCentre) return lnInformeId;
  if (col.centreId) return lnInformeId ?? col.liniaNegociId;
  if (col.isLnColumna) return col.liniaNegociId;
  return lnInformeId ?? col.liniaNegociId;
}

/**
 * Where Prisma equivalent a:
 *   !esColumnaTotalLnRedundant(d) && lnInformePerAgregacio(d) === L
 *
 * No usa mai `centre.liniaNegociId` (seria incorrecte per a informes SAP).
 */
export function prismaWhereDadaPerLnInforme(liniaNegociId: string): Prisma.DadaResultatWhereInput {
  return {
    AND: [
      // ¬ esColumnaTotalLnRedundant quan ambdues LN són L
      {
        NOT: {
          AND: [
            { centreId: null },
            { senseCentre: false },
            { liniaNegociId },
            { importacio: { liniaNegociId } },
          ],
        },
      },
      {
        OR: [
          // Centre / Sin Centro → importacio ?? dada
          {
            AND: [
              { OR: [{ centreId: { not: null } }, { senseCentre: true }] },
              {
                OR: [
                  { importacio: { liniaNegociId } },
                  {
                    AND: [{ importacio: { liniaNegociId: null } }, { liniaNegociId }],
                  },
                ],
              },
            ],
          },
          // Columna LN pura → dada ?? importacio
          {
            AND: [
              { centreId: null },
              { senseCentre: false },
              {
                OR: [
                  { liniaNegociId },
                  {
                    AND: [{ liniaNegociId: null }, { importacio: { liniaNegociId } }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

/**
 * Candidats SQL per a un conjunt de LN (grup Cal Blay / FDLC / consolidat).
 *
 * Prisma no pot expressar `dada.liniaNegociId = importacio.liniaNegociId`
 * per excloure totals redundants quan hi ha diverses LN: el caller ha de
 * continuar filtrant amb `esColumnaTotalLnRedundant` + pertenència al set.
 *
 * Amb 1 LN delega al filtre exacte.
 */
export function prismaWhereDadaPerLnInformeIds(lnIds: string[]): Prisma.DadaResultatWhereInput {
  if (lnIds.length === 0) return { id: { in: [] } };
  const primerLnId = lnIds[0];
  if (lnIds.length === 1 && primerLnId) return prismaWhereDadaPerLnInforme(primerLnId);

  return {
    OR: [
      {
        AND: [
          { OR: [{ centreId: { not: null } }, { senseCentre: true }] },
          {
            OR: [
              { importacio: { liniaNegociId: { in: lnIds } } },
              {
                AND: [{ importacio: { liniaNegociId: null } }, { liniaNegociId: { in: lnIds } }],
              },
            ],
          },
        ],
      },
      {
        AND: [
          { centreId: null },
          { senseCentre: false },
          {
            OR: [
              { liniaNegociId: { in: lnIds } },
              {
                AND: [{ liniaNegociId: null }, { importacio: { liniaNegociId: { in: lnIds } } }],
              },
            ],
          },
        ],
      },
    ],
  };
}
