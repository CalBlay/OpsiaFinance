"use client";

import { cn } from "@/lib/utils";
import { BarChart3, Database, Home, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Sidebar.module.css";

const NAV_ITEMS = [
  { href: "/", label: "Inici", icon: Home, exact: true },
  { href: "/consultes", label: "Consultes", icon: BarChart3, exact: false },
  { href: "/dades", label: "Dades", icon: Database, exact: false },
  { href: "/settings", label: "Settings", icon: Settings, exact: false },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className={styles.sidebar} aria-label="Navegació principal">
      <ul className={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(styles.navItem, isActive && styles.active)}
                aria-current={isActive ? "page" : undefined}
              >
                <item.icon size={17} strokeWidth={1.9} className={styles.icon} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
