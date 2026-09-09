"use client";

import { LinkPending } from "@/components/ui/LinkPending";
import { potVeureModul, primerHrefModul } from "@/lib/nav-access";
import type { NavExtra } from "@/lib/nav-catalog";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";
import { BarChart3, CalendarRange, Database, Home, Settings, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Sidebar.module.css";

const DADES_NAV = { href: "/dades", label: "Dades", icon: Database, modul: "dades" as const };
const CONFIG_NAV = {
  href: "/settings",
  label: "Configuració",
  icon: Settings,
  modul: "settings" as const,
};

function isResultatsActive(pathname: string): boolean {
  if (!pathname.startsWith("/consultes")) return false;
  if (pathname.startsWith("/consultes/quadre-mando")) return false;
  if (pathname.startsWith("/consultes/cost-salarial")) return false;
  if (pathname.startsWith("/consultes/vendes-restaurants")) return false;
  return true;
}

function isRestaurantsActive(pathname: string): boolean {
  return (
    pathname.startsWith("/consultes/quadre-mando") ||
    pathname.startsWith("/consultes/vendes-restaurants") ||
    pathname.startsWith("/consultes/cost-salarial")
  );
}

export function Sidebar({
  role,
  navExtra,
}: {
  role: UserRole;
  navExtra?: NavExtra | null;
}) {
  const pathname = usePathname();
  const showInici = potVeureModul(role, "inici", navExtra);
  const showResultats = potVeureModul(role, "resultats", navExtra);
  const showRestaurants = potVeureModul(role, "restaurants", navExtra);
  const showPressupost = potVeureModul(role, "pressupost", navExtra);
  const showDades = potVeureModul(role, "dades", navExtra);
  const showConfig = potVeureModul(role, "settings", navExtra);
  const resultatsHref = primerHrefModul(role, "resultats", navExtra) ?? "/consultes/empresa";
  const restaurantsHref =
    primerHrefModul(role, "restaurants", navExtra) ?? "/consultes/quadre-mando";
  const pressupostHref = primerHrefModul(role, "pressupost", navExtra) ?? "/pressupost";
  const dadesHref = primerHrefModul(role, "dades", navExtra) ?? "/dades";
  const settingsHref = primerHrefModul(role, "settings", navExtra) ?? "/settings";
  const adminNav = [
    ...(showDades ? [{ ...DADES_NAV, href: dadesHref }] : []),
    ...(showConfig ? [{ ...CONFIG_NAV, href: settingsHref }] : []),
  ];

  return (
    <nav className={styles.sidebar} aria-label="Navegació principal">
      <ul className={styles.nav}>
        {showInici ? (
          <li>
            <Link
              href="/"
              className={cn(styles.navItem, pathname === "/" && styles.active)}
              aria-current={pathname === "/" ? "page" : undefined}
            >
              <LinkPending />
              <Home size={17} strokeWidth={1.9} className={styles.icon} />
              <span>Inici</span>
            </Link>
          </li>
        ) : null}
        {showResultats ? (
          <li>
            <Link
              href={resultatsHref}
              className={cn(styles.navItem, isResultatsActive(pathname) && styles.active)}
              aria-current={isResultatsActive(pathname) ? "page" : undefined}
            >
              <LinkPending />
              <BarChart3 size={17} strokeWidth={1.9} className={styles.icon} />
              <span>Resultats</span>
            </Link>
          </li>
        ) : null}
        {showRestaurants ? (
          <li>
            <Link
              href={restaurantsHref}
              className={cn(styles.navItem, isRestaurantsActive(pathname) && styles.active)}
              aria-current={isRestaurantsActive(pathname) ? "page" : undefined}
            >
              <LinkPending />
              <ShoppingBag size={17} strokeWidth={1.9} className={styles.icon} />
              <span>Restaurants</span>
            </Link>
          </li>
        ) : null}
        {showPressupost ? (
          <li>
            <Link
              href={pressupostHref}
              className={cn(
                styles.navItem,
                (pathname === "/pressupost" || pathname.startsWith("/pressupost/")) && styles.active
              )}
              aria-current={
                pathname === "/pressupost" || pathname.startsWith("/pressupost/")
                  ? "page"
                  : undefined
              }
            >
              <LinkPending />
              <CalendarRange size={17} strokeWidth={1.9} className={styles.icon} />
              <span>Pressupost</span>
            </Link>
          </li>
        ) : null}
      </ul>

      {adminNav.length > 0 && (
        <div className={styles.adminBlock}>
          <p className={styles.adminLabel}>Administració</p>
          <ul className={styles.nav}>
            {adminNav.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      styles.navItem,
                      styles.navItemSecondary,
                      isActive && styles.active
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <LinkPending />
                    <item.icon size={17} strokeWidth={1.9} className={styles.icon} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </nav>
  );
}
