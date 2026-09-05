import { FormulaPe } from "./FormulaPe";
import { NaturaConceptes } from "./NaturaConceptes";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fórmules i conceptes — OpsiaFinance" };

export default function FormulesPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Fórmules i conceptes</h1>
          <p className={styles.subtitle}>
            Consulta de definicions i càlculs usats a Resultats. La configuració operativa (natura
            dels conceptes) es fa a Compte de resultats.
          </p>
        </div>
      </div>

      <div className={styles.stack}>
        <NaturaConceptes />
        <FormulaPe />
      </div>
    </div>
  );
}
