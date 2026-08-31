import { DadesPageShell } from "@/components/dades/DadesPageShell";
import { getDadesTabById } from "@/components/dades/dades-tabs";
import { ExportInformeButton } from "@/components/export/ExportInformeButton";
import { RouteLoading } from "@/components/ui/RouteLoading";
import { auth } from "@/lib/auth";
import {
  getAnysAmbCostSalarialOTraspass,
  getComparativaForaCentreMes,
} from "@/lib/cost-salarial/comparativa-fora-centre";
import { getCentresRestaurants } from "@/lib/cost-salarial/consultes";
import {
  getCarreguesFitxerLlista,
  getCostSalarialRegistres,
  getDarrerMesCostSalarial,
} from "@/lib/dades-list";
import { costRegistresToExportInforme } from "@/lib/export/dades";
import { Suspense } from "react";
import navStyles from "./ComparativaForaCentre.module.css";
import { ComparativaForaCentrePanel } from "./ComparativaForaCentrePanel";
import { CostSalarialManager } from "./CostSalarialManager";
import { HistorialCostSalarial } from "./HistorialCostSalarial";

export const metadata = { title: "Cost salarial restaurants — OpsiaFinance" };

const tab = getDadesTabById("cost-salarial");

async function CostSalarialContent({
  searchParams,
}: {
  searchParams: Promise<{ any?: string; mes?: string; vista?: string }>;
}) {
  const sp = await searchParams;
  const mesUrl = sp.mes ? Number(sp.mes) : null;
  const vista = sp.vista === "comparativa" ? "comparativa" : "registres";

  const [session, centres, anys, carregues] = await Promise.all([
    auth(),
    getCentresRestaurants(),
    getAnysAmbCostSalarialOTraspass(),
    getCarreguesFitxerLlista("COST_SALARIAL"),
  ]);

  const anyFiltre = sp.any ? Number(sp.any) : (anys[0] ?? new Date().getFullYear());
  const mesFiltre =
    mesUrl ?? (vista === "registres" ? await getDarrerMesCostSalarial(anyFiltre) : null);

  const role = session?.user?.role;
  const canEdit = role === "ADMIN" || role === "EDICIO";

  const [comparativa, registres] = await Promise.all([
    vista === "comparativa" && mesFiltre
      ? getComparativaForaCentreMes(anyFiltre, mesFiltre)
      : Promise.resolve(null),
    vista === "registres" ? getCostSalarialRegistres(anyFiltre, mesFiltre) : Promise.resolve([]),
  ]);

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

export default function CostSalarialDadesPage({
  searchParams,
}: {
  searchParams: Promise<{ any?: string; mes?: string; vista?: string }>;
}) {
  return (
    <Suspense fallback={<RouteLoading label="Carregant cost salarial…" />}>
      <CostSalarialContent searchParams={searchParams} />
    </Suspense>
  );
}
