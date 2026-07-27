import { auth } from "@/lib/auth";
import { getNodeLabels } from "@/lib/consolidacio/labels-server";
import { ensureNormesConsolidacio } from "@/lib/consolidacio/normes-default";
import { db } from "@/lib/db";
import styles from "../repartiment/page.module.css";
import { ConsolidacioPanel } from "./ConsolidacioPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Normes de consolidació — OpsiaFinance" };

export default async function ConsolidacioSettingsPage() {
  await ensureNormesConsolidacio();

  const session = await auth();
  const canEdit = session?.user?.role === "ADMIN" || session?.user?.role === "EDICIO";

  const [normesRaw, nodeLabels] = await Promise.all([
    db.normaConsolidacio.findMany({ orderBy: [{ grup: "asc" }, { ordre: "asc" }] }),
    getNodeLabels(),
  ]);

  const normes = normesRaw.map((n) => ({
    id: n.id,
    codi: n.codi,
    nom: n.nom,
    descripcio: n.descripcio,
    grup: n.grup,
    tipus: n.tipus,
    ordre: n.ordre,
    actiu: n.actiu,
    nodeExcloure: n.nodeExcloure,
    nodesAjust: n.nodesAjust,
    grupEmpresaOrigen: n.grupEmpresaOrigen,
    nodeOrigen: n.nodeOrigen,
    grupEmpresaDesti: n.grupEmpresaDesti,
    nodeDesti: n.nodeDesti,
  }));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Normes de consolidació</h1>
        <p className={styles.subtitle}>
          Regles d&apos;eliminació per al total consolidat. Cal Blay intra-empresa s&apos;aplica
          avui a Consultes → Empresa. Les regles de grup empresarial (Cal Blay + FDLC) queden
          preparades per a la futura pestanya Consolidat.
        </p>
      </header>
      <ConsolidacioPanel normes={normes} nodeLabels={nodeLabels} canEdit={canEdit} />
    </div>
  );
}
