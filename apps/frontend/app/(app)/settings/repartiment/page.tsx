import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  syncGrupsRepartiment,
  syncNormaPersonalPrecuinats,
} from "@/lib/repartiment/normes-default";
import { decimalToNumber } from "@/lib/repartiment/serialize";
import { NormesRepartimentPanel } from "./NormesRepartimentPanel";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Normes de repartiment — OpsiaFinance" };

export default async function RepartimentSettingsPage() {
  const session = await auth();
  const canEdit = session?.user?.role === "ADMIN" || session?.user?.role === "EDICIO";

  await syncGrupsRepartiment();
  await syncNormaPersonalPrecuinats();

  const [normesRaw, grupsRaw] = await Promise.all([
    db.normaRepartiment.findMany({
      orderBy: { ordre: "asc" },
      include: {
        liniaNegociDesti: { select: { codi: true, nom: true } },
        grup: { select: { codi: true, nom: true } },
      },
    }),
    db.repartimentGrup.findMany({
      where: { isActive: true },
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
        <h1 className={styles.title}>Normes de repartiment</h1>
        <p className={styles.subtitle}>
          Configuració permanent del repartiment Central → LN. Els percentatges sobre vendes es
          recalculen cada mes; aquí defineixes les regles fixes i els grups proporcionals.
        </p>
      </header>
      <NormesRepartimentPanel normes={normes} grups={grups} canEdit={canEdit} />
    </div>
  );
}
