"use client";

import { DADES_TABS } from "@/components/dades/dades-tabs";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./layout.module.css";

export default function DadesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className={styles.container}>
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
                <tab.icon size={15} strokeWidth={1.8} />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className={styles.content}>{children}</main>
    </div>
  );
}
