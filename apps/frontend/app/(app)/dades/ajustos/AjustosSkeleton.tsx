import { DadesPageShell } from "@/components/dades/DadesPageShell";
import { getDadesTabById } from "@/components/dades/dades-tabs";
import styles from "./page.module.css";

const tab = getDadesTabById("ajustos");

/** Placeholder mentre es carreguen ajustos, conceptes i arbre de selecció. */
export function AjustosSkeleton() {
  return (
    <DadesPageShell title={tab.title} description={tab.description}>
      <div className={styles.skeletonBlock} aria-busy="true" aria-label="Carregant ajustos">
        <div
          className={`${styles.skeletonLine} ${styles.skeletonPulse}`}
          style={{ width: "28%" }}
        />
        <div className={`${styles.skeletonPanel} ${styles.skeletonPulse}`} />
        <div
          className={`${styles.skeletonPanel} ${styles.skeletonPulse}`}
          style={{ minHeight: 220 }}
        />
      </div>
    </DadesPageShell>
  );
}

/** Placeholder del panell de proposta central (consulta pesada en paral·lel). */
export function PropostaCentralPctSkeleton() {
  return (
    <div className={styles.calcPanel} aria-busy="true" aria-label="Calculant proposta central">
      <div className={`${styles.skeletonLine} ${styles.skeletonPulse}`} style={{ width: "55%" }} />
      <div
        className={`${styles.skeletonLine} ${styles.skeletonPulse}`}
        style={{ width: "92%", marginTop: "0.75rem" }}
      />
      <div
        className={`${styles.skeletonPanel} ${styles.skeletonPulse}`}
        style={{ marginTop: "0.75rem" }}
      />
    </div>
  );
}
