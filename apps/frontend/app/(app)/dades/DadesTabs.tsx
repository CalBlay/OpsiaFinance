"use client";

import { DADES_TABS } from "@/components/dades/dades-tabs";
import { LinkPending } from "@/components/ui/LinkPending";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import styles from "./layout.module.css";

export function DadesTabs() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const idx = DADES_TABS.findIndex((tab) => tab.match(pathname));
    if (idx < 0) return;

    const adjacent = [DADES_TABS[idx - 1], DADES_TABS[idx + 1]].filter(
      (tab): tab is (typeof DADES_TABS)[number] => tab != null
    );
    const targets = adjacent.map((tab) => tab.href);
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
  }, [pathname, router]);

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
              prefetch
              onMouseEnter={() => router.prefetch(tab.href)}
              onFocus={() => router.prefetch(tab.href)}
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
