import { DadesPageShell } from "@/components/dades/DadesPageShell";
import styles from "./page.module.css";

/** Placeholder mentre es carreguen les línies de negoci del formulari. */
export function NovaImportSkeleton() {
  return (
    <DadesPageShell
      narrow
      backHref="/dades"
      backLabel="Importacions"
      title="Nova importació"
      description={
        <>
          Puja un o diversos informes Excel. Conveni de nom recomanat:{" "}
          <span className="font-mono text-sm">mes_any_XX</span>.
        </>
      }
    >
      <div className={styles.form} aria-busy="true" aria-label="Carregant formulari">
        <div className={styles.section}>
          <div
            className={`${styles.dropZone} ${styles.skeletonPulse}`}
            style={{ minHeight: 140 }}
          />
        </div>
        <div className={styles.section}>
          <div
            className={`${styles.skeletonLine} ${styles.skeletonPulse}`}
            style={{ width: "40%" }}
          />
          <div
            className={`${styles.skeletonLine} ${styles.skeletonPulse}`}
            style={{ width: "100%" }}
          />
          <div
            className={`${styles.skeletonLine} ${styles.skeletonPulse}`}
            style={{ width: "72%" }}
          />
        </div>
      </div>
    </DadesPageShell>
  );
}
