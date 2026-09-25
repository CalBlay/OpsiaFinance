import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { esSuperOAdmin } from "@/lib/roles";
import styles from "../traspass-personal/page.module.css";
import { BalancEsdevenimentsSettingsPanel } from "./BalancEsdevenimentsSettingsPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Balanç esdeveniments — OpsiaFinance" };

export default async function BalancEsdevenimentsSettingsPage() {
  const session = await auth();
  const canEdit = esSuperOAdmin(session?.user?.role);

  const [mapeigs, arbre] = await Promise.all([
    db.mapeigCentreBalancEsdeveniments.findMany({
      orderBy: { text: "asc" },
      include: {
        centre: {
          select: {
            id: true,
            codi: true,
            nom: true,
            liniaNegociId: true,
            liniaNegoci: { select: { id: true, codi: true, nom: true } },
          },
        },
      },
    }),
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
          select: { id: true, codi: true, nom: true },
        },
      },
    }),
  ]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Balanç esdeveniments</h1>
        <p className={styles.subtitle}>
          Mapeig del text de la fila 2 del balanç (A2) — o del nom de la pestanya si A2 és buit —
          cap a un centre de l&apos;arbre. Un Excel pot tenir moltes pestanyes (una per centre) o
          podeu pujar molts fitxers (càrrega massiva). L&apos;import crea ajustos «Regularització»
          només amb línies de detall.
        </p>
      </header>
      <BalancEsdevenimentsSettingsPanel
        mapeigs={[...mapeigs]
          .sort((a, b) => a.text.localeCompare(b.text, "ca", { sensitivity: "base" }))
          .map((m) => ({
            id: m.id,
            text: m.text,
            centre: m.centre,
          }))}
        arbre={arbre}
        canEdit={canEdit}
      />
    </div>
  );
}
