"use client";

import { LinkPending } from "@/components/ui/LinkPending";
import { cn } from "@/lib/utils";
import { Building2, CheckSquare, Layers, LayoutList } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "../consultes/layout.module.css";

const TABS = [
  { href: "/pressupost", label: "Vista general", icon: LayoutList, exact: true },
  { href: "/pressupost/ln", label: "Per línia (vendes)", icon: Layers },
  { href: "/pressupost/departaments", label: "Per departament", icon: Building2 },
  { href: "/pressupost/aprovacio", label: "Aprovació", icon: CheckSquare },
] as const;

export function PressupostNav() {
  const pathname = usePathname();

  return (
    <header className={styles.moduleHeader}>
      <h2 className={styles.moduleTitle}>Pressupost</h2>
      <nav className={styles.tabs} aria-label="Mòdul de pressupost" translate="no">
        {TABS.map((tab) => {
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
