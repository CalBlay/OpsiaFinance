import { DadesPageShell } from "@/components/dades/DadesPageShell";
import { getDadesTabById } from "@/components/dades/dades-tabs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { PeriodLinkList, UploadHoresForm } from "./TraspassPersonalPanel";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Traspassos de personal — OpsiaFinance" };

const tab = getDadesTabById("traspass-personal");

export default async function TraspassPersonalLlistaPage() {
  const session = await auth();
  const canEdit = session?.user?.role === "ADMIN" || session?.user?.role === "EDICIO";

  const periods = await db.period.findMany({
    where: { execucioTraspassPersonal: { isNot: null } },
    orderBy: [{ any: "desc" }, { mes: "desc" }],
    include: {
      execucioTraspassPersonal: {
        select: {
          id: true,
          estat: true,
          nomFitxer: true,
          createdAt: true,
          updatedAt: true,
          importacio: {
            select: {
              id: true,
              nomFitxer: true,
              createdAt: true,
              creatPerUser: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const items = periods.map((p) => ({
    id: p.id,
    nom: p.nom,
    any: p.any,
    mes: p.mes,
    execucioTraspassPersonal: p.execucioTraspassPersonal,
  }));

  return (
    <DadesPageShell
      title={tab.title}
      description={
        <>
          {tab.description}{" "}
          <Link href="/dades/traspass-personal/resum" className={styles.resumLink}>
            Veure resum per mes i LN →
          </Link>
        </>
      }
    >
      <PeriodLinkList periods={items} canEdit={canEdit} />
      <UploadHoresForm canEdit={canEdit} />
    </DadesPageShell>
  );
}
