import { DadesPageShell } from "@/components/dades/DadesPageShell";
import { getDadesTabById } from "@/components/dades/dades-tabs";
import { auth } from "@/lib/auth";
import { getArbreSeleccio } from "@/lib/consultes";
import { db } from "@/lib/db";
import { AjustosManager } from "./AjustosManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ajustos — OpsiaFinance" };

const tab = getDadesTabById("ajustos");

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
    <DadesPageShell
      title={tab.title}
      description={
        <>
          {tab.description} {ajustos.length} ajust{ajustos.length !== 1 ? "os" : ""}.
        </>
      }
    >
      <AjustosManager arbre={arbre} concepts={concepts} ajustos={ajustosPlain} canEdit={canEdit} />
    </DadesPageShell>
  );
}
