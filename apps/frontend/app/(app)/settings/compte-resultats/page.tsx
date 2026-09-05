import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CompteEditor } from "./CompteEditor";
import { FormulaPe } from "./FormulaPe";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Compte de resultats — OpsiaFinance" };

export default async function CompteResultatsPage() {
  const [session, concepts] = await Promise.all([
    auth(),
    db.concepteResultat.findMany({
      orderBy: { ordre: "asc" },
      select: {
        id: true,
        node: true,
        descripcio: true,
        esSubtotal: true,
        isActive: true,
        natura: true,
        pctVariable: true,
      },
    }),
  ]);

  const role = session?.user?.role;
  const canEdit = role === "ADMIN";

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Estructura del compte de resultats</h1>
          <p className={styles.subtitle}>
            Conceptes, ordre i natura (ingrés / variable / fix / mixt / aliè). Amb mixt pots indicar
            el % variable (la resta és fix).
            {canEdit ? " Editable." : " Consulta."}
          </p>
        </div>
      </div>

      <FormulaPe />

      {concepts.length === 0 ? (
        <div className={styles.empty}>
          <h3>Encara no hi ha conceptes</h3>
          <p>Es creen automàticament en processar el primer compte de resultats a Dades.</p>
        </div>
      ) : (
        <CompteEditor concepts={concepts} canEdit={canEdit} />
      )}
    </div>
  );
}
