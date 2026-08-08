import styles from "./RouteLoading.module.css";

/** Skeleton de contingut mentre es carrega una ruta (loading.tsx / Suspense). */
export function RouteLoading({ label = "Carregant…" }: { label?: string }) {
  return (
    <output className={styles.root} aria-live="polite" aria-busy="true">
      <span className={styles.srOnly}>{label}</span>
      <div className={styles.bar} />
      <div className={styles.block}>
        <div className={styles.line} style={{ width: "28%" }} />
        <div className={styles.line} style={{ width: "48%" }} />
      </div>
      <div className={styles.grid}>
        <div className={styles.card} />
        <div className={styles.card} />
        <div className={styles.card} />
      </div>
      <div className={styles.table}>
        <div className={styles.line} style={{ width: "100%" }} />
        <div className={styles.line} style={{ width: "92%" }} />
        <div className={styles.line} style={{ width: "96%" }} />
        <div className={styles.line} style={{ width: "88%" }} />
        <div className={styles.line} style={{ width: "94%" }} />
      </div>
    </output>
  );
}
