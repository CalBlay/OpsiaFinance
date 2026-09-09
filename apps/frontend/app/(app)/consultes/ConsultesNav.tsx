"use client";

import { LinkPending } from "@/components/ui/LinkPending";
import { potVeureSub } from "@/lib/nav-access";
import type { NavExtra } from "@/lib/nav-catalog";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";
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
  { href: "/consultes/empresa", label: "Empresa", icon: Landmark, sub: "empresa" },
  { href: "/consultes/evolucio", label: "Evolució mensual", icon: TrendingUp, sub: "evolucio" },
  { href: "/consultes/linia", label: "Per línia", icon: Layers, sub: "linia" },
  { href: "/consultes/centre", label: "Per centre", icon: Building2, sub: "centre" },
  {
    href: "/consultes/comparativa",
    label: "Comparativa temporal",
    icon: GitCompareArrows,
    sub: "comparativa",
  },
  {
    href: "/consultes/cost-personal",
    label: "Cost de personal",
    icon: UserRound,
    sub: "cost-personal",
  },
] as const;

const RESTAURANTS_TABS = [
  {
    href: "/consultes/quadre-mando",
    label: "Quadre de comandament",
    icon: LayoutDashboard,
    sub: "quadre-mando",
  },
  { href: "/consultes/vendes-restaurants", label: "Vendes", icon: ShoppingBag, sub: "vendes" },
  { href: "/consultes/cost-salarial", label: "Cost salarial", icon: Users, sub: "cost-salarial" },
] as const;

function isRestaurantsPath(pathname: string): boolean {
  return (
    pathname.startsWith("/consultes/quadre-mando") ||
    pathname.startsWith("/consultes/vendes-restaurants") ||
    pathname.startsWith("/consultes/cost-salarial")
  );
}

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

export function ConsultesNav({
  role,
  navExtra,
}: {
  role: UserRole;
  navExtra?: NavExtra | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const restaurants = isRestaurantsPath(pathname);
  const modul = restaurants ? "restaurants" : "resultats";
  const allTabs = restaurants ? RESTAURANTS_TABS : RESULTATS_TABS;
  const tabs = allTabs.filter((tab) => potVeureSub(role, modul, tab.sub, navExtra));
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
