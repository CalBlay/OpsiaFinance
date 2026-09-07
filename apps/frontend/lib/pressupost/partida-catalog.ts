import { db } from "@/lib/db";
import { CATEGORIES_TIPUS_B_DEFAULT, slugCategoria } from "@/lib/pressupost/tipus-b";

/**
 * Catàleg de categories Tipus B (taula PressupostPartidaCatalog).
 * Cada fila = una categoria, amb visibilitat per departament.
 */
export const CATEGORIES_CATALOG_SEED = CATEGORIES_TIPUS_B_DEFAULT.map((c, i) => ({
  codi: c.key.toUpperCase(),
  nom: c.label,
  /** Clau estable usada a les línies de pressupost. */
  key: c.key,
  ordre: i,
}));

/**
 * Crea les categories per defecte si encara no existeixen (per codi).
 * Visibles a tots els departaments. No modifica les ja creades.
 */
export async function ensureCategoriesCatalogDefault(): Promise<void> {
  for (const c of CATEGORIES_CATALOG_SEED) {
    const existent = await db.pressupostPartidaCatalog.findUnique({
      where: { codi: c.codi },
      select: { id: true },
    });
    if (existent) continue;
    await db.pressupostPartidaCatalog.create({
      data: {
        codi: c.codi,
        nom: c.nom,
        categoria: c.key,
        totsDepartaments: true,
        isActive: true,
        ordre: c.ordre,
      },
    });
  }
}

/** @deprecated usa ensureCategoriesCatalogDefault */
export const ensurePartidesCatalogDefault = ensureCategoriesCatalogDefault;
/** @deprecated usa CATEGORIES_CATALOG_SEED */
export const PARTIDES_CATALOG_SEED = CATEGORIES_CATALOG_SEED;

export type CategoriaCatalogDeptOpt = {
  id: string;
  codi: string;
  nom: string;
};

export type CategoriaCatalogRow = {
  id: string;
  codi: string;
  nom: string;
  /** Clau d’agregació (camp DB `categoria`). */
  key: string;
  notes: string | null;
  totsDepartaments: boolean;
  isActive: boolean;
  ordre: number;
  departamentIds: string[];
};

export type CategoriaCatalogOpt = {
  id: string;
  codi: string;
  nom: string;
  key: string;
};

/** @deprecated */
export type PartidaCatalogDeptOpt = CategoriaCatalogDeptOpt;
/** @deprecated */
export type PartidaCatalogRow = CategoriaCatalogRow & { categoria: string };
/** @deprecated */
export type PartidaCatalogOpt = CategoriaCatalogOpt & { categoria: string };

/** Departaments Central (Oficines + Cuina + altres amb dim-3) per al selector. */
export async function listDepartamentsPerCatalog(): Promise<CategoriaCatalogDeptOpt[]> {
  const { carregarArbreDeptSc } = await import("@/lib/repartiment/personal-departaments-data");
  const arbre = await carregarArbreDeptSc();
  return arbre.flatMap((c) =>
    c.departaments.map((d) => ({
      id: d.id,
      codi: d.codi,
      nom: `${d.nom} (${c.centreCodi})`,
    }))
  );
}

export async function listCategoriesCatalog(): Promise<CategoriaCatalogRow[]> {
  await ensureCategoriesCatalogDefault();
  const rows = await db.pressupostPartidaCatalog.findMany({
    orderBy: [{ ordre: "asc" }, { nom: "asc" }],
    select: {
      id: true,
      codi: true,
      nom: true,
      categoria: true,
      notes: true,
      totsDepartaments: true,
      isActive: true,
      ordre: true,
      depts: { select: { departamentId: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    codi: r.codi,
    nom: r.nom,
    key: r.categoria,
    notes: r.notes,
    totsDepartaments: r.totsDepartaments,
    isActive: r.isActive,
    ordre: r.ordre,
    departamentIds: r.depts.map((d) => d.departamentId),
  }));
}

/** @deprecated */
export async function listPartidesCatalog(): Promise<PartidaCatalogRow[]> {
  const rows = await listCategoriesCatalog();
  return rows.map((r) => ({ ...r, categoria: r.key }));
}

/** Categories actives visibles per a un departament (pressupost Tipus B). */
export async function listCategoriesCatalogPerDept(
  departamentId: string
): Promise<CategoriaCatalogOpt[]> {
  await ensureCategoriesCatalogDefault();
  const rows = await db.pressupostPartidaCatalog.findMany({
    where: {
      isActive: true,
      OR: [{ totsDepartaments: true }, { depts: { some: { departamentId } } }],
    },
    orderBy: [{ ordre: "asc" }, { nom: "asc" }],
    select: { id: true, codi: true, nom: true, categoria: true },
  });
  return rows.map((r) => ({
    id: r.id,
    codi: r.codi,
    nom: r.nom,
    key: r.categoria,
  }));
}

/** @deprecated */
export async function listPartidesCatalogPerDept(
  departamentId: string
): Promise<PartidaCatalogOpt[]> {
  const rows = await listCategoriesCatalogPerDept(departamentId);
  return rows.map((r) => ({ ...r, categoria: r.key }));
}

export function generaCodiCategoria(nom: string): string {
  const base = slugCategoria(nom).replace(/_/g, "-").slice(0, 40) || "categoria";
  return base.toUpperCase();
}

/** @deprecated */
export function generaCodiPartida(nom: string): string {
  return generaCodiCategoria(nom);
}
