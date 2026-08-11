import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NODE_COST_SALARIAL } from "@/lib/repartiment/nodes";
import { syncGrupsRepartiment } from "@/lib/repartiment/normes-default";
import { NOM_NORMA_ADMIN_REST_GREEN_VITA } from "@/lib/repartiment/personal-admin-restaurants";
import { ensureNormaAdminRestGreenVita } from "@/lib/repartiment/personal-admin-restaurants-data";
import {
  desactivarNormesPersonalObsoletes,
  ensureConfigPersonalInicial,
} from "@/lib/repartiment/personal-departaments-data";
import { decimalToNumber } from "@/lib/repartiment/serialize";
import { NormesRepartimentPanel } from "../NormesRepartimentPanel";
import { RepartimentSubNav } from "../RepartimentSubNav";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Normes compres i gestió — OpsiaFinance" };

export default async function RepartimentNormesPage() {
  const session = await auth();
  const canEdit = session?.user?.role === "ADMIN" || session?.user?.role === "EDICIO";

  await syncGrupsRepartiment();
  await ensureConfigPersonalInicial();
  await desactivarNormesPersonalObsoletes();
  await ensureNormaAdminRestGreenVita();

  const [normesRaw, grupsRaw] = await Promise.all([
    db.normaRepartiment.findMany({
      where: {
        OR: [
          { concepteNode: { not: NODE_COST_SALARIAL } },
          // Norma especial: 25% Admin restaurants (LN00001) → Green Vita
          { nom: NOM_NORMA_ADMIN_REST_GREEN_VITA },
        ],
      },
      orderBy: { ordre: "asc" },
      include: {
        liniaNegociDesti: { select: { codi: true, nom: true } },
        grup: { select: { codi: true, nom: true } },
      },
    }),
    db.repartimentGrup.findMany({
      where: {
        isActive: true,
        codi: { not: "GRUP_PERSONAL_CENTRAL" },
      },
      orderBy: { ordre: "asc" },
      include: {
        membres: {
          orderBy: { ordre: "asc" },
          include: { liniaNegoci: { select: { codi: true } } },
        },
      },
    }),
  ]);

  const normes = normesRaw.map((n) => ({
    id: n.id,
    nom: n.nom,
    tipus: n.tipus,
    actiu: n.actiu,
    ordre: n.ordre,
    concepteNode: n.concepteNode,
    valorPercent: decimalToNumber(n.valorPercent),
    valorImport: decimalToNumber(n.valorImport),
    liniaNegociDesti: n.liniaNegociDesti
      ? { codi: n.liniaNegociDesti.codi, nom: n.liniaNegociDesti.nom }
      : null,
    grup: n.grup ? { codi: n.grup.codi, nom: n.grup.nom } : null,
  }));

  const grups = grupsRaw.map((g) => ({
    codi: g.codi,
    nom: g.nom,
    membres: g.membres.map((m) => ({
      liniaNegoci: { codi: m.liniaNegoci.codi },
    })),
  }));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Repartiment</h1>
        <p className={styles.subtitle}>
          Normes de compres i gestió (Central → LN), més la norma de personal Admin restaurants →
          Green Vita. El personal de Serveis Centrals es configura a Personal SC.
        </p>
        <RepartimentSubNav />
      </header>
      <NormesRepartimentPanel normes={normes} grups={grups} canEdit={canEdit} />
    </div>
  );
}
