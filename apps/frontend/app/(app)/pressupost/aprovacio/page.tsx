import { ConsultaHeader } from "@/components/consultes/ConsultaHeader";
import styles from "@/components/consultes/report.module.css";
import Link from "next/link";

export const metadata = { title: "Aprovació pressupost — OpsiaFinance" };

export default function PressupostAprovacioPage() {
  return (
    <div className={styles.report}>
      <ConsultaHeader
        title="Aprovació"
        subtitle="Consolidar plans LN + departaments i confirmar el pressupost d’exercici."
      />
      <p style={{ maxWidth: "36rem", color: "var(--color-muted-foreground)", fontSize: "0.9rem" }}>
        Properament: vista de consolidació, incongruències i aprovació global. Mentrestant pots
        confirmar cada unitat des de «Per línia».
      </p>
      <p style={{ marginTop: "1rem" }}>
        <Link href="/pressupost/ln" style={{ color: "var(--color-primary)", fontWeight: 600 }}>
          Anar a pressupost per LN →
        </Link>
      </p>
    </div>
  );
}
