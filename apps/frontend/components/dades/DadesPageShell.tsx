import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./DadesPageShell.module.css";

type DadesPageShellProps = {
  title: string;
  description?: ReactNode;
  /** Accions a la dreta de la capçalera (botons, enllaços). */
  actions?: ReactNode;
  /** Enllaç de tornar (p.ex. /dades). */
  backHref?: string;
  backLabel?: string;
  /** Amplada estreta per formularis (nova importació). */
  narrow?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * Shell corporatiu compartit per totes les pestanyes de Dades.
 *
 * Composició estàndard (model Cost salarial):
 *   <DadesPageShell title description>
 *     <Historial… / DadesPanel>   ← historial amb DadesFilterBar
 *     <DadesFilterBar + taula>    ← dades / registres
 *     <FloatingAddButton />      ← pujar fitxers
 *   </DadesPageShell>
 */
export function DadesPageShell({
  title,
  description,
  actions,
  backHref,
  backLabel = "Enrere",
  narrow,
  className,
  children,
}: DadesPageShellProps) {
  return (
    <div className={cn(styles.page, narrow && styles.narrow, className)}>
      {backHref ? (
        <Link href={backHref} className={styles.back}>
          <ChevronLeft size={14} strokeWidth={2.5} />
          {backLabel}
        </Link>
      ) : null}

      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>{title}</h1>
          {description ? <div className={styles.description}>{description}</div> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </header>

      <div className={styles.body}>{children}</div>
    </div>
  );
}

type DadesSectionProps = {
  title?: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Bloc opcional dins del shell (historial, taula, formulari…). */
export function DadesSection({ title, meta, children, className }: DadesSectionProps) {
  return (
    <section className={cn(styles.section, className)}>
      {(title || meta) && (
        <div className={styles.sectionHeader}>
          {title ? <h2 className={styles.sectionTitle}>{title}</h2> : <span />}
          {meta ? <span className={styles.sectionMeta}>{meta}</span> : null}
        </div>
      )}
      {children}
    </section>
  );
}
