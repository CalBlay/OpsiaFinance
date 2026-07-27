import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { PeriodLinkList, UploadHoresForm } from "./TraspassPersonalPanel";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Traspassos de personal — OpsiaFinance" };

export default async function TraspassPersonalLlistaPage() {
  const session = await auth();
  const canEdit = session?.user?.role === "ADMIN" || session?.user?.role === "EDICIO";

  const periods = await db.period.findMany({
    where: { execucioTraspassPersonal: { isNot: null } },
    orderBy: [{ any: "desc" }, { mes: "desc" }],
    include: { execucioTraspassPersonal: { select: { id: true, estat: true } } },
  });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Traspassos de personal</h1>
        <p className={styles.subtitle}>
          Importa l&apos;excel mensual d&apos;hores i confirma els traspassos de cost salarial entre
          centres. S&apos;apliquen a la vista Gestió (tractat).{" "}
          <Link href="/dades/traspass-personal/resum" className={styles.resumLink}>
            Veure resum per mes i LN →
          </Link>
        </p>
      </header>

      <UploadHoresForm canEdit={canEdit} />
      <PeriodLinkList periods={periods} />
    </div>
  );
}
