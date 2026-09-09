"use client";

import { DADES_TABS } from "@/components/dades/dades-tabs";
import { LinkPending } from "@/components/ui/LinkPending";
import { potVeureSub } from "@/lib/nav-access";
import type { NavExtra } from "@/lib/nav-catalog";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import styles from "./layout.module.css";

export function DadesTabs({
  role,
  navExtra,
}: {
  role: UserRole;
  navExtra?: NavExtra | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const tabs = useMemo(
    () => DADES_TABS.filter((tab) => potVeureSub(role, "dades", tab.id, navExtra)),
    [role, navExtra]
  );

  useEffect(() => {
    const idx = tabs.findIndex((tab) => tab.match(pathname));
    if (idx < 0) return;

    const adjacent = [tabs[idx - 1], tabs[idx + 1]].filter(
      (tab): tab is (typeof tabs)[number] => tab != null
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
  }, [pathname, router, tabs]);

  return (
    <header className={styles.moduleHeader}>
      <h2 className={styles.moduleTitle}>Dades</h2>
      <nav className={styles.tabs} aria-label="Seccions de dades">
        {tabs.map((tab) => {
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
