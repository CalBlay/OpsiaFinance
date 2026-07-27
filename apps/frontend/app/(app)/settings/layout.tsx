"use client";

import { cn } from "@/lib/utils";
import { ArrowLeftRight, GitBranch, Layers, ListTree, Scale, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./layout.module.css";

const SETTINGS_TABS = [
  { href: "/settings", label: "Usuaris", icon: Users, exact: true },
  { href: "/settings/dimensions", label: "Dimensions", icon: GitBranch, exact: false },
  {
    href: "/settings/compte-resultats",
    label: "Compte de resultats",
    icon: ListTree,
    exact: false,
  },
  { href: "/settings/repartiment", label: "Repartiment", icon: Scale, exact: false },
  {
    href: "/settings/traspass-personal",
    label: "Traspassos personal",
    icon: ArrowLeftRight,
    exact: false,
  },
  { href: "/settings/consolidacio", label: "Consolidació", icon: Layers, exact: false },
] as const;

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className={styles.container}>
      <header className={styles.moduleHeader}>
        <h2 className={styles.moduleTitle}>Configuració</h2>
        <nav className={styles.tabs} aria-label="Secció de configuració">
          {SETTINGS_TABS.map((tab) => {
            const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
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
