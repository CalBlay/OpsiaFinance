/**
 * Catàleg de mòduls i subpestanyes (edge-safe, sense dependències de UI).
 */

export type NavModul = "inici" | "resultats" | "restaurants" | "pressupost" | "dades" | "settings";

export type ResultatsSub =
  | "empresa"
  | "evolucio"
  | "linia"
  | "centre"
  | "comparativa"
  | "cost-personal";

export type RestaurantsSub = "quadre-mando" | "vendes" | "cost-salarial";

export type PressupostSub = "resum" | "ln" | "departaments" | "seguiment" | "aprovacio";

export type DadesSub =
  | "importacions"
  | "repartiment"
  | "traspass-personal"
  | "cost-personal-centre"
  | "cost-salarial"
  | "vendes-restaurants"
  | "ajustos"
  | "pressupost-categories";

export type SettingsSub =
  | "dimensions"
  | "compte-resultats"
  | "formules"
  | "repartiment"
  | "traspass-personal"
  | "cost-personal-centre"
  | "consolidacio";

/** Overrides per usuari (rols restringits). Arrays buits = mòdul no concedit. */
export type NavExtra = {
  inici?: boolean;
  resultats?: ResultatsSub[];
  restaurants?: RestaurantsSub[];
  pressupost?: PressupostSub[];
  dades?: DadesSub[];
  settings?: SettingsSub[];
  /** Àmbit de consulta: només aquestes LN / centres / empreses / vistes (editable). */
  scope?: {
    liniaNegociIds?: string[];
    centreIds?: string[];
    /** Empreses permeses al selector: calblay, fdlc, consolidat. */
    grups?: Array<"calblay" | "fdlc" | "consolidat">;
    /** Capes del compte: sap, ajustos, directe, traspassos, gestio. */
    vistes?: Array<"sap" | "ajustos" | "directe" | "traspassos" | "gestio">;
  };
};

export const RESULTATS_SUBS: { id: ResultatsSub; label: string; href: string }[] = [
  { id: "empresa", label: "Empresa", href: "/consultes/empresa" },
  { id: "evolucio", label: "Evolució mensual", href: "/consultes/evolucio" },
  { id: "linia", label: "Per línia", href: "/consultes/linia" },
  { id: "centre", label: "Per centre", href: "/consultes/centre" },
  { id: "comparativa", label: "Comparativa temporal", href: "/consultes/comparativa" },
  { id: "cost-personal", label: "Cost de personal", href: "/consultes/cost-personal" },
];

export const RESTAURANTS_SUBS: { id: RestaurantsSub; label: string; href: string }[] = [
  { id: "quadre-mando", label: "Quadre de comandament", href: "/consultes/quadre-mando" },
  { id: "vendes", label: "Vendes", href: "/consultes/vendes-restaurants" },
  { id: "cost-salarial", label: "Cost salarial", href: "/consultes/cost-salarial" },
];

export const PRESSUPOST_SUBS: { id: PressupostSub; label: string; href: string }[] = [
  { id: "resum", label: "Vista general", href: "/pressupost" },
  { id: "ln", label: "Per línia (vendes)", href: "/pressupost/ln" },
  { id: "departaments", label: "Per departament", href: "/pressupost/departaments" },
  { id: "seguiment", label: "Seguiment vendes", href: "/pressupost/seguiment" },
  { id: "aprovacio", label: "Aprovació", href: "/pressupost/aprovacio" },
];

export const DADES_SUBS: { id: DadesSub; label: string; href: string }[] = [
  { id: "importacions", label: "Importacions", href: "/dades" },
  { id: "repartiment", label: "Repartiment", href: "/dades/repartiment" },
  { id: "traspass-personal", label: "Traspassos personal", href: "/dades/traspass-personal" },
  { id: "cost-personal-centre", label: "Cost personal", href: "/dades/cost-personal-centre" },
  { id: "cost-salarial", label: "Cost salarial", href: "/dades/cost-salarial" },
  { id: "vendes-restaurants", label: "Vendes rest.", href: "/dades/vendes-restaurants" },
  { id: "ajustos", label: "Ajustos", href: "/dades/ajustos" },
  { id: "pressupost-categories", label: "Categories press.", href: "/dades/pressupost-categories" },
];

