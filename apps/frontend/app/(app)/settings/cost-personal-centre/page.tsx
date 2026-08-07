import { auth } from "@/lib/auth";
import { llistaMapeigsCostPersonal } from "@/lib/cost-personal-centre/service";
import { db } from "@/lib/db";
import styles from "../traspass-personal/page.module.css";
import { CostPersonalCentreSettingsPanel } from "./CostPersonalCentreSettingsPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cost personal centre — OpsiaFinance" };

export default async function CostPersonalCentreSettingsPage() {
  const session = await auth();
  const canEdit = session?.user?.role === "ADMIN" || session?.user?.role === "EDICIO";

  const mapeigs = await llistaMapeigsCostPersonal();

  const centres = await db.centre.findMany({
    where: { isActive: true },
    orderBy: [{ liniaNegoci: { ordre: "asc" } }, { codi: "asc" }],
    select: { id: true, codi: true, nom: true },
  });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Cost personal per centre</h1>
        <p className={styles.subtitle}>
          Mapeig codi payroll → centre Opsia (+ Sala/Cuina si restaurant). El mapeig es fa
          manualment o important un Excel; no es regenera sol.
        </p>
      </header>
      <CostPersonalCentreSettingsPanel mapeigs={mapeigs} centres={centres} canEdit={canEdit} />
    </div>
  );
}
