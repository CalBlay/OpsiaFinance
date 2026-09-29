/**
 * Mapeig organització RRHH (plantilla) → Dimensions.
 * El text es normalitza traient | / || inicials i espais sobrants.
 */

export function normalitzarTextOrgPlantilla(text: string): string {
  return text
    .replace(/^\s*\|+\s*/u, "")
    .replace(/\s+/gu, " ")
    .trim();
}

export function clauMapeigOrgPlantilla(text: string): string {
  return normalitzarTextOrgPlantilla(text).toLocaleLowerCase("ca");
}

export type MapeigOrgPlantillaIndex = Map<
  string,
  { centreId: string; departamentId: string | null }
>;

export function indexarMapeigsOrgPlantilla(
  rows: { text: string; centreId: string; departamentId: string | null; isActive?: boolean }[]
): MapeigOrgPlantillaIndex {
  const map: MapeigOrgPlantillaIndex = new Map();
  for (const r of rows) {
    if (r.isActive === false) continue;
    const k = clauMapeigOrgPlantilla(r.text);
    if (!k) continue;
    map.set(k, { centreId: r.centreId, departamentId: r.departamentId });
  }
  return map;
}

export function resoldreMapeigOrgPlantilla(
  index: MapeigOrgPlantillaIndex,
  textOrg: string
): { centreId: string; departamentId: string | null } | null {
  const k = clauMapeigOrgPlantilla(textOrg);
  if (!k) return null;
  return index.get(k) ?? null;
}
