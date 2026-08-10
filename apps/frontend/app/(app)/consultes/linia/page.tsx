import { ConsultaHeader } from "@/components/consultes/ConsultaHeader";
import { DetallCompteCollapsible } from "@/components/consultes/DetallCompteCollapsible";
import { GestioAvis } from "@/components/consultes/GestioAvis";
import { KpiInformeCards } from "@/components/consultes/KpiCards";
import type { PivotColumn, PivotRow } from "@/components/consultes/PivotTable";
import { PivotTableDrilldown } from "@/components/consultes/PivotTableDrilldown";
import type { KpiComite } from "@/components/consultes/PresentacioComite";
import { EvolucioChart } from "@/components/consultes/charts-dynamic";
import styles from "@/components/consultes/report.module.css";
import { ExportInformeButton } from "@/components/export/ExportInformeButton";
import { auth } from "@/lib/auth";
import {
  MESOS_CURTS,
  type VistaCompte,
  etiquetaRangMesos,
  getAnysAmbDades,
  getArbreSeleccio,
  getComparativaEmpresa,
  getEvolucioMensual,
  parseRangMesosFromSearchParams,
} from "@/lib/consultes";
import { etiquetaLiniaNegoci } from "@/lib/consultes-etiquetes";
import { etiquetaGrafic } from "@/lib/consultes-grafics";
import { slugFilename } from "@/lib/export/filename";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { liniesPerConsultaDetall } from "@/lib/grups-empresa";
import {
  NODE_COMPRES,
  NODE_COST_GESTIO,
  NODE_COST_SALARIAL,
  NODE_EBITDA,
  NODE_INGRESSOS,
  buildKpisInforme,
} from "@/lib/kpi-definitions";
import { OPSIA_CHART } from "@/lib/opsia-colors";
import { type RangMesos, esAnyComplet, etiquetaRangMesosLlarga, rangToQuery } from "@/lib/periodes";
import { aplicarVistaGestioEvolucioLn } from "@/lib/repartiment/gestio-consultes";
import { getInfoGestioConsulta } from "@/lib/repartiment/service";
import { ajustarImportConsultaAction } from "../actions";
import { LiniaResumPresentacio } from "../presenters-dynamic";
import { LiniaCentresLazy } from "./LiniaCentresLazy";
import type { FilaResumLinia } from "./LiniaResumPresentacio";
import { LiniaSelectors } from "./LiniaSelectors";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consulta per línia de negoci — OpsiaFinance" };

function retallaRang(rows: PivotRow[], rang: RangMesos): PivotRow[] {
  return rows.map((r) => {
    const valors = r.valors.slice(rang.des - 1, rang.fins);
    return {
      ...r,
      valors,
      total: valors.reduce((a, b) => a + b, 0),
    };
  });
}

function pctSobreIngressos(
  valor: number,
  ingressos: number,
  opts?: { signed?: boolean }
): number | null {
  if (!ingressos) return null;
  return opts?.signed
    ? (valor / Math.abs(ingressos)) * 100
    : (Math.abs(valor) / Math.abs(ingressos)) * 100;
}

