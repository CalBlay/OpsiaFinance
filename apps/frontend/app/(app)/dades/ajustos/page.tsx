import { DadesPageShell } from "@/components/dades/DadesPageShell";
import { getDadesTabById } from "@/components/dades/dades-tabs";
import { ExportInformeButton } from "@/components/export/ExportInformeButton";
import { propostaAjustCentralPctSobreVendesGrup } from "@/lib/ajustos/proposta-central-pct-grup";
import { auth } from "@/lib/auth";
import { getArbreSeleccio } from "@/lib/consultes";
import { db } from "@/lib/db";
import { ajustosToExportInforme } from "@/lib/export/dades";
import { AjustosManager } from "./AjustosManager";
import { PropostaCentralPctPanel } from "./PropostaCentralPctPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ajustos - OpsiaFinance" };

const tab = getDadesTabById("ajustos");

export default async function AjustosPage() {
  const [arbre, concepts, ajustos, sessionResult, propostaResult] = await Promise.all([
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
    auth().then(
      (session) => ({ ok: true as const, session }),
      (error) => ({ ok: false as const, error })
    ),
    propostaAjustCentralPctSobreVendesGrup(2025, 32.5921).then(
      (proposta) => ({ ok: true as const, proposta }),
      (error) => ({ ok: false as const, error })
    ),
  ]);

  if (!sessionResult.ok) {
    console.error("[dades/ajustos] auth failed", sessionResult.error);
  }
  if (!propostaResult.ok) {
    console.error("[dades/ajustos] proposta central pct failed", propostaResult.error);
  }

  const session = sessionResult.ok ? sessionResult.session : null;
  const proposta = propostaResult.ok ? propostaResult.proposta : null;

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
    autor: a.creatPerUser.name || "Usuari desconegut",
  }));

  return (
    <DadesPageShell
      title={tab.title}
      description={
        <>
          {tab.description} {ajustos.length} ajust{ajustos.length !== 1 ? "os" : ""}.
        </>
      }
      actions={
        <ExportInformeButton
          informe={
            ajustosPlain.length ? ajustosToExportInforme(ajustosPlain, { title: tab.title }) : null
          }
        />
      }
    >
      {proposta ? <PropostaCentralPctPanel calc={proposta} /> : null}
      <AjustosManager arbre={arbre} concepts={concepts} ajustos={ajustosPlain} canEdit={canEdit} />
    </DadesPageShell>
  );
}
