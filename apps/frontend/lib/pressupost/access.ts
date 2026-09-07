import { db } from "@/lib/db";
import type { UserRole } from "@/types";

/** Rol restringit al pressupost Tipus B dels seus departaments. */
export function esPressupostDeptOnly(role: UserRole | string | undefined | null): boolean {
  return role === "PRESSUPOST_DEPT";
}

/** Veu tots els departaments al catàleg Tipus B (no filtrat). */
export function potVeureTotsDepartamentsPressupost(
  role: UserRole | string | undefined | null
): boolean {
  return role === "ADMIN" || role === "EDICIO" || role === "CONSULTA";
}

export async function listDepartamentIdsUsuari(userId: string): Promise<string[]> {
  const rows = await db.userDepartament.findMany({
    where: { userId },
    select: { departamentId: true },
  });
  return rows.map((r) => r.departamentId);
}

/**
 * Pot editar el pressupost Tipus B d’un departament concret.
 * ADMIN/EDICIO: tots. PRESSUPOST_DEPT: només els assignats. CONSULTA: no.
 */
export async function potEditarPressupostDepartament(opts: {
  userId: string;
  role: UserRole | string | undefined | null;
  departamentId: string;
}): Promise<boolean> {
  if (opts.role === "ADMIN" || opts.role === "EDICIO") return true;
  if (opts.role !== "PRESSUPOST_DEPT") return false;
  if (!opts.departamentId || !opts.userId) return false;
  const n = await db.userDepartament.count({
    where: { userId: opts.userId, departamentId: opts.departamentId },
  });
  return n > 0;
}

/** Pot veure (lectura) el pressupost d’un departament. */
export async function potVeurePressupostDepartament(opts: {
  userId: string;
  role: UserRole | string | undefined | null;
  departamentId: string;
}): Promise<boolean> {
  if (potVeureTotsDepartamentsPressupost(opts.role)) return true;
  return potEditarPressupostDepartament(opts);
}
