"use client";

import { LinkPending } from "@/components/ui/LinkPending";
import { cn } from "@/lib/utils";
import {
  Building2,
  GitCompareArrows,
  Landmark,
  Layers,
  LayoutDashboard,
  ShoppingBag,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import styles from "./layout.module.css";

const RESULTATS_TABS = [
  { href: "/consultes/empresa", label: "Empresa", icon: Landmark },
  { href: "/consultes/evolucio", label: "Evolució mensual", icon: TrendingUp },
  { href: "/consultes/linia", label: "Per línia", icon: Layers },
  { href: "/consultes/centre", label: "Per centre", icon: Building2 },
  { href: "/consultes/comparativa", label: "Comparativa temporal", icon: GitCompareArrows },
  { href: "/consultes/cost-personal", label: "Cost de personal", icon: UserRound },
] as const;

const RESTAURANTS_TABS = [
  { href: "/consultes/quadre-mando", label: "Quadre de comandament", icon: LayoutDashboard },
  { href: "/consultes/vendes-restaurants", label: "Vendes", icon: ShoppingBag },
  { href: "/consultes/cost-salarial", label: "Cost salarial", icon: Users },
] as const;

function isRestaurantsPath(pathname: string): boolean {
  return (
    pathname.startsWith("/consultes/quadre-mando") ||
    pathname.startsWith("/consultes/vendes-restaurants") ||
    pathname.startsWith("/consultes/cost-salarial")
  );
}

/** Conserva any/vista (i rang si n'hi ha) en canviar de pestanya. */
function tabHref(
  base: string,
  params: { any: string | null; vista: string | null; des: string | null; fins: string | null }
): string {
  const qs = new URLSearchParams();
  if (params.any) qs.set("any", params.any);
  if (params.vista) qs.set("vista", params.vista);
  if (params.des) qs.set("des", params.des);
  if (params.fins) qs.set("fins", params.fins);
  const q = qs.toString();
  return q ? `${base}?${q}` : base;
}

export function ConsultesNav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const restaurants = isRestaurantsPath(pathname);
  const tabs = restaurants ? RESTAURANTS_TABS : RESULTATS_TABS;
  const title = restaurants ? "Restaurants" : "Resultats";
  const navLabel = restaurants ? "Consultes de restaurants" : "Consultes de resultats";

  const sharedParams = useMemo(
    () => ({
      any: searchParams.get("any"),
      vista: searchParams.get("vista"),
      des: searchParams.get("des"),
      fins: searchParams.get("fins"),
    }),
    [searchParams]
  );

  // Prefetch només pestanyes veïnes en idle (evita stampede de totes les consultes).
  useEffect(() => {
    const idx = tabs.findIndex((tab) => pathname.startsWith(tab.href));
    if (idx < 0) return;

    const adjacent = [tabs[idx - 1], tabs[idx + 1]].filter(
      (tab): tab is (typeof tabs)[number] => tab != null
    );
    const targets = adjacent.map((tab) => tabHref(tab.href, sharedParams));
    if (targets.length === 0) return;

    const run = () => {
      for (const href of targets) router.prefetch(href);
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = window.requestIdleCallback(run, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const t = globalThis.setTimeout(run, 250);
    return () => globalThis.clearTimeout(t);
  }, [tabs, sharedParams, pathname, router]);

  return (
    <header className={styles.moduleHeader}>
      <h2 className={styles.moduleTitle}>{title}</h2>
      <nav className={styles.tabs} aria-label={navLabel}>
        {tabs.map((tab) => {
          const href = tabHref(tab.href, sharedParams);
          const isActive = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={href}
              prefetch
              onMouseEnter={() => router.prefetch(href)}
              onFocus={() => router.prefetch(href)}
              className={cn(styles.tab, isActive && styles.tabActive)}
              aria-current={isActive ? "page" : undefined}
            >
              <LinkPending />
              <tab.icon size={15} strokeWidth={1.8} />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
