import { auth } from "@/lib/auth";
import { generarMapeigDesDeFitxerLocal } from "@/lib/cost-personal-centre/auto-mapeig";
import { llistaMapeigsCostPersonal } from "@/lib/cost-personal-centre/service";
import { db } from "@/lib/db";
import styles from "../traspass-personal/page.module.css";
import { CostPersonalCentreSettingsPanel } from "./CostPersonalCentreSettingsPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cost personal centre — OpsiaFinance" };

export default async function CostPersonalCentreSettingsPage() {
  const session = await auth();
  const canEdit = session?.user?.role === "ADMIN" || session?.user?.role === "EDICIO";

  let mapeigs = await llistaMapeigsCostPersonal();
  let autoMissatge: string | null = null;

  // Si encara no hi ha mapeig, el generem des del fitxer del disc + centres Dimensions.
  if (canEdit && mapeigs.length === 0) {
    const r = await generarMapeigDesDeFitxerLocal({ substituirTot: false });
    autoMissatge = r.missatge;
    if (r.ok) mapeigs = await llistaMapeigsCostPersonal();
  }

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
          Mapeig codi payroll → centre Opsia (+ Sala/Cuina si restaurant). Es pot generar sol des de{" "}
          <code>Cost_Personal_*.xlsx</code> a l&apos;arrel del repo i els centres de Dimensions.
        </p>
      </header>
      <CostPersonalCentreSettingsPanel
        mapeigs={mapeigs}
        centres={centres}
        canEdit={canEdit}
        initialFeedback={autoMissatge ? { ok: mapeigs.length > 0, missatge: autoMissatge } : null}
      />
    </div>
  );
}
