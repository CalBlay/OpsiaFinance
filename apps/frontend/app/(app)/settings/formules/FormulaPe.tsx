import styles from "./page.module.css";

/** Explica la fórmula del punt d'equilibri (PE) usada a les consultes. */
export function FormulaPe() {
  return (
    <section className={styles.card} aria-labelledby="pe-formula-title">
      <h2 id="pe-formula-title" className={styles.cardTitle}>
        Punt d&apos;equilibri (PE)
      </h2>
      <p className={styles.cardLead}>
        El PE es calcula amb els mateixos euros que tanquen l&apos;EBITDA del compte oficial, amb un
        MC% estable per no disparar el PE als mesos febles.
      </p>
      <ol className={styles.steps}>
        <li>
          <strong>Abast</strong> = només fulles de cost que entren a l&apos;EBITDA (node 32). Queden
          fora: financer, excepcional, amortitzacions i impost.
        </li>
        <li>
          <strong>Variables</strong> = despesa VARIABLE + MIXTE × (%&nbsp;var / 100)
        </li>
        <li>
          <strong>Fixos</strong> = despesa FIX + MIXTE × (1 − %&nbsp;var / 100) + Moviments interns
          (i altres ALIE dins d&apos;EBITDA)
        </li>
        <li>
          <strong>Despesa</strong> = −import del compte (costos negatius; un abonament redueix V/F)
        </li>
        <li>
          <strong>PE del període</strong> = Fixos_període ÷ (MC_període / Ingressos_període)
        </li>
        <li>
          <strong>PE mensual (gràfica)</strong> = Fixos_mes ÷ max(MC%_mes, MC%_període)
          <br />
          <span className={styles.note}>
            Si el mes té EBITDA positiu, el MC%_mes obliga PE ≤ Ingressos. El MC%_període suavitza
            mesos febles sense disparar el PE. Financer i amortitzacions no entren.
          </span>
        </li>
        <li>
          <strong>PE mensual (KPI)</strong> = PE del període ÷ n.mesos amb ingressos (referència
          mitjana)
        </li>
        <li>
          <strong>Cobertura</strong> = Ingressos / PE
        </li>
      </ol>
      <p className={styles.note}>
        Identitat al període: Ingressos − Variables − Fixos ≈ EBITDA. Els subtotals s&apos;ignoren.
        La natura és la configuració actual (no versionada per any).
      </p>

      <h3 className={styles.cardTitle} style={{ marginTop: "1.25rem", fontSize: "1rem" }}>
        PE per línia de negoci
      </h3>
      <ol className={styles.steps}>
        <li>
          <strong>Base</strong> = compte <strong>Gestió</strong> (mateixa base que l&apos;EBITDA
          Gestió).
        </li>
        <li>
          <strong>Traspassos d&apos;hores</strong> = forçats a variable (quan no hi ha capa Gestió).
        </li>
        <li>
          <strong>Estructura Central</strong> (KPI) = |Δ| del repartiment confirmat (compres +
          personal SC —fixes i sobrant 02/03— + gestió). No es resta Admin → Green Vita.
        </li>
      </ol>
      <p className={styles.note}>
        A Empresa / consolidat el mateix criteri (Fixos_mes ÷ MC%_període) sobre la vista triada.
      </p>
    </section>
  );
}
