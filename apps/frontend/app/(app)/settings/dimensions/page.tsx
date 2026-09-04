import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DimensionsTree } from "./DimensionsTree";
import { ImportarArbreButton } from "./ImportarArbreButton";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dimensions — OpsiaFinance" };

export default async function DimensionsPage() {
  const [session, linies] = await Promise.all([
    auth(),
    db.liniaNegoci.findMany({
      orderBy: { ordre: "asc" },
      include: {
        centres: {
          orderBy: { ordre: "asc" },
          include: {
            departaments: { orderBy: { ordre: "asc" } },
          },
        },
      },
    }),
  ]);

  const role = session?.user?.role;
  const canEdit = role === "ADMIN";
  const hasData = linies.length > 0;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Arbre de Dimensions</h1>
          <p className={styles.subtitle}>
            Estructura de negoci en 3 nivells: Línia de Negoci → Centre → Departament.
            {canEdit ? " Editable i consultable." : " Consulta."}
          </p>
        </div>
        {canEdit && <ImportarArbreButton hasData={hasData} />}
      </div>

      {!hasData ? (
        <div className={styles.emptyState}>
          <h3>Encara no hi ha dimensions carregades</h3>
          <p>
            {canEdit
              ? "Clica «Importar des del fitxer» per carregar l'arbre des de l'Excel «Arbre de dimensions V030226.xlsx» que hi ha a l'arrel del projecte."
              : "Encara no s'ha carregat cap estructura de dimensions."}
          </p>
        </div>
      ) : (
        <DimensionsTree linies={linies} canEdit={canEdit} />
      )}
    </div>
  );
}
