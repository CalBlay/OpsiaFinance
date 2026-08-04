"use client";

import { cn } from "@/lib/utils";
import {
  ArrowLeftRight,
  FileSpreadsheet,
  Scale,
  ShoppingBag,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./layout.module.css";

export default function DadesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ajustosActiu = pathname.startsWith("/dades/ajustos");
  const repartimentActiu = pathname.startsWith("/dades/repartiment");
  const traspassActiu = pathname.startsWith("/dades/traspass-personal");
  const costSalarialActiu = pathname.startsWith("/dades/cost-salarial");
  const vendesActiu = pathname.startsWith("/dades/vendes-restaurants");
  const importsActiu =
    !ajustosActiu && !repartimentActiu && !traspassActiu && !costSalarialActiu && !vendesActiu;

  return (
    <div className={styles.container}>
      <header className={styles.moduleHeader}>
        <h2 className={styles.moduleTitle}>Dades</h2>
        <nav className={styles.tabs} aria-label="Seccions de dades">
          <Link
            href="/dades"
            className={cn(styles.tab, importsActiu && styles.tabActive)}
            aria-current={importsActiu ? "page" : undefined}
          >
            <FileSpreadsheet size={15} strokeWidth={1.8} />
            Importacions
          </Link>
          <Link
            href="/dades/repartiment"
            className={cn(styles.tab, repartimentActiu && styles.tabActive)}
            aria-current={repartimentActiu ? "page" : undefined}
          >
            <Scale size={15} strokeWidth={1.8} />
            Repartiment
          </Link>
          <Link
            href="/dades/traspass-personal"
            className={cn(styles.tab, traspassActiu && styles.tabActive)}
            aria-current={traspassActiu ? "page" : undefined}
          >
            <ArrowLeftRight size={15} strokeWidth={1.8} />
            Traspassos personal
          </Link>
          <Link
            href="/dades/cost-salarial"
            className={cn(styles.tab, costSalarialActiu && styles.tabActive)}
            aria-current={costSalarialActiu ? "page" : undefined}
          >
            <Users size={15} strokeWidth={1.8} />
            Cost salarial
          </Link>
          <Link
            href="/dades/vendes-restaurants"
            className={cn(styles.tab, vendesActiu && styles.tabActive)}
            aria-current={vendesActiu ? "page" : undefined}
          >
            <ShoppingBag size={15} strokeWidth={1.8} />
            Vendes rest.
          </Link>
          <Link
            href="/dades/ajustos"
            className={cn(styles.tab, ajustosActiu && styles.tabActive)}
            aria-current={ajustosActiu ? "page" : undefined}
          >
            <SlidersHorizontal size={15} strokeWidth={1.8} />
            Ajustos
          </Link>
        </nav>
      </header>

      <main className={styles.content}>{children}</main>
    </div>
  );
}
