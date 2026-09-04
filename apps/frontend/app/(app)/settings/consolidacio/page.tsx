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
  const canEdit = session?.user?.role === "ADMIN";

  const [normesRaw, nodeLabels] = await Promise.all([
    db.normaConsolidacio.findMany({
      orderBy: [{ grup: "asc" }, { ordre: "asc" }],
      include: {
        imports: { orderBy: [{ any: "desc" }, { mes: "asc" }] },
      },
    }),
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
    nodesOrigen: n.nodesOrigen,
    nodesDesti: n.nodesDesti,
    fontImport: n.fontImport,
    notaOrigen: n.notaOrigen,
    notaDesti: n.notaDesti,
    imports: n.imports.map((i) => ({
      id: i.id,
      any: i.any,
      mes: i.mes,
      import: Number(i.import_),
      nota: i.nota,
    })),
  }));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Normes de consolidació</h1>
        <p className={styles.subtitle}>
          Regles d&apos;eliminació per al total consolidat. Intra Cal Blay: Empresa (Cal Blay) i
          Consolidat. Inter-empresa (Cal Blay ↔ FDLC: lloguer, factures IC): només selector{" "}
          <strong>Consolidat</strong> + vista <strong>Gestió</strong>, amb el mateix rang de mesos
          de la consulta. Els imports fixos mensuals es consulten i editen a la taula de cada norma.
        </p>
      </header>
      <ConsolidacioPanel normes={normes} nodeLabels={nodeLabels} canEdit={canEdit} />
    </div>
  );
}
