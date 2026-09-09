import type { DadesSub, NavExtra, NavModul, ResultatsSub, SettingsSub } from "@/lib/nav-catalog";
import {
  isRestaurantsPath,
  parseNavExtra,
  resolveConsultesSub,
  resolveDadesSub,
  resolvePressupostSub,
  resolveSettingsSub,
} from "@/lib/nav-catalog";
import type { UserRole } from "@/types";

export type { NavExtra, NavModul };
export { parseNavExtra };

function esAdminRole(role: UserRole | string | undefined | null): boolean {
  return role === "ADMIN";
}

function esSuperOAdminRole(role: UserRole | string | undefined | null): boolean {
  return role === "ADMIN" || role === "SUPER_USUARI";
}

/** Rols amb navegació restringida + extras opcionals. */
export function esRolRestringit(role: UserRole | string | undefined | null): boolean {
  return role === "PRESSUPOST_DEPT" || role === "RESTAURACIO";
}

export function esPressupostDeptOnly(role: UserRole | string | undefined | null): boolean {
  return role === "PRESSUPOST_DEPT";
}

export function esRestauracio(role: UserRole | string | undefined | null): boolean {
  return role === "RESTAURACIO";
}

/** Subpestanyes incloses per defecte al rol (sense extras). */
export function defaultSubs(role: UserRole | string | undefined | null, modul: NavModul): string[] {
  if (role === "PRESSUPOST_DEPT") {
    return modul === "pressupost" ? ["departaments"] : [];
  }
  if (role === "RESTAURACIO") {
    return modul === "restaurants" ? ["quadre-mando", "vendes", "cost-salarial"] : [];
  }
  // Rols oberts: totes les subpestanyes del mòdul (es resol a potVeureSub)
  return ["*"];
}

function extraSubs(extra: NavExtra | null | undefined, modul: NavModul): string[] {
  if (!extra) return [];
  switch (modul) {
    case "inici":
      return extra.inici ? ["*"] : [];
    case "resultats":
      return extra.resultats ?? [];
    case "restaurants":
      return extra.restaurants ?? [];
    case "pressupost":
      return extra.pressupost ?? [];
    case "dades":
      return extra.dades ?? [];
    case "settings":
      return extra.settings ?? [];
    default:
      return [];
  }
}

function allowedSubs(
  role: UserRole | string | undefined | null,
  modul: NavModul,
  extra?: NavExtra | null
): string[] {
  if (!esRolRestringit(role)) return ["*"];
  const base = defaultSubs(role, modul);
  const more = extraSubs(extra, modul);
  return [...new Set([...base, ...more])];
}

/**
 * Visibilitat de mòdul (sidebar).
 * Rols restringits: defecte + extras. Resta: com abans.
 */
export function potVeureModul(
  role: UserRole | string | undefined | null,
  modul: NavModul,
  extra?: NavExtra | null
): boolean {
  if (!esRolRestringit(role)) {
    switch (modul) {
      case "inici":
      case "resultats":
      case "restaurants":
      case "pressupost":
        return true;
      case "dades":
        return esSuperOAdminRole(role) || role === "EDICIO";
      case "settings":
        return esSuperOAdminRole(role);
      default:
        return false;
    }
  }
  const subs = allowedSubs(role, modul, extra);
  return subs.length > 0;
}

export function potVeureSub(
  role: UserRole | string | undefined | null,
  modul: NavModul,
  subId: string,
  extra?: NavExtra | null
): boolean {
  if (modul === "settings" && subId === "usuaris") {
    return esAdminRole(role);
  }
  const subs = allowedSubs(role, modul, extra);
  if (subs.includes("*")) return true;
  return subs.includes(subId);
}

export function homeHrefPerRol(
  role: UserRole | string | undefined | null,
  extra?: NavExtra | null
): string {
  if (role === "PRESSUPOST_DEPT") return "/pressupost/departaments";
  if (role === "RESTAURACIO") {
    const subs = allowedSubs(role, "restaurants", extra);
    if (subs.includes("quadre-mando") || subs.includes("*")) return "/consultes/quadre-mando";
    if (subs.includes("vendes")) return "/consultes/vendes-restaurants";
    if (subs.includes("cost-salarial")) return "/consultes/cost-salarial";
    return "/consultes/quadre-mando";
  }
  return "/";
}

