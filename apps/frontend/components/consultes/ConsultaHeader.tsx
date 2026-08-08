import type { ReactNode } from "react";
import styles from "./report.module.css";

/**
 * Capçalera corporativa de consultes.
 *
 * Estil: tokens `--opsia-cx-*` (`styles/opsia-consultes.css`).
 * Layout: títol/subtítol a l'esquerra · filtres + impressora a la dreta.
 * Ordre dels filtres i noms: `ConsultaToolbar` + `consulta-filtres.ts`
 * (dates → camps → vista → impressora).
 */
export function ConsultaHeader({
  title,
  subtitle,
  meta,
  actions,
  className,
  titleClassName,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Contingut sota el subtítol (migues de pa, etc.) */
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <header className={[styles.headerRow, className].filter(Boolean).join(" ")}>
      <div className={styles.headerText}>
        <h1 className={[styles.title, titleClassName].filter(Boolean).join(" ")}>{title}</h1>
        {subtitle != null && subtitle !== "" ? <p className={styles.subtitle}>{subtitle}</p> : null}
        {meta != null ? <div className={styles.headerMeta}>{meta}</div> : null}
      </div>
      {actions != null ? <div className={styles.headerActions}>{actions}</div> : null}
    </header>
  );
}
