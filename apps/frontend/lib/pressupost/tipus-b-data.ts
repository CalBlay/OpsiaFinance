import { listCategoriesCatalog } from "@/lib/pressupost/partida-catalog";
import {
  CATEGORIES_TIPUS_B_DEFAULT,
  type CategoriaOpt,
  labelDesDeKey,
} from "@/lib/pressupost/tipus-b";

/**
 * Categories Tipus B: catàleg (Dades) + defaults + claus ja usades a línies.
 */
export async function getCategoriesTipusB(): Promise<CategoriaOpt[]> {
  const catalog = await listCategoriesCatalog();
  const map = new Map<string, string>();
  for (const c of CATEGORIES_TIPUS_B_DEFAULT) {
    map.set(c.key, c.label);
  }
  for (const c of catalog) {
    if (c.isActive) map.set(c.key, c.nom);
  }
  return [...map.entries()].map(([key, label]) => ({ key, label }));
}

/** Etiqueta visible per a una clau (sense DB). */
export function labelCategoriaFallback(key: string): string {
  return labelDesDeKey(key);
}
