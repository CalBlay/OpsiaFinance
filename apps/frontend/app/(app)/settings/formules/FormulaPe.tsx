import styles from "./page.module.css";

/** Explica la fórmula del punt d'equilibri (PE) usada a les consultes. */
export function FormulaPe() {
  return (
    <section className={styles.card} aria-labelledby="pe-formula-title">
      <h2 id="pe-formula-title" className={styles.cardTitle}>
        Punt d&apos;equilibri (PE)
      </h2>
      <p className={styles.cardLead}>
        Amb la natura dels conceptes (variable / fix / mixt / aliè) calculem el PE en euros
        d&apos;ingressos del període, a Empresa, Evolució mensual i Per línia.
      </p>
      <ol className={styles.steps}>
        <li>
          <strong>Variables</strong> = |costos VARIABLE| + |MIXTE| × (%&nbsp;var / 100)
        </li>
        <li>
          <strong>Fixos</strong> = |costos FIX| + |MIXTE| × (1 − %&nbsp;var / 100)
        </li>
        <li>
          <strong>Marge de contribució (MC)</strong> = Ingressos (node 6) − Variables
        </li>
        <li>
          <strong>PE (€)</strong> = Fixos ÷ (MC / Ingressos)
        </li>
        <li>
          <strong>Cobertura</strong> = Ingressos / PE
        </li>
        <li>
          <strong>PE mensual</strong> = PE del període ÷ n.mesos amb ingressos
          <br />
          <span className={styles.note}>
            Objectiu de vendes d&apos;un mes (p.ex. setembre) per arribar a l&apos;equilibri, amb
            l&apos;estructura de costos del període.
          </span>
        </li>
      </ol>
      <p className={styles.note}>
        Els conceptes INGRES i ALIE no entren al PE operatiu. Els subtotals s&apos;ignoren. El
        càlcul usa el total del període (no mitjanes mensuals). La natura és la configuració actual
        (no versionada per any).
      </p>
    </section>
  );
}
