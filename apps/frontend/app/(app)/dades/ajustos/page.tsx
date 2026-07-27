import { auth } from "@/lib/auth";
import { getArbreSeleccio } from "@/lib/consultes";
import { db } from "@/lib/db";
import { AjustosManager } from "./AjustosManager";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ajustos — OpsiaFinance" };

export default async function AjustosPage() {
  const [session, arbre, concepts, ajustos] = await Promise.all([
    auth(),
    getArbreSeleccio(),
    db.concepteResultat.findMany({
      where: { isActive: true },
      orderBy: { ordre: "asc" },
      select: { id: true, node: true, descripcio: true },
    }),
    db.ajust.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        import_: true,
        motiu: true,
        createdAt: true,
        concepteResultatId: true,
        centreId: true,
        liniaNegociId: true,
        period: { select: { any: true, mes: true, nom: true } },
        concepteResultat: { select: { descripcio: true } },
        centre: { select: { codi: true, nom: true } },
        liniaNegoci: { select: { codi: true, nom: true } },
        creatPerUser: { select: { name: true } },
      },
    }),
  ]);

  const role = session?.user?.role;
  const canEdit = role === "ADMIN" || role === "EDICIO";

  const ajustosPlain = ajustos.map((a) => ({
    id: a.id,
    import_: Number(a.import_),
    motiu: a.motiu,
    createdAt: a.createdAt.toISOString(),
    periodAny: a.period.any,
    periodMes: a.period.mes,
    periodNom: a.period.nom,
    concepteResultatId: a.concepteResultatId,
    centreId: a.centreId,
    liniaNegociId: a.liniaNegociId,
    concepte: a.concepteResultat.descripcio,
    centre: a.centre ? `${a.centre.codi} · ${a.centre.nom}` : null,
    liniaNegoci: a.liniaNegoci ? `${a.liniaNegoci.codi} · ${a.liniaNegoci.nom}` : null,
    autor: a.creatPerUser.name,
  }));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <p className={styles.subtitle}>
          Correccions manuals que se sumen a les dades SAP a les consultes. {ajustos.length} ajust
          {ajustos.length !== 1 ? "os" : ""}.
        </p>
      </div>

      <AjustosManager arbre={arbre} concepts={concepts} ajustos={ajustosPlain} canEdit={canEdit} />
    </div>
  );
}