export default async function ConsultaLiniaPage({
  searchParams,
}: {
  searchParams: Promise<{
    ln?: string;
    any?: string;
    mes?: string;
    des?: string;
    fins?: string;
    vista?: string;
  }>;
}) {
  const sp = await searchParams;
  const [session, arbre, anys, grup] = await Promise.all([
    auth(),
    getArbreSeleccio(),
    getAnysAmbDades(),
    getGrupEmpresaActual(),
  ]);

  const anyActual = sp.any ? Number(sp.any) : (anys[0] ?? new Date().getFullYear());
  const rang = parseRangMesosFromSearchParams(sp);

  const lnId = sp.ln ?? null;
  const vista: VistaCompte = sp.vista === "gestio" ? "gestio" : "directe";
  const canEdit = session?.user?.role === "ADMIN" && vista === "directe";

  const linies = liniesPerConsultaDetall(
    arbre.map((l) => ({ id: l.id, codi: l.codi, nom: l.nom })),
    grup
  );

  const periodeLabel = etiquetaRangMesos(rang, anyActual);
  const periodeLlarga = etiquetaRangMesosLlarga(rang, anyActual);
  const vistaLabel = vista === "gestio" ? "Gestió" : "Directe";

  // Resum multi-LN quan no n'hi ha cap de seleccionada.
  if (!lnId) {
    const [comp, evEmpresa] = await Promise.all([
      getComparativaEmpresa(anyActual, rang, vista, grup),
      getEvolucioMensual("empresa", null, anyActual, grup),
    ]);

    const findRow = (node: number) => comp.concepts.find((c) => c.node === node);
    const findEv = (node: number) => evEmpresa?.concepts.find((c) => c.node === node);

    const ingressosTotal = findRow(NODE_INGRESSOS)?.total ?? 0;
    const personalTotal = findRow(NODE_COST_SALARIAL)?.total ?? 0;
    const compresTotal = findRow(NODE_COMPRES)?.total ?? 0;
    const gestioTotal = findRow(NODE_COST_GESTIO)?.total ?? 0;
    const ebitdaTotal = findRow(NODE_EBITDA)?.total ?? 0;

    const kpisComite: KpiComite[] = [
      {
        label: "Ingressos",
        import_: ingressosTotal,
        hint: "Explotació",
        accent: "ingressos",
      },
      {
        label: "Personal",
        import_: personalTotal,
        pct: pctSobreIngressos(personalTotal, ingressosTotal),
        pctHint: "s/ ingressos",
        accent: "cost",
      },
      {
        label: "Compres",
        import_: compresTotal,
        pct: pctSobreIngressos(compresTotal, ingressosTotal),
        pctHint: "s/ ingressos",
        accent: "cost",
      },
      {
        label: "Gestió",
        import_: gestioTotal,
        pct: pctSobreIngressos(gestioTotal, ingressosTotal),
        pctHint: "s/ ingressos",
        accent: "cost",
      },
      {
        label: "EBITDA",
        import_: ebitdaTotal,
        pct: pctSobreIngressos(ebitdaTotal, ingressosTotal, { signed: true }),
        pctHint: "s/ ingressos",
        accent: "ebitda",
      },
    ];

    const mesIni = rang.des - 1;
    const mesFi = rang.fins;
    const sliceMes = <T,>(arr: T[]): T[] => (esAnyComplet(rang) ? arr : arr.slice(mesIni, mesFi));

    const perLn = {
      etiquetes: comp.linies.map(etiquetaGrafic),
      ingressos: findRow(NODE_INGRESSOS)?.valors ?? [],
      ebitda: findRow(NODE_EBITDA)?.valors ?? [],
      personal: findRow(NODE_COST_SALARIAL)?.valors ?? [],
      compres: findRow(NODE_COMPRES)?.valors ?? [],
      gestio: findRow(NODE_COST_GESTIO)?.valors ?? [],
    };

    const mensual = {
      mesos: sliceMes([...MESOS_CURTS]),
      ingressos: sliceMes(findEv(NODE_INGRESSOS)?.valors ?? []),
      ebitda: sliceMes(findEv(NODE_EBITDA)?.valors ?? []),
      personal: sliceMes(findEv(NODE_COST_SALARIAL)?.valors ?? []),
      compres: sliceMes(findEv(NODE_COMPRES)?.valors ?? []),
      gestio: sliceMes(findEv(NODE_COST_GESTIO)?.valors ?? []),
    };

    const totalIngAbs = Math.abs(ingressosTotal) || 0;
    const files: FilaResumLinia[] = comp.linies.map((l, i) => {
      const ingressos = perLn.ingressos[i] ?? 0;
      const ebitda = perLn.ebitda[i] ?? 0;
      return {
        id: l.id,
        name: etiquetaGrafic(l),
        ingressos,
        pctSobreTotal: totalIngAbs ? (Math.abs(ingressos) / totalIngAbs) * 100 : null,
        ebitda,
        ebitdaPct: ingressos ? (ebitda / Math.abs(ingressos)) * 100 : null,
        href: `/consultes/linia?ln=${l.id}&any=${anyActual}${rangToQuery(rang)}&vista=${vista}`,
      };
    });

    return (
      <div className={styles.page}>
        <ConsultaHeader
          title="Compte d'explotació · per línia de negoci"
          subtitle={`Resum de totes les línies · ${periodeLlarga} · ${vistaLabel}`}
          actions={
            <LiniaSelectors
              linies={linies}
              anys={anys.length ? anys : [anyActual]}
              lnId={null}
              any={anyActual}
              rang={rang}
              vista={vista}
            />
          }
        />

        {comp.buit ? (
          <div className={styles.prompt}>
            <h3>Sense dades</h3>
            <p>No hi ha dades de línies per {periodeLabel.toLowerCase()}.</p>
          </div>
        ) : (
          <LiniaResumPresentacio
            periode={periodeLlarga}
            vistaLabel={vistaLabel}
            kpis={kpisComite}
            mensual={mensual}
            perLn={perLn}
            files={files}
          />
        )}
      </div>
    );
  }

  // Detall d'una línia concreta.
  const [evRaw, infoGestio] = await Promise.all([
    getEvolucioMensual("linia", lnId, anyActual),
    vista === "gestio" ? getInfoGestioConsulta(anyActual, rang) : Promise.resolve(null),
  ]);

  let ev = evRaw;
  if (ev && vista === "gestio") {
    ev = {
      ...ev,
      concepts: await aplicarVistaGestioEvolucioLn(lnId, anyActual, ev.concepts),
    };
  }

  const findEvRow = (node: number) => ev?.concepts.find((c) => c.node === node);

  const valorKpi = (node: number) => {
    const row = findEvRow(node);
    if (!row) return 0;
    return row.valors.slice(rang.des - 1, rang.fins).reduce((s, v) => s + v, 0);
  };
  const kpis = ev && !ev.buit ? buildKpisInforme(valorKpi) : [];

  const mesosCols = MESOS_CURTS.slice(rang.des - 1, rang.fins);
  const columnsMes: PivotColumn[] = mesosCols.map((m, i) => ({
    key: String(rang.des - 1 + i),
    label: m,
  }));
  const rowsMes = ev ? retallaRang(ev.concepts, rang) : [];

  const chartSeries = ev
    ? [
        {
          name: "Ingressos",
          type: "bar" as const,
          color: OPSIA_CHART.ingressos,
          data: (findEvRow(NODE_INGRESSOS)?.valors ?? []).slice(rang.des - 1, rang.fins),
        },
        {
          name: "EBITDA",
          type: "line" as const,
          color: OPSIA_CHART.ebitda,
          data: (findEvRow(NODE_EBITDA)?.valors ?? []).slice(rang.des - 1, rang.fins),
        },
      ]
    : [];

  const buit = !ev || ev.buit;
  const lnLabel = ev?.titol ?? linies.find((l) => l.id === lnId);
  const lnEtiqueta =
    typeof lnLabel === "string" ? lnLabel : lnLabel ? etiquetaLiniaNegoci(lnLabel) : "";

  return (
    <div className={styles.page}>
      <ConsultaHeader
        title="Compte d'explotació · per línia de negoci"
        subtitle={`${ev?.titol ?? lnEtiqueta} — total de la línia · ${periodeLabel}${vista === "gestio" ? " · gestió" : " · directe SAP"}`}
        actions={
          <>
            <LiniaSelectors
              linies={linies}
              anys={anys.length ? anys : [anyActual]}
              lnId={lnId}
              any={anyActual}
              rang={rang}
              vista={vista}
            />
            <ExportInformeButton
              disabled={buit}
              filename={slugFilename(
                `compte-linia-${ev?.titol ?? (lnEtiqueta || "linia")}-${periodeLabel}`
              )}
              title="Compte d'explotació · per línia de negoci"
              subtitle={
                ev
                  ? `${ev.titol} — ${periodeLabel} · ${vista === "gestio" ? "Gestió" : "Directe"}`
                  : periodeLabel
              }
              columns={columnsMes}
              rows={rowsMes}
              totalLabel="Període"
              sheetName="Línia"
            />
          </>
        }
      />

      {buit ? (
        <div className={styles.prompt}>
          <h3>Sense dades</h3>
          <p>Aquesta línia no té dades per {periodeLabel.toLowerCase()}.</p>
        </div>
      ) : (
        <>
          <GestioAvis vista={vista} info={infoGestio} />
          <KpiInformeCards kpis={kpis} periodeLabel={periodeLabel} />

          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>
              Evolució de la línia · Ingressos i EBITDA · {periodeLabel}
            </h3>
            <EvolucioChart categories={mesosCols} series={chartSeries} height={360} />
          </div>

          <DetallCompteCollapsible defaultOpen title="Compte de la línia (total)">
            <PivotTableDrilldown
              columns={columnsMes}
              rows={rowsMes}
              totalLabel="Període"
              firstColLabel="Concepte"
              canEdit={canEdit}
              editConfig={canEdit ? { onSave: ajustarImportConsultaAction } : undefined}
              drilldown={{
                any: anyActual,
                vista,
                colMap: Object.fromEntries(
                  columnsMes.map((c, i) => [c.key, { mes: rang.des + i, liniaNegociId: lnId }])
                ),
              }}
            />
          </DetallCompteCollapsible>

          <LiniaCentresLazy
            lnId={lnId}
            anyActual={anyActual}
            rang={rang}
            vista={vista}
            canEdit={canEdit}
            periodeLabel={periodeLabel}
          />
        </>
      )}
    </div>
  );
}
