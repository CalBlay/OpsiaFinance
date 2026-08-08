"use client";

import { DADES_TABS } from "@/components/dades/dades-tabs";
import { LinkPending } from "@/components/ui/LinkPending";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./layout.module.css";

export function DadesTabs() {
  const pathname = usePathname();

  return (
    <header className={styles.moduleHeader}>
      <h2 className={styles.moduleTitle}>Dades</h2>
      <nav className={styles.tabs} aria-label="Seccions de dades">
        {DADES_TABS.map((tab) => {
          const isActive = tab.match(pathname);
          return (
            <Link
              key={tab.id}
              href={tab.href}
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