export const SETTINGS_SUBS: { id: SettingsSub; label: string; href: string }[] = [
  { id: "dimensions", label: "Dimensions", href: "/settings/dimensions" },
  { id: "compte-resultats", label: "Compte de resultats", href: "/settings/compte-resultats" },
  { id: "formules", label: "Fórmules i conceptes", href: "/settings/formules" },
  { id: "repartiment", label: "Repartiment", href: "/settings/repartiment" },
  { id: "traspass-personal", label: "Traspassos personal", href: "/settings/traspass-personal" },
  { id: "cost-personal-centre", label: "Cost personal", href: "/settings/cost-personal-centre" },
  { id: "consolidacio", label: "Consolidació", href: "/settings/consolidacio" },
];

export const MODUL_LABELS: Record<NavModul, string> = {
  inici: "Inici",
  resultats: "Resultats",
  restaurants: "Restaurants",
  pressupost: "Pressupost",
  dades: "Dades",
  settings: "Configuració",
};

/** Mòduls que es poden concedir com a extra (Inici és boolean sense subpestanyes). */
export const MODULS_EXTRA: NavModul[] = [
  "inici",
  "resultats",
  "restaurants",
  "pressupost",
  "dades",
  "settings",
];

export function subsDelModul(modul: NavModul): { id: string; label: string; href: string }[] {
  switch (modul) {
    case "resultats":
      return RESULTATS_SUBS;
    case "restaurants":
      return RESTAURANTS_SUBS;
    case "pressupost":
      return PRESSUPOST_SUBS;
    case "dades":
      return DADES_SUBS;
    case "settings":
      return SETTINGS_SUBS;
    default:
      return [];
  }
}

export function isRestaurantsPath(pathname: string): boolean {
  return (
    pathname.startsWith("/consultes/quadre-mando") ||
    pathname.startsWith("/consultes/vendes-restaurants") ||
    pathname.startsWith("/consultes/cost-salarial")
  );
}

export function resolveConsultesSub(pathname: string): ResultatsSub | RestaurantsSub | null {
  if (pathname.startsWith("/consultes/quadre-mando")) return "quadre-mando";
  if (pathname.startsWith("/consultes/vendes-restaurants")) return "vendes";
  if (pathname.startsWith("/consultes/cost-salarial")) return "cost-salarial";
  if (pathname.startsWith("/consultes/empresa")) return "empresa";
  if (pathname.startsWith("/consultes/evolucio")) return "evolucio";
  if (pathname.startsWith("/consultes/linia")) return "linia";
  if (pathname.startsWith("/consultes/centre")) return "centre";
  if (pathname.startsWith("/consultes/comparativa")) return "comparativa";
  if (pathname.startsWith("/consultes/cost-personal")) return "cost-personal";
  return null;
}

export function resolvePressupostSub(pathname: string): PressupostSub | null {
  if (pathname === "/pressupost" || pathname === "/pressupost/") return "resum";
  if (pathname.startsWith("/pressupost/ln")) return "ln";
  if (pathname.startsWith("/pressupost/departaments")) return "departaments";
  if (pathname.startsWith("/pressupost/seguiment")) return "seguiment";
  if (pathname.startsWith("/pressupost/aprovacio")) return "aprovacio";
  return null;
}

export function resolveDadesSub(pathname: string): DadesSub | null {
  if (pathname.startsWith("/dades/repartiment")) return "repartiment";
  if (pathname.startsWith("/dades/traspass-personal")) return "traspass-personal";
  if (pathname.startsWith("/dades/cost-personal-centre")) return "cost-personal-centre";
  if (pathname.startsWith("/dades/cost-salarial")) return "cost-salarial";
  if (pathname.startsWith("/dades/vendes-restaurants")) return "vendes-restaurants";
  if (pathname.startsWith("/dades/ajustos")) return "ajustos";
  if (
    pathname.startsWith("/dades/pressupost-categories") ||
    pathname.startsWith("/dades/pressupost-partides")
  ) {
    return "pressupost-categories";
  }
  if (pathname === "/dades" || pathname.startsWith("/dades/")) return "importacions";
  return null;
}

