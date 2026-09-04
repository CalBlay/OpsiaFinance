import { auth } from "@/lib/auth";
import { llistaMapeigsCostPersonal } from "@/lib/cost-personal-centre/service";
import { db } from "@/lib/db";
import styles from "../traspass-personal/page.module.css";
import { CostPersonalCentreSettingsPanel } from "./CostPersonalCentreSettingsPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cost personal centre — OpsiaFinance" };

export default async function CostPersonalCentreSettingsPage() {
  const session = await auth();
  const canEdit = session?.user?.role === "ADMIN";

  const [mapeigs, arbre] = await Promise.all([
    llistaMapeigsCostPersonal(),
    db.liniaNegoci.findMany({
      where: { isActive: true },
      orderBy: { ordre: "asc" },
      select: {
        id: true,
        codi: true,
        nom: true,
        centres: {
          where: { isActive: true },
          orderBy: { ordre: "asc" },
          select: {
            id: true,
            codi: true,
            nom: true,
            departaments: {
              where: { isActive: true },
              orderBy: { ordre: "asc" },
              select: { id: true, codi: true, nom: true },
            },
          },
        },
      },
    }),
  ]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Cost personal per centre</h1>
        <p className={styles.subtitle}>
          Mapeja cada codi payroll (5 o 8 dígits) a LN → centre → departament. En importar la
          nòmina, el cost queda lligat a l&apos;arbre i a consultes es pot veure per LN, centre o
          departament.
        </p>
      </header>
      <CostPersonalCentreSettingsPanel mapeigs={mapeigs} arbre={arbre} canEdit={canEdit} />
    </div>
  );
}
