import { DadesPageShell } from "@/components/dades/DadesPageShell";
import { getDadesTabById } from "@/components/dades/dades-tabs";
import { ExportInformeButton } from "@/components/export/ExportInformeButton";
import { auth } from "@/lib/auth";
import { llistaCarreguesFitxer } from "@/lib/carrega-fitxer";
import {
  getAnysAmbCostSalarialOTraspass,
  getComparativaForaCentreMes,
} from "@/lib/cost-salarial/comparativa-fora-centre";
import { getCentresRestaurants } from "@/lib/cost-salarial/consultes";
import { db } from "@/lib/db";
import { costRegistresToExportInforme } from "@/lib/export/dades";
import navStyles from "./ComparativaForaCentre.module.css";
import { ComparativaForaCentrePanel } from "./ComparativaForaCentrePanel";
import { CostSalarialManager } from "./CostSalarialManager";
import { HistorialCostSalarial } from "./HistorialCostSalarial";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cost salarial restaurants — OpsiaFinance" };

const tab = getDadesTabById("cost-salarial");

export default async function CostSalarialDadesPage({
  searchParams,
}: {
  searchParams: Promise<{ any?: string; mes?: string; vista?: string }>;
}) {
  const sp = await searchParams;
  const mesFiltre = sp.mes ? Number(sp.mes) : null;
  const vista = sp.vista === "comparativa" ? "comparativa" : "registres";

  const [session, centres, anysRaw, carregues] = await Promise.all([
    auth(),
    getCentresRestaurants(),
    getAnysAmbCostSalarialOTraspass(),
    llistaCarreguesFitxer("COST_SALARIAL"),
  ]);

  const anys = anysRaw.length ? anysRaw : [new Date().getFullYear()];
  const anyFiltre = sp.any ? Number(sp.any) : anys[0];

  const role = session?.user?.role;
  const canEdit = role === "ADMIN" || role === "EDICIO";

  const comparativa =
    vista === "comparativa" && mesFiltre
      ? await getComparativaForaCentreMes(anyFiltre, mesFiltre)
      : null;

  const registres =
    vista === "registres"
      ? await db.costSalarialRestaurant.findMany({
          where: {
            period: {
              any: anyFiltre,
              ...(mesFiltre ? { mes: mesFiltre } : {}),
            },
          },
          orderBy: [
            { period: { any: "desc" } },
            { period: { mes: "desc" } },
            { centre: { codi: "asc" } },
            { departament: "asc" },
          ],
          select: {
            id: true,
            departament: true,
            totalSalari: true,
            incentiusMensual: true,
            incentiuTrimestral: true,
            horesExtres: true,
            altres: true,
            baixes: true,
            indemnitzacions: true,
            foraCentre: true,
            notes: true,
            updatedAt: true,
            period: { select: { any: true, mes: true, nom: true } },
            centre: { select: { id: true, codi: true, nom: true } },
          },
        })
      : [];

  const registresPlain = registres.map((r) => ({
    id: r.id,
    departament: r.departament as "SALA" | "CUINA",
    totalSalari: Number(r.totalSalari),
    incentiusMensual: Number(r.incentiusMensual),
    incentiuTrimestral: Number(r.incentiuTrimestral),
    horesExtres: Number(r.horesExtres),
    altres: Number(r.altres),
    baixes: Number(r.baixes),
    indemnitzacions: Number(r.indemnitzacions),
    foraCentre: Number(r.foraCentre),
    notes: r.notes,
    updatedAt: r.updatedAt.toISOString(),
    periodAny: r.period.any,
    periodMes: r.period.mes,
    periodNom: r.period.nom,
    centreId: r.centre.id,
    centreLabel: `${r.centre.codi} · ${r.centre.nom}`,
  }));

  const meta = `${registresPlain.length} registre${registresPlain.length !== 1 ? "s" : ""} · ${anyFiltre}${
    mesFiltre ? `/${mesFiltre}` : ""
  }`;

  const qAnyMes = `any=${anyFiltre}${mesFiltre ? `&mes=${mesFiltre}` : ""}`;

  return (
    <DadesPageShell
      title={tab.title}
      description={
        vista === "comparativa" ? (
          <>
            Comparativa Fora centre (Excel) vs traspassos d&apos;hores. {anyFiltre}
            {mesFiltre ? `/${mesFiltre}` : ""}.
          </>
        ) : (
          <>
            {tab.description} {meta}.
          </>
        )
      }
      actions={
        vista === "registres" ? (
          <ExportInformeButton
            informe={
              registresPlain.length
                ? costRegistresToExportInforme(registresPlain, {
                    any: anyFiltre,
                    mes: mesFiltre,
                    title: tab.title,
                  })
                : null
            }
          />
        ) : undefined
      }
    >
      <nav className={navStyles.nav}>
        <a
          href={`/dades/cost-salarial?${qAnyMes}`}
          className={`${navStyles.navLink} ${vista === "registres" ? navStyles.navLinkActive : ""}`}
        >
          Importacions
        </a>
        <a
          href={`/dades/cost-salarial?vista=comparativa&any=${anyFiltre}${mesFiltre ? `&mes=${mesFiltre}` : "&mes=1"}`}
          className={`${navStyles.navLink} ${vista === "comparativa" ? navStyles.navLinkActive : ""}`}
        >
          Comparativa Fora centre
        </a>
      </nav>

      {vista === "comparativa" ? (
        <ComparativaForaCentrePanel
          data={comparativa}
          anys={anys}
          filtreAny={anyFiltre}
          filtreMes={mesFiltre}
        />
      ) : (
        <>
          <HistorialCostSalarial items={carregues} canEdit={canEdit} />
          <CostSalarialManager
            centres={centres}
            anys={anys}
            registres={registresPlain}
            canEdit={canEdit}
            filtreAny={anyFiltre}
            filtreMes={mesFiltre}
          />
        </>
      )}
    </DadesPageShell>
  );
}