/** Primera subpestanya concedida d’un mòdul (per redireccions). */
export function primerHrefModul(
  role: UserRole | string | undefined | null,
  modul: NavModul,
  extra?: NavExtra | null
): string | null {
  if (!potVeureModul(role, modul, extra)) return null;
  if (modul === "inici") return "/";
  if (modul === "restaurants") {
    if (potVeureSub(role, "restaurants", "quadre-mando", extra)) return "/consultes/quadre-mando";
    if (potVeureSub(role, "restaurants", "vendes", extra)) return "/consultes/vendes-restaurants";
    if (potVeureSub(role, "restaurants", "cost-salarial", extra)) return "/consultes/cost-salarial";
    return "/consultes/quadre-mando";
  }
  if (modul === "pressupost") {
    if (potVeureSub(role, "pressupost", "departaments", extra)) return "/pressupost/departaments";
    if (potVeureSub(role, "pressupost", "resum", extra)) return "/pressupost";
    if (potVeureSub(role, "pressupost", "ln", extra)) return "/pressupost/ln";
    if (potVeureSub(role, "pressupost", "aprovacio", extra)) return "/pressupost/aprovacio";
    return "/pressupost/departaments";
  }
  if (modul === "dades") {
    const order: DadesSub[] = [
      "importacions",
      "repartiment",
      "traspass-personal",
      "cost-personal-centre",
      "cost-salarial",
      "vendes-restaurants",
      "ajustos",
      "pressupost-categories",
    ];
    for (const id of order) {
      if (potVeureSub(role, "dades", id, extra)) {
        if (id === "importacions") return "/dades";
        return `/dades/${id}`;
      }
    }
  }
  if (modul === "settings") {
    if (esAdminRole(role)) return "/settings";
    const order: SettingsSub[] = [
      "dimensions",
      "compte-resultats",
      "formules",
      "repartiment",
      "traspass-personal",
      "cost-personal-centre",
      "consolidacio",
    ];
    for (const id of order) {
      if (potVeureSub(role, "settings", id, extra)) return `/settings/${id}`;
    }
  }
  if (modul === "resultats") {
    const order: ResultatsSub[] = [
      "empresa",
      "evolucio",
      "linia",
      "centre",
      "comparativa",
      "cost-personal",
    ];
    for (const id of order) {
      if (potVeureSub(role, "resultats", id, extra)) {
        return id === "cost-personal" ? "/consultes/cost-personal" : `/consultes/${id}`;
      }
    }
  }
  return null;
}

/** Comprova accés a una ruta concreta (middleware / layouts). */
export function potAccedirPath(
  role: UserRole | string | undefined | null,
  pathname: string,
  extra?: NavExtra | null
): boolean {
  if (pathname.startsWith("/compte")) return true;

  if (pathname === "/") {
    return potVeureModul(role, "inici", extra);
  }

  if (pathname.startsWith("/consultes")) {
    const sub = resolveConsultesSub(pathname);
    if (!sub)
      return potVeureModul(role, "resultats", extra) || potVeureModul(role, "restaurants", extra);
    if (isRestaurantsPath(pathname)) {
      return potVeureSub(role, "restaurants", sub, extra);
    }
    return potVeureSub(role, "resultats", sub, extra);
  }

  if (pathname.startsWith("/pressupost")) {
    const sub = resolvePressupostSub(pathname);
    if (!sub) return potVeureModul(role, "pressupost", extra);
    return potVeureSub(role, "pressupost", sub, extra);
  }

  if (pathname.startsWith("/dades")) {
    const sub = resolveDadesSub(pathname);
    if (!sub) return potVeureModul(role, "dades", extra);
    return potVeureSub(role, "dades", sub, extra);
  }

  if (pathname.startsWith("/settings")) {
    const sub = resolveSettingsSub(pathname);
    if (sub === "usuaris") return esAdminRole(role);
    if (!sub) return potVeureModul(role, "settings", extra);
    return potVeureSub(role, "settings", sub, extra);
  }

  return true;
}

/** Pot editar a Dades (importacions, etc.). */
export function potEditarDadesPath(
  role: UserRole | string | undefined | null,
  extra?: NavExtra | null
): boolean {
  if (esSuperOAdminRole(role) || role === "EDICIO") return true;
  return potVeureModul(role, "dades", extra);
}

/** Pot editar a Configuració (excepte usuaris). */
export function potEditarSettingsPath(
  role: UserRole | string | undefined | null,
  extra?: NavExtra | null
): boolean {
  if (esSuperOAdminRole(role)) return true;
  return potVeureModul(role, "settings", extra);
}
