"use client";

import { cn } from "@/lib/utils";
import { Building2, GitCompareArrows, Landmark, Layers, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./layout.module.css";

const TABS = [
  { href: "/consultes/empresa", label: "Empresa", icon: Landmark },
  { href: "/consultes/evolucio", label: "Evolució mensual", icon: TrendingUp },
  { href: "/consultes/linia", label: "Per línia", icon: Layers },
  { href: "/consultes/centre", label: "Per centre", icon: Building2 },
  { href: "/consultes/comparativa", label: "Comparativa temporal", icon: GitCompareArrows },
  { href: "/consultes/cost-salarial", label: "Cost salarial rest.", icon: Users },
] as const;

export default function ConsultesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className={styles.container}>
      <header className={styles.moduleHeader}>
        <h2 className={styles.moduleTitle}>Consultes</h2>
        <nav className={styles.tabs} aria-label="Tipus de consulta">
          {TABS.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
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