export function resolveSettingsSub(pathname: string): SettingsSub | "usuaris" | null {
  if (pathname === "/settings" || pathname === "/settings/") return "usuaris";
  if (pathname.startsWith("/settings/nou") || pathname.match(/^\/settings\/[^/]+$/)) {
    return "usuaris";
  }
  if (pathname.startsWith("/settings/dimensions")) return "dimensions";
  if (pathname.startsWith("/settings/compte-resultats")) return "compte-resultats";
  if (pathname.startsWith("/settings/formules")) return "formules";
  if (pathname.startsWith("/settings/repartiment")) return "repartiment";
  if (pathname.startsWith("/settings/traspass-personal")) return "traspass-personal";
  if (pathname.startsWith("/settings/cost-personal-centre")) return "cost-personal-centre";
  if (pathname.startsWith("/settings/consolidacio")) return "consolidacio";
  return null;
}

export function parseNavExtra(raw: unknown): NavExtra {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: NavExtra = {};
  if (o.inici === true) out.inici = true;

  const arr = <T extends string>(key: string, allowed: readonly T[]): T[] | undefined => {
    const v = o[key];
    if (!Array.isArray(v)) return undefined;
    const ids = v.map(String).filter((id): id is T => (allowed as readonly string[]).includes(id));
    return ids.length ? ids : undefined;
  };

  out.resultats = arr(
    "resultats",
    RESULTATS_SUBS.map((s) => s.id)
  );
  out.restaurants = arr(
    "restaurants",
    RESTAURANTS_SUBS.map((s) => s.id)
  );
  out.pressupost = arr(
    "pressupost",
    PRESSUPOST_SUBS.map((s) => s.id)
  );
  out.dades = arr(
    "dades",
    DADES_SUBS.map((s) => s.id)
  );
  out.settings = arr(
    "settings",
    SETTINGS_SUBS.map((s) => s.id)
  );

  const scopeRaw = o.scope;
  if (scopeRaw && typeof scopeRaw === "object" && !Array.isArray(scopeRaw)) {
    const s = scopeRaw as Record<string, unknown>;
    const liniaNegociIds = Array.isArray(s.liniaNegociIds)
      ? [...new Set(s.liniaNegociIds.map(String).filter(Boolean))]
      : [];
    const centreIds = Array.isArray(s.centreIds)
      ? [...new Set(s.centreIds.map(String).filter(Boolean))]
      : [];
    const grupAllowed = ["calblay", "fdlc", "consolidat"] as const;
    const grups = Array.isArray(s.grups)
      ? [
          ...new Set(
            s.grups
              .map(String)
              .filter((g): g is (typeof grupAllowed)[number] =>
                (grupAllowed as readonly string[]).includes(g)
              )
          ),
        ]
      : [];
    const vistaAllowed = ["sap", "ajustos", "directe", "traspassos", "gestio"] as const;
    const vistes = Array.isArray(s.vistes)
      ? [
          ...new Set(
            s.vistes
              .map(String)
              .filter((v): v is (typeof vistaAllowed)[number] =>
                (vistaAllowed as readonly string[]).includes(v)
              )
          ),
        ]
      : [];
    // Manté l’ordre de la cadena de vistes
    const vistesOrdenades = vistaAllowed.filter((v) => vistes.includes(v));
    if (liniaNegociIds.length || centreIds.length || grups.length || vistesOrdenades.length) {
      out.scope = {
        ...(liniaNegociIds.length ? { liniaNegociIds } : {}),
        ...(centreIds.length ? { centreIds } : {}),
        ...(grups.length ? { grups } : {}),
        ...(vistesOrdenades.length ? { vistes: [...vistesOrdenades] } : {}),
      };
    }
  }

  return out;
}
