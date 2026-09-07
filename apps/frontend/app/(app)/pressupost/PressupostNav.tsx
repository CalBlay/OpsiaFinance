"use client";

import { LinkPending } from "@/components/ui/LinkPending";
import { potVeurePressupostGlobal } from "@/lib/roles";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";
import { Building2, CheckSquare, Layers, LayoutList } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "../consultes/layout.module.css";

const TABS_ALL = [
  { href: "/pressupost", label: "Vista general", icon: LayoutList, exact: true },
  { href: "/pressupost/ln", label: "Per línia (vendes)", icon: Layers, exact: false },
  {
    href: "/pressupost/departaments",
    label: "Per departament",
    icon: Building2,
    exact: false,
  },
  { href: "/pressupost/aprovacio", label: "Aprovació", icon: CheckSquare, exact: false },
] as const;

export function PressupostNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const tabs = potVeurePressupostGlobal(role)
    ? TABS_ALL
    : TABS_ALL.filter((t) => t.href === "/pressupost/departaments");

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
