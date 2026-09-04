import type { UserRole } from "@/types";

/** Pot carregar dades i fer ajustos (no configuració del sistema). */
export function potEditar(role: UserRole | string | undefined | null): boolean {
  return role === "ADMIN" || role === "EDICIO";
}

/** Accés a Dades (importacions, ajustos, etc.). */
export function potAdministrar(role: UserRole | string | undefined | null): boolean {
  return potEditar(role);
}

/** Accés a Configuració del sistema. Només ADMIN. */
export function potConfigurar(role: UserRole | string | undefined | null): boolean {
  return role === "ADMIN";
}

/** Gestió d'usuaris i configuració. */
export function esAdmin(role: UserRole | string | undefined | null): boolean {
  return role === "ADMIN";
}
