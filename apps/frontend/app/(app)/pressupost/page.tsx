import { ConsultaHeader } from "@/components/consultes/ConsultaHeader";
import styles from "@/components/consultes/report.module.css";
import Link from "next/link";
import local from "./page.module.css";

export const metadata = { title: "Pressupost — OpsiaFinance" };

export default function PressupostResumPage() {
  return (
    <div className={styles.report}>
      <ConsultaHeader
        title="Pressupost"
        subtitle="Creació del pla anual: vendes per línia de negoci i despesa per departament (Central)."
      />

      <div className={local.cards}>
        <Link href="/pressupost/ln" className={local.card}>
          <span className={local.cardTitle}>Per línia (vendes)</span>
          <span className={local.cardText}>
            Tipus A — vendes / EBITDA per LN. Restaurants: general o per centre, amb opció d’aplicar
            la suma al general.
          </span>
        </Link>
        <Link href="/pressupost/departaments" className={local.card}>
          <span className={local.cardTitle}>Per departament</span>
          <span className={local.cardText}>
            Tipus B — partides amb descripció, calendari (anual / periòdic) i resum per reunions de
            control.
          </span>
        </Link>
        <Link href="/pressupost/aprovacio" className={local.card}>
          <span className={local.cardTitle}>Aprovació</span>
          <span className={local.cardText}>
            Consolidar i confirmar plans. Desviacions vs real: més endavant.
          </span>
        </Link>
      </div>
    </div>
  );
}
