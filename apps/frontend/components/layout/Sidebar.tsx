"use client";

import { potAdministrar } from "@/lib/roles";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";
import { BarChart3, Database, Home, Settings, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Sidebar.module.css";

const ADMIN_NAV = [
  { href: "/dades", label: "Dades", icon: Database },
  { href: "/settings", label: "Configuració", icon: Settings },
] as const;

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

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const showAdmin = potAdministrar(role);

  return (
    <nav className={styles.sidebar} aria-label="Navegació principal">
      <ul className={styles.nav}>
        <li>
          <Link
            href="/"
            className={cn(styles.navItem, pathname === "/" && styles.active)}
            aria-current={pathname === "/" ? "page" : undefined}
          >
            <Home size={17} strokeWidth={1.9} className={styles.icon} />
            <span>Inici</span>
          </Link>
        </li>
        <li>
          <Link
            href="/consultes/empresa"
            className={cn(styles.navItem, isResultatsActive(pathname) && styles.active)}
            aria-current={isResultatsActive(pathname) ? "page" : undefined}
          >
            <BarChart3 size={17} strokeWidth={1.9} className={styles.icon} />
            <span>Resultats</span>
          </Link>
        </li>
        <li>
          <Link
            href="/consultes/quadre-mando"
            className={cn(styles.navItem, isRestaurantsActive(pathname) && styles.active)}
            aria-current={isRestaurantsActive(pathname) ? "page" : undefined}
          >
            <ShoppingBag size={17} strokeWidth={1.9} className={styles.icon} />
            <span>Restaurants</span>
          </Link>
        </li>
      </ul>

      {showAdmin && (
        <div className={styles.adminBlock}>
          <p className={styles.adminLabel}>Administració</p>
          <ul className={styles.nav}>
            {ADMIN_NAV.map((item) => {
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
