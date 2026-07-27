import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureConfigTraspassPersonal } from "@/lib/traspass-personal/service";
import { TraspassPersonalSettingsPanel } from "./TraspassPersonalSettingsPanel";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Traspassos de personal — OpsiaFinance" };

export default async function TraspassPersonalSettingsPage() {
  const session = await auth();
  const canEdit = session?.user?.role === "ADMIN" || session?.user?.role === "EDICIO";

  const tarifaHora = await ensureConfigTraspassPersonal();

  const [mapeigs, centres] = await Promise.all([
    db.mapeigTextCentreTreball.findMany({
      orderBy: { ordre: "asc" },
      include: { centre: { select: { id: true, codi: true, nom: true } } },
    }),
    db.centre.findMany({
      where: { isActive: true },
      orderBy: [{ liniaNegoci: { ordre: "asc" } }, { codi: "asc" }],
      select: { id: true, codi: true, nom: true },
    }),
  ]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Traspassos de personal</h1>
        <p className={styles.subtitle}>
          Tarifa hora i mapeig únic text → centre (vàlid per Organizaciones i Proyecto). Importa
          l&apos;excel de conversió o edita manualment.
        </p>
      </header>
      <TraspassPersonalSettingsPanel
        tarifaHora={tarifaHora}
        mapeigs={mapeigs}
        centres={centres}
        canEdit={canEdit}
      />
    </div>
  );
}
