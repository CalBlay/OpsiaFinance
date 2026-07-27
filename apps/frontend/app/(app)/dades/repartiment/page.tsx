import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Repartiment mensual — OpsiaFinance" };

export default async function RepartimentLlistaPage() {
  const session = await auth();
  const canEdit = session?.user?.role === "ADMIN" || session?.user?.role === "EDICIO";

  const periods = await db.period.findMany({
    where: { dadesResultat: { some: {} } },
    orderBy: [{ any: "desc" }, { mes: "desc" }],
    include: { execucioRepartiment: { select: { id: true, estat: true } } },
  });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Repartiment mensual</h1>
        <p className={styles.subtitle}>
          Calcula i confirma el repartiment de costos Central → LN per cada mes.
          {canEdit ? " Revisa abans de confirmar." : ""}
        </p>
      </header>

      {periods.length === 0 ? (
        <p className={styles.muted}>Encara no hi ha dades importades.</p>
      ) : (
        <section className={styles.card}>
          {periods.map((p) => (
            <div key={p.id} className={styles.linkRow}>
              <Link href={`/dades/repartiment/${p.id}`}>{p.nom}</Link>
              {p.execucioRepartiment ? (
                <span
                  className={`${styles.badge} ${
                    p.execucioRepartiment.estat === "CONFIRMAT"
                      ? styles.badgeConfirmat
                      : styles.badgeBorrador
                  }`}
                >
                  {p.execucioRepartiment.estat === "CONFIRMAT" ? "Confirmat" : "Esborrany"}
                </span>
              ) : (
                <span className={styles.muted}>Sense calcular</span>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
