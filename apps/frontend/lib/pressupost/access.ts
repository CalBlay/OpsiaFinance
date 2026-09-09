import { db } from "@/lib/db";
import { esPressupostDeptOnly } from "@/lib/nav-access";
import { esSuperOAdmin } from "@/lib/roles";
import type { UserRole } from "@/types";

export { esPressupostDeptOnly };

/** Veu tots els departaments al catàleg Tipus B (no filtrat). */
export function potVeureTotsDepartamentsPressupost(
  role: UserRole | string | undefined | null
): boolean {
  return esSuperOAdmin(role) || role === "EDICIO" || role === "CONSULTA";
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
 * ADMIN/SUPER/EDICIO: tots. PRESSUPOST_DEPT: només els assignats. CONSULTA: no.
 */
export async function potEditarPressupostDepartament(opts: {
  userId: string;
  role: UserRole | string | undefined | null;
  departamentId: string;
}): Promise<boolean> {
  if (esSuperOAdmin(opts.role) || opts.role === "EDICIO") return true;
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
