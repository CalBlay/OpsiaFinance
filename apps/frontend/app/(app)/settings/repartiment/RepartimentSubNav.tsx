"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./page.module.css";

const SUB_TABS = [
  {
    href: "/settings/repartiment",
    label: "Personal SC",
    exact: true,
  },
  {
    href: "/settings/repartiment/normes",
    label: "Compres i gestió",
    exact: false,
  },
] as const;

export function RepartimentSubNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.subNav} aria-label="Secció de repartiment">
      {SUB_TABS.map((tab) => {
        const isActive = tab.exact
          ? pathname === tab.href || pathname === `${tab.href}/`
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(styles.subTab, isActive && styles.subTabActive)}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
