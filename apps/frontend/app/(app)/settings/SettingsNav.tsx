"use client";

import { LinkPending } from "@/components/ui/LinkPending";
import { cn } from "@/lib/utils";
import {
  ArrowLeftRight,
  BookOpen,
  GitBranch,
  Layers,
  ListTree,
  Scale,
  UserCog,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./layout.module.css";

const SETTINGS_TABS = [
  { href: "/settings", label: "Usuaris", icon: Users, exact: true, sub: "usuaris" },
  {
    href: "/settings/dimensions",
    label: "Dimensions",
    icon: GitBranch,
    exact: false,
    sub: "dimensions",
  },
  {
    href: "/settings/compte-resultats",
    label: "Compte de resultats",
    icon: ListTree,
    exact: false,
    sub: "compte-resultats",
  },
  {
    href: "/settings/formules",
    label: "Fórmules i conceptes",
    icon: BookOpen,
    exact: false,
    sub: "formules",
  },
  {
    href: "/settings/repartiment",
    label: "Repartiment",
    icon: Scale,
    exact: false,
    sub: "repartiment",
  },
  {
    href: "/settings/traspass-personal",
    label: "Traspassos personal",
    icon: ArrowLeftRight,
    exact: false,
    sub: "traspass-personal",
  },
  {
    href: "/settings/cost-personal-centre",
    label: "Cost personal",
    icon: UserCog,
    exact: false,
    sub: "cost-personal-centre",
  },
  {
    href: "/settings/consolidacio",
    label: "Consolidació",
    icon: Layers,
    exact: false,
    sub: "consolidacio",
  },
] as const;

export function SettingsNav({
  children,
  showUsuaris,
  allowedSubs,
}: {
  children: React.ReactNode;
  showUsuaris: boolean;
  allowedSubs: string[];
}) {
  const pathname = usePathname();
  const tabs = SETTINGS_TABS.filter((t) => {
    if (t.sub === "usuaris") return showUsuaris;
    return allowedSubs.includes(t.sub);
  });

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
