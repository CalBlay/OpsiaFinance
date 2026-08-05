import type { UserRole } from "@/types";

/** Pot carregar dades i editar configuració operativa (no usuaris). */
export function potEditar(role: UserRole | string | undefined | null): boolean {
  return role === "ADMIN" || role === "EDICIO";
}

/** Accés a Administració (Dades + Configuració). */
export function potAdministrar(role: UserRole | string | undefined | null): boolean {
  return potEditar(role);
}

/** Només gestió d'usuaris. */
export function esAdmin(role: UserRole | string | undefined | null): boolean {
  return role === "ADMIN";
}
