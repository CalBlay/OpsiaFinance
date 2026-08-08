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
      orderBy: { text: "asc" },
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
          Tarifa hora i mapeig text → centre + departament (Sala/Cuina). Cada text ha de coincidir
          amb Organizaciones o Proyecto (text sencer o part abans de la coma). Importa l&apos;excel
          o edita manualment.
        </p>
      </header>
      <TraspassPersonalSettingsPanel
        tarifaHora={tarifaHora}
        mapeigs={[...mapeigs]
          .sort((a, b) => a.text.localeCompare(b.text, "ca", { sensitivity: "base" }))
          .map((m) => ({
            id: m.id,
            text: m.text,
            departament: m.departament as "SALA" | "CUINA",
            centre: m.centre,
          }))}
        centres={centres}
        canEdit={canEdit}
      />
    </div>
  );
}
