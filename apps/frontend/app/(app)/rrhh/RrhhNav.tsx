"use client";

import { LinkPending } from "@/components/ui/LinkPending";
import { potVeureSub } from "@/lib/nav-access";
import type { NavExtra } from "@/lib/nav-catalog";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";
import { Building2, GitCompare, Layers, LayoutList } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "../consultes/layout.module.css";

const TABS_ALL = [
  { href: "/rrhh", label: "Resum", icon: LayoutList, exact: true, sub: "resum" },
  { href: "/rrhh/centre", label: "Per centre", icon: Building2, exact: false, sub: "centre" },
  {
    href: "/rrhh/departament",
    label: "Per departament",
    icon: Layers,
    exact: false,
    sub: "departament",
  },
  {
    href: "/rrhh/comparativa",
    label: "Comparativa",
    icon: GitCompare,
    exact: false,
    sub: "comparativa",
  },
] as const;

export function RrhhNav({
  role,
  navExtra,
}: {
  role: UserRole;
  navExtra?: NavExtra | null;
}) {
  const pathname = usePathname();
  const tabs = TABS_ALL.filter((t) => potVeureSub(role, "rrhh", t.sub, navExtra));

  return (
    <header className={styles.moduleHeader}>
      <h2 className={styles.moduleTitle}>RRHH</h2>
      <nav className={styles.tabs} aria-label="Mòdul RRHH" translate="no">
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(styles.tab, isActive && styles.tabActive)}
              aria-current={isActive ? "page" : undefined}
              translate="no"
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
