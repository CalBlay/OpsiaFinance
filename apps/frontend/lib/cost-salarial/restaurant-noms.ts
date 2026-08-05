/**
 * Mapeig noms Excel (Cost salarial / Vendes) ↔ centres LN00001.
 *
 * Clau canònica = `clauRestaurant(nom)` + aliases.
 * Exemples que han de coincidir:
 *   Excel «Masia Esplugues»  ↔  BD «Restaurant Masia d'Esplugues»
 *   Excel «Camp Nou»         ↔  BD «Camp Nou Cal Blay»
 */

/** Variants conegudes → clau canònica. */
export const ALIASES_RESTAURANT: Record<string, string> = {
  // —— Fitxer cost salarial (Nom Restaurant) ——
  origens: "origens",
  nautic: "nautic",
  "el nautic": "nautic",
  "masia esplugues": "masia esplugues",
  "masia d esplugues": "masia esplugues",
  "masia desplugues": "masia esplugues",
  mirador: "mirador",
  "el mirador": "mirador",
  "camp nou": "camp nou",
  "camp nou cal blay": "camp nou",
  "tarraco arena": "tarraco arena",
  "juno house": "juno house",
  // —— Altres restaurants LN (altres Excels) ——
  plural: "plural",
  soliver: "soliver",
  greenvita: "greenvita",
  "green vita": "greenvita",
  "green-vita": "greenvita",
};

/**
 * Clau comparable: minúscules, sense accents / apòstrofs / partícules (d', de, la…).
 * «Masia d'Esplugues» i «Masia Esplugues» → «masia esplugues».
 */
export function clauRestaurant(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/^restaurant\s+/i, "")
    .replace(/[''`´]/g, " ")
    .replace(/\b(d|de|del|dels|la|l|el|els|les|i)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalitza un nom de restaurant per enllaçar Excel ↔ centre (BD). */
export function normalitzaNomRestaurant(nom: string): string {
  const s = clauRestaurant(nom);
  return ALIASES_RESTAURANT[s] ?? s;
}

/** Indexa un centre sota totes les claus / aliases que hi apunten. */
export function indexaCentrePerNom<T extends { nom: string }>(
  byNom: Map<string, T>,
  centre: T
): void {
  const canon = normalitzaNomRestaurant(centre.nom);
  byNom.set(canon, centre);
  const raw = clauRestaurant(centre.nom);
  if (raw) byNom.set(raw, centre);
  for (const [alias, target] of Object.entries(ALIASES_RESTAURANT)) {
    if (target === canon) byNom.set(alias, centre);
  }
}

/** Restaurants del fitxer tipus cost salarial (per documentació / tests). */
export const RESTAURANTS_FITXER_COST_SALARIAL = [
  "Origens",
  "Nautic",
  "Masia Esplugues",
  "Mirador",
  "Camp Nou",
  "Tarraco Arena",
  "Juno House",
] as const;
