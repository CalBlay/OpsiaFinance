import styles from "./page.module.css";

/** Referència de les natures usades al compte de resultats. */
export function NaturaConceptes() {
  return (
    <section className={styles.card} aria-labelledby="natura-conceptes-title">
      <h2 id="natura-conceptes-title" className={styles.cardTitle}>
        Natura dels conceptes
      </h2>
      <p className={styles.cardLead}>
        Cada concepte del compte (excepte subtotals) té una natura. Es configura a Compte de
        resultats i alimenta el càlcul del PE.
      </p>
      <ul className={styles.naturaList}>
        <li>
          <strong>Ingrés</strong> — base d&apos;ingressos (no és cost; el total d&apos;explotació és
          el node 6).
        </li>
        <li>
          <strong>Variable</strong> — cost que escala amb l&apos;activitat / vendes.
        </li>
        <li>
          <strong>Fix</strong> — cost independent del volum de vendes (a curt termini).
        </li>
        <li>
          <strong>Mixt</strong> — part variable i part fixa; indiques el % variable (la resta és
          fix).
        </li>
        <li>
          <strong>Aliè</strong> — fora del PE operatiu (financer, excepcional, moviments interns,
          etc.).
        </li>
      </ul>
    </section>
  );
}
