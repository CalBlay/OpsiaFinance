import type { GrupEmpresa } from "@/lib/grups-empresa";
import { esRolRestringit } from "@/lib/nav-access";
import type { NavExtra } from "@/lib/nav-catalog";
import type { UserRole } from "@/types";

/** Mateix codi que `CODI_LN_RESTAURANTS` (edge-safe, sense imports Prisma). */
const CODI_LN_RESTAURANTS = "LN00001";

export type ArbreScopeOpt = {
  id: string;
  codi: string;
  nom: string;
  centres: { id: string; codi: string; nom: string }[];
};

export type ConsultaScope = {
  liniaNegociIds: string[];
  centreIds: string[];
  grups?: GrupEmpresa[];
  vistes?: Array<"sap" | "ajustos" | "directe" | "traspassos" | "gestio">;
};

/** Scope desat a navExtra (pot ser parcial). */
export function scopeFromNavExtra(extra?: NavExtra | null): ConsultaScope | null {
  const s = extra?.scope;
  if (!s) return null;
  const liniaNegociIds = s.liniaNegociIds ?? [];
  const centreIds = s.centreIds ?? [];
  const grups = (s.grups ?? []) as GrupEmpresa[];
  const vistes = (s.vistes ?? []) as ConsultaScope["vistes"];
  if (!liniaNegociIds.length && !centreIds.length && !grups.length && !vistes?.length) {
    return null;
  }
  return {
    liniaNegociIds,
    centreIds,
    ...(grups.length ? { grups } : {}),
    ...(vistes?.length ? { vistes } : {}),
  };
}

/**
 * Scope efectiu per consultes LN/centre.
 * RESTAURACIO sense scope desat → LN Restaurants (LN00001) i tots els seus centres.
 */
export function resolveConsultaScope(opts: {
  role: UserRole | string | undefined | null;
  navExtra?: NavExtra | null;
  arbre: ArbreScopeOpt[];
}): ConsultaScope | null {
  const saved = scopeFromNavExtra(opts.navExtra);
  if (saved && (saved.liniaNegociIds.length || saved.centreIds.length)) {
    if (!saved.liniaNegociIds.length && saved.centreIds.length) {
      const lnIds = new Set<string>();
      for (const ln of opts.arbre) {
        if (ln.centres.some((c) => saved.centreIds.includes(c.id))) lnIds.add(ln.id);
      }
      return {
        liniaNegociIds: [...lnIds],
        centreIds: saved.centreIds,
        grups: saved.grups,
        ...(saved.vistes?.length ? { vistes: saved.vistes } : {}),
      };
    }
    if (saved.liniaNegociIds.length && !saved.centreIds.length) {
      const centreIds = opts.arbre
        .filter((ln) => saved.liniaNegociIds.includes(ln.id))
        .flatMap((ln) => ln.centres.map((c) => c.id));
      return {
        liniaNegociIds: saved.liniaNegociIds,
        centreIds,
        grups: saved.grups,
        ...(saved.vistes?.length ? { vistes: saved.vistes } : {}),
      };
    }
    return saved;
  }

  if (opts.role !== "RESTAURACIO") {
    if (!saved?.grups?.length && !saved?.vistes?.length) return null;
    return {
      liniaNegociIds: [],
      centreIds: [],
      ...(saved?.grups?.length ? { grups: saved.grups } : {}),
      ...(saved?.vistes?.length ? { vistes: saved.vistes } : {}),
    };
  }

  const ln = opts.arbre.find((l) => l.codi === CODI_LN_RESTAURANTS);
  if (!ln) {
    return {
      liniaNegociIds: [],
      centreIds: [],
      grups: saved?.grups?.length ? saved.grups : ["calblay"],
      ...(saved?.vistes?.length ? { vistes: saved.vistes } : { vistes: ["gestio"] }),
    };
  }
  return {
    liniaNegociIds: [ln.id],
    centreIds: ln.centres.map((c) => c.id),
    grups: saved?.grups?.length ? saved.grups : ["calblay"],
    ...(saved?.vistes?.length ? { vistes: saved.vistes } : { vistes: ["gestio"] }),
  };
}

/**
 * Empreses permeses al selector.
 * `null` = totes (rols no restringits o sense límit).
 */
export function resolveGrupsPermitits(
  role: UserRole | string | undefined | null,
  navExtra?: NavExtra | null
): GrupEmpresa[] | null {
  if (!esRolRestringit(role)) return null;
  const saved = navExtra?.scope?.grups;
  if (saved?.length) return saved as GrupEmpresa[];
  if (role === "RESTAURACIO") return ["calblay"];
  return null;
}

export function clampGrupEmpresa(
  actual: GrupEmpresa,
  permitits: GrupEmpresa[] | null
): GrupEmpresa {
  if (!permitits?.length) return actual;
  if (permitits.includes(actual)) return actual;
  return permitits[0] ?? actual;
}

/** Filtra l’arbre de selecció segons l’àmbit de l’usuari. */
export function filtrarArbrePerScope<T extends ArbreScopeOpt>(
  arbre: T[],
  scope: ConsultaScope | null
): T[] {
  if (!scope) return arbre;
  if (!scope.liniaNegociIds.length && !scope.centreIds.length) return arbre;
  const lnSet = new Set(scope.liniaNegociIds);
  const cSet = new Set(scope.centreIds);
  return arbre
    .filter((ln) => lnSet.has(ln.id) || ln.centres.some((c) => cSet.has(c.id)))
    .map((ln) => ({
      ...ln,
      centres: ln.centres.filter((c) => {
        if (cSet.size === 0) return lnSet.has(ln.id);
        return cSet.has(c.id);
      }),
    }))
    .filter((ln) => lnSet.has(ln.id) || ln.centres.length > 0) as T[];
}

/** Filtra llista plana de LN (sense centres). */
export function filtrarLiniesPerScope<T extends { id: string }>(
  linies: T[],
  scope: ConsultaScope | null
): T[] {
  if (!scope?.liniaNegociIds.length) return linies;
  const set = new Set(scope.liniaNegociIds);
  return linies.filter((l) => set.has(l.id));
}

/** Valors inicials al formulari d’usuari RESTAURACIO. */
export function defaultScopeRestaurants(arbre: ArbreScopeOpt[]): ConsultaScope {
  const ln = arbre.find((l) => l.codi === CODI_LN_RESTAURANTS);
  if (!ln) {
    return { liniaNegociIds: [], centreIds: [], grups: ["calblay"], vistes: ["gestio"] };
  }
  return {
    liniaNegociIds: [ln.id],
    centreIds: ln.centres.map((c) => c.id),
    grups: ["calblay"],
    vistes: ["gestio"],
  };
}
