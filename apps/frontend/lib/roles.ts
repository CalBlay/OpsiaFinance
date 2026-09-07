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

/**
 * Mòdul Pressupost.
 * PRESSUPOST_DEPT: només Tipus B dels departaments assignats.
 */
export function potPressupost(role: UserRole | string | undefined | null): boolean {
  return role === "ADMIN" || role === "EDICIO" || role === "CONSULTA" || role === "PRESSUPOST_DEPT";
}

/**
 * Pot editar cel·les / crear esborranys de pressupost (àmbit global de rol).
 * El scope per departament es comprova amb `potEditarPressupostDepartament`.
 */
export function potEditarPressupost(role: UserRole | string | undefined | null): boolean {
  return role === "ADMIN" || role === "EDICIO" || role === "PRESSUPOST_DEPT";
}

/** Pot editar pressupost Tipus A (LN / centres). */
export function potEditarPressupostLn(role: UserRole | string | undefined | null): boolean {
  return role === "ADMIN" || role === "EDICIO";
}

/** Veu pestanyes Tipus A / aprovació al mòdul Pressupost. */
export function potVeurePressupostGlobal(role: UserRole | string | undefined | null): boolean {
  return role === "ADMIN" || role === "EDICIO" || role === "CONSULTA";
}
