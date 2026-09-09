"use client";

import { LinkPending } from "@/components/ui/LinkPending";
import { potVeureSub } from "@/lib/nav-access";
import type { NavExtra } from "@/lib/nav-catalog";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";
import { Building2, CheckSquare, Layers, LayoutList, LineChart } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "../consultes/layout.module.css";

const TABS_ALL = [
  { href: "/pressupost", label: "Vista general", icon: LayoutList, exact: true, sub: "resum" },
  { href: "/pressupost/ln", label: "Per línia (vendes)", icon: Layers, exact: false, sub: "ln" },
  {
    href: "/pressupost/departaments",
    label: "Per departament",
    icon: Building2,
    exact: false,
    sub: "departaments",
  },
  {
    href: "/pressupost/seguiment",
    label: "Seguiment vendes",
    icon: LineChart,
    exact: false,
    sub: "seguiment",
  },
  {
    href: "/pressupost/aprovacio",
    label: "Aprovació",
    icon: CheckSquare,
    exact: false,
    sub: "aprovacio",
  },
] as const;

export function PressupostNav({
  role,
  navExtra,
}: {
  role: UserRole;
  navExtra?: NavExtra | null;
}) {
  const pathname = usePathname();
  const tabs = TABS_ALL.filter((t) => potVeureSub(role, "pressupost", t.sub, navExtra));

  return (
    <header className={styles.moduleHeader}>
      <h2 className={styles.moduleTitle}>Pressupost</h2>
      <nav className={styles.tabs} aria-label="Mòdul de pressupost" translate="no">
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
