import { esRolRestringit, potVeureModul } from "@/lib/nav-access";
import type { NavExtra } from "@/lib/nav-catalog";
import type { UserRole } from "@/types";

/** ADMIN o Super usuari (mateixes capacitats operatives). */
export function esSuperOAdmin(role: UserRole | string | undefined | null): boolean {
  return role === "ADMIN" || role === "SUPER_USUARI";
}

/** Pot carregar dades i fer ajustos (no configuració del sistema). */
export function potEditar(
  role: UserRole | string | undefined | null,
  navExtra?: NavExtra | null
): boolean {
  if (esSuperOAdmin(role) || role === "EDICIO") return true;
  return esRolRestringit(role) && potVeureModul(role, "dades", navExtra);
}

/** Accés a Dades (importacions, ajustos, etc.). */
export function potAdministrar(
  role: UserRole | string | undefined | null,
  navExtra?: NavExtra | null
): boolean {
  return potEditar(role, navExtra);
}

/** Accés a Configuració del sistema (no usuaris). */
export function potConfigurar(
  role: UserRole | string | undefined | null,
  navExtra?: NavExtra | null
): boolean {
  if (esSuperOAdmin(role)) return true;
  return esRolRestringit(role) && potVeureModul(role, "settings", navExtra);
}

/** Gestió d'usuaris (només Administrador). */
export function esAdmin(role: UserRole | string | undefined | null): boolean {
  return role === "ADMIN";
}

/**
 * Mòdul Pressupost.
 * PRESSUPOST_DEPT: només Tipus B dels departaments assignats (+ extras).
 */
export function potPressupost(
  role: UserRole | string | undefined | null,
  navExtra?: NavExtra | null
): boolean {
  if (
    esSuperOAdmin(role) ||
    role === "EDICIO" ||
    role === "CONSULTA" ||
    role === "PRESSUPOST_DEPT"
  ) {
    return true;
  }
  return esRolRestringit(role) && potVeureModul(role, "pressupost", navExtra);
}

/**
 * Pot editar cel·les / crear esborranys de pressupost (àmbit global de rol).
 * El scope per departament es comprova amb `potEditarPressupostDepartament`.
 */
export function potEditarPressupost(role: UserRole | string | undefined | null): boolean {
  return esSuperOAdmin(role) || role === "EDICIO" || role === "PRESSUPOST_DEPT";
}

/** Pot editar pressupost Tipus A (LN / centres). */
export function potEditarPressupostLn(role: UserRole | string | undefined | null): boolean {
  return esSuperOAdmin(role) || role === "EDICIO";
}

/** Veu pestanyes Tipus A / aprovació al mòdul Pressupost. */
export function potVeurePressupostGlobal(role: UserRole | string | undefined | null): boolean {
  return esSuperOAdmin(role) || role === "EDICIO" || role === "CONSULTA";
}
