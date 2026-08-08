import type { ReactNode } from "react";
import styles from "./report.module.css";

/**
 * Ordre corporatiu de filtres (esquerra → dreta). Font única.
 *
 * 1. dates — Any, Mes, Des de / Fins a
 * 2. camps — Àmbit, Línia, Restaurant, Centre…
 * 3. vista — Directe | Gestió
 * 4. impressora — ExportInformeButton després del toolbar a ConsultaHeader
 *
 * Etiquetes: `@/components/consultes/consulta-filtres` (`FILTRE`, `VISTA_OPCIONS`).
 */
export const CONSULTA_TOOLBAR_ORDRE = ["dates", "camps", "vista", "impressora"] as const;

export type ConsultaToolbarSlot = (typeof CONSULTA_TOOLBAR_ORDRE)[number];

export { FILTRE, VISTA_OPCIONS, MES_TOT_ANY, AMBIT_OPCIONS_RESTAURANTS } from "./consulta-filtres";

export function ConsultaToolbar({
  dates,
  camps,
  vista,
  pending = false,
}: {
  dates?: ReactNode;
  camps?: ReactNode;
  vista?: ReactNode;
  pending?: boolean;
}) {
  return (
    <div
      className={styles.selectors}
      data-pending={pending ? "true" : undefined}
      data-toolbar-ordre={CONSULTA_TOOLBAR_ORDRE.join("-")}
      aria-busy={pending || undefined}
    >
      {dates != null ? <div className={styles.toolbarSlot}>{dates}</div> : null}
      {camps != null ? <div className={styles.toolbarSlot}>{camps}</div> : null}
      {vista != null ? <div className={styles.toolbarSlot}>{vista}</div> : null}
    </div>
  );
}
