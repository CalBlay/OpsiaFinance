"use client";

import { LinkPending } from "@/components/ui/LinkPending";
import { cn } from "@/lib/utils";
import { ArrowLeftRight, GitBranch, Layers, ListTree, Scale, UserCog, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./layout.module.css";

const SETTINGS_TABS = [
  { href: "/settings", label: "Usuaris", icon: Users, exact: true, adminOnly: true },
  {
    href: "/settings/dimensions",
    label: "Dimensions",
    icon: GitBranch,
    exact: false,
    adminOnly: false,
  },
  {
    href: "/settings/compte-resultats",
    label: "Compte de resultats",
    icon: ListTree,
    exact: false,
    adminOnly: false,
  },
  {
    href: "/settings/repartiment",
    label: "Repartiment",
    icon: Scale,
    exact: false,
    adminOnly: false,
  },
  {
    href: "/settings/traspass-personal",
    label: "Traspassos personal",
    icon: ArrowLeftRight,
    exact: false,
    adminOnly: false,
  },
  {
    href: "/settings/cost-personal-centre",
    label: "Cost personal",
    icon: UserCog,
    exact: false,
    adminOnly: false,
  },
  {
    href: "/settings/consolidacio",
    label: "Consolidació",
    icon: Layers,
    exact: false,
    adminOnly: false,
  },
] as const;

export function SettingsNav({
  children,
  showUsuaris,
}: {
  children: React.ReactNode;
  showUsuaris: boolean;
}) {
  const pathname = usePathname();
  const tabs = SETTINGS_TABS.filter((t) => showUsuaris || !t.adminOnly);

  return (
    <div className={styles.container}>
      <header className={styles.moduleHeader}>
        <h2 className={styles.moduleTitle}>Configuració</h2>
        <nav className={styles.tabs} aria-label="Secció de configuració">
          {tabs.map((tab) => {
            const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
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

      <main className={styles.content}>{children}</main>
    </div>
  );
}
