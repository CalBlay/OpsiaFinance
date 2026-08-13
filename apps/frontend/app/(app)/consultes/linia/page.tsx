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
import { recalcularSubtotalsCompte } from "@/lib/compte-subtotals";
import {
  MESOS_CURTS,
  aplicarCapaVistaEvolucio,
  etiquetaRangMesos,
  getAnysAmbDades,
  getArbreSeleccio,
  getComparativaEmpresa,
  getEvolucioMensual,
  getEvolucioMensualPerVista,
  parseRangMesosFromSearchParams,
} from "@/lib/consultes";
import { etiquetaLiniaNegoci } from "@/lib/consultes-etiquetes";
import { etiquetaGrafic } from "@/lib/consultes-grafics";
import { db } from "@/lib/db";
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
import { aplicarDeltaPresentacioGestio } from "@/lib/repartiment/gestio-consultes";
import {
  CODI_LN_CENTRAL,
  fraccionsRepartimentDetall,
  nodesPresentacioGestio,
} from "@/lib/repartiment/nodes";
import {
  CODI_LN_GREEN_VITA,
  CODI_LN_RESTAURANTS,
  NOM_NORMA_ADMIN_REST_GREEN_VITA,
} from "@/lib/repartiment/personal-admin-restaurants";
import { carregarCostSapAdminRestaurants } from "@/lib/repartiment/personal-admin-restaurants-data";
import { calcularMovimentsPersonalDepartaments } from "@/lib/repartiment/personal-departaments";
import {
  carregarConfigPersonal,
  carregarCostPersonalDeptSc,
} from "@/lib/repartiment/personal-departaments-data";
import { getInfoGestioConsulta } from "@/lib/repartiment/service";
import { etiquetaVistaCompte, parseVistaCompte, vistaInclouRepartiment } from "@/lib/vista-compte";
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
  const vista = parseVistaCompte(sp.vista);
  const canEdit = session?.user?.role === "ADMIN" && vista === "directe";

  const linies = liniesPerConsultaDetall(
    arbre.map((l) => ({ id: l.id, codi: l.codi, nom: l.nom })),
    grup
  );

  const periodeLabel = etiquetaRangMesos(rang, anyActual);
  const periodeLlarga = etiquetaRangMesosLlarga(rang, anyActual);
  const vistaLabel = etiquetaVistaCompte(vista);

  // Resum multi-LN quan no n'hi ha cap de seleccionada.
  if (!lnId) {
    const [comp, evEmpresaRaw] = await Promise.all([
      getComparativaEmpresa(anyActual, rang, vista, grup),
      getEvolucioMensualPerVista("empresa", null, anyActual, grup, vista),
    ]);
    const evEmpresa = evEmpresaRaw
      ? {
          ...evEmpresaRaw,
          concepts: await aplicarCapaVistaEvolucio(
            "empresa",
            null,
            anyActual,
            evEmpresaRaw.concepts,
            grup,
            vista
          ),
        }
      : evEmpresaRaw;

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
        label: "Compres",
        import_: compresTotal,
        pct: pctSobreIngressos(compresTotal, ingressosTotal),
        pctHint: "s/ ingressos",
        accent: "cost",
      },
      {
        label: "Personal",
        import_: personalTotal,
        pct: pctSobreIngressos(personalTotal, ingressosTotal),
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
    getEvolucioMensualPerVista("linia", lnId, anyActual, grup, vista),
    vistaInclouRepartiment(vista) ? getInfoGestioConsulta(anyActual, rang) : Promise.resolve(null),
  ]);

  const ev = evRaw;
  const findEvRow = (node: number) => ev?.concepts.find((c) => c.node === node);

  /**
   * Base de Gestió per als KPI i la taula:
   * - Agenda = total mensual visible de Central × el seu Valor (%).
   * - Resta de LN = gestió pròpia + (total Central × el seu Valor (%)).
   * Els percentatges de totes les LN, inclosa Agenda, sumen 100%.
   *
   * La base és sempre la mateixa fila 30 que veu l'usuari al compte d'explotació,
   * mai el subtotal importat de SAP.
   */
  let gestioKpiMensual: number[] | null = null;
  let compresKpiMensual: number[] | null = null;
  let personalKpiMensual: number[] | null = null;
  let ebitdaKpiMensual: number[] | null = null;
  let esAgenda = false;
  let esAgendaCompres = false;
  let codiLnPersonal: string | null = null;
  if (ev && vistaInclouRepartiment(vista)) {
    const [central, normesGestio] = await Promise.all([
      db.liniaNegoci.findUnique({
        where: { codi: CODI_LN_CENTRAL },
        select: { id: true },
      }),
      db.normaRepartiment.findMany({
        where: {
          actiu: true,
          concepteNode: NODE_COST_GESTIO,
          tipus: "PERCENT_POOL_CENTRAL",
          valorPercent: { not: null },
        },
        select: { liniaNegociDestiId: true, valorPercent: true },
      }),
    ]);

    if (central) {
      esAgenda = central.id === lnId;
      const evCentral = esAgenda ? ev : await getEvolucioMensual("linia", central.id, anyActual);
      const gestioCentral =
        evCentral.concepts.find((c) => c.node === NODE_COST_GESTIO)?.valors ?? [];
      const gestioPropi = findEvRow(NODE_COST_GESTIO)?.valors ?? [];
      const percent = (ln: string) =>
        Number(normesGestio.find((n) => n.liniaNegociDestiId === ln)?.valorPercent ?? 0) / 100;
      const percentAgenda = percent(central.id);
      const percentLn = percent(lnId);

      gestioKpiMensual = gestioPropi.map((propi, i) => {
        const totalCentral = gestioCentral[i] ?? 0;
        if (esAgenda) return totalCentral * percentAgenda;
        return propi + totalCentral * percentLn;
      });
    }
  }

  /**
   * Compres:
   * 1. Central, 04, 05 i 06 reben el % sobre les vendes indicat a la norma.
   * 2. Aquestes quantitats es resten de TOTAL COMPRES Central (7 + 8).
   * 3. El restant es distribueix a 02 i 03 segons el pes de vendes mensual.
   */
  if (ev && vistaInclouRepartiment(vista)) {
    const lnsCompres = await db.liniaNegoci.findMany({
      where: { codi: { in: ["LN00000", "LN00002", "LN00003", "LN00004", "LN00005", "LN00006"] } },
      select: { id: true, codi: true },
    });
    const lnActual = lnsCompres.find((ln) => ln.id === lnId);

    if (lnActual) {
      const [normesCompres, evolucions] = await Promise.all([
        db.normaRepartiment.findMany({
          where: {
            actiu: true,
            concepteNode: NODE_COMPRES,
            tipus: { in: ["PERCENT_VENDES_PROPIES", "REPARTIMENT_PROPORCIONAL"] },
          },
          select: { liniaNegociDestiId: true, tipus: true, valorPercent: true },
        }),
        Promise.all(
          lnsCompres.map(
            async (ln) =>
              [
                ln.codi,
                ln.id === lnId ? ev : await getEvolucioMensual("linia", ln.id, anyActual),
              ] as const
          )
        ),
      ]);
      const evolucioPerCodi = new Map(evolucions);
      const valors = (codi: string, node: number) =>
        evolucioPerCodi.get(codi)?.concepts.find((row) => row.node === node)?.valors ?? [];
      const idPerCodi = new Map(lnsCompres.map((ln) => [ln.codi, ln.id]));
      const normaPercent = (codi: string) =>
        normesCompres.find(
          (n) =>
            n.liniaNegociDestiId === idPerCodi.get(codi) &&
            n.tipus === "PERCENT_VENDES_PROPIES" &&
            n.valorPercent != null
        );
      const teProporcional = (codi: string) =>
        normesCompres.some(
          (n) =>
            n.liniaNegociDestiId === idPerCodi.get(codi) && n.tipus === "REPARTIMENT_PROPORCIONAL"
        );
      const imputatPercent = (codi: string) => {
        const norma = normaPercent(codi);
        if (!norma) return null;
        const pct = Number(norma.valorPercent) / 100;
        return valors(codi, NODE_INGRESSOS).map((vendes) => -(Math.abs(vendes) * pct));
      };

      const imputatsFixos = new Map(
        ["LN00000", "LN00004", "LN00005", "LN00006"].map((codi) => [codi, imputatPercent(codi)])
      );
      const compresCentral = valors("LN00000", NODE_COMPRES);
      const poolRestant = compresCentral.map((total, mesIdx) => {
        let pool = total;
        for (const imputat of imputatsFixos.values()) {
          pool -= imputat?.[mesIdx] ?? 0;
        }
        return pool;
      });
      const compresPropies = valors(lnActual.codi, NODE_COMPRES);

      if (imputatsFixos.has(lnActual.codi)) {
        const imputat = imputatsFixos.get(lnActual.codi);
        if (imputat) {
          esAgendaCompres = lnActual.codi === "LN00000";
          const sumaSapPropia = ["LN00005", "LN00006"].includes(lnActual.codi);
          compresKpiMensual = imputat.map(
            (import_, mesIdx) => import_ + (sumaSapPropia ? (compresPropies[mesIdx] ?? 0) : 0)
          );
        }
      } else if (
        (lnActual.codi === "LN00002" || lnActual.codi === "LN00003") &&
        teProporcional(lnActual.codi)
      ) {
        const vendesEmpresa = valors("LN00002", NODE_INGRESSOS);
        const vendesCasaments = valors("LN00003", NODE_INGRESSOS);
        compresKpiMensual = poolRestant.map((pool, mesIdx) => {
          const vendesActual =
            lnActual.codi === "LN00002"
              ? Math.max(0, vendesEmpresa[mesIdx] ?? 0)
              : Math.max(0, vendesCasaments[mesIdx] ?? 0);
          const vendesTotal =
            Math.max(0, vendesEmpresa[mesIdx] ?? 0) + Math.max(0, vendesCasaments[mesIdx] ?? 0);
          const pes = vendesTotal > 0 ? vendesActual / vendesTotal : 0;
          return pool * pes + (compresPropies[mesIdx] ?? 0);
        });
      }
    }
  }

  /**
   * Personal SC:
   * - Pool = TOTAL COST SALARIAL visible de Central (13–16).
   * - Assignacions explícites per departament a 00/01/04/05/06.
   * - Sobrant a 02/03: mix (part a parts iguals + resta segons vendes mensuals)
   *   o pesos configurats sense vendes.
   */
  if (ev && vistaInclouRepartiment(vista)) {
    const [lnsPersonal, configPersonal] = await Promise.all([
      db.liniaNegoci.findMany({
        where: {
          codi: {
            in: ["LN00000", "LN00001", "LN00002", "LN00003", "LN00004", "LN00005", "LN00006"],
          },
        },
        select: { id: true, codi: true },
      }),
      carregarConfigPersonal(),
    ]);
    const lnActual = lnsPersonal.find((ln) => ln.id === lnId);

    if (lnActual) {
      codiLnPersonal = lnActual.codi;
      const evolucions = await Promise.all(
        lnsPersonal.map(
          async (ln) =>
            [
              ln.id,
              ln.id === lnId ? ev : await getEvolucioMensual("linia", ln.id, anyActual),
            ] as const
        )
      );
      const evolucioPerLn = new Map(evolucions);
      const lnIdByCodi = new Map(lnsPersonal.map((ln) => [ln.codi, ln.id]));
      const [centres, periods] = await Promise.all([
        db.centre.findMany({
          where: { liniaNegociId: { in: lnsPersonal.map((ln) => ln.id) } },
          select: { id: true, liniaNegociId: true },
        }),
        db.period.findMany({
          where: { any: anyActual },
          select: { id: true, mes: true },
        }),
      ]);
      const lnIdPerCentre = new Map(centres.map((centre) => [centre.id, centre.liniaNegociId]));
      const deltaTraspassPerLn = new Map(
        lnsPersonal.map((ln) => [ln.id, new Array<number>(12).fill(0)])
      );
      const execucionsTraspass = await db.execucioTraspassPersonal.findMany({
        where: {
          estat: "CONFIRMAT",
          periodId: { in: periods.map((period) => period.id) },
        },
        select: {
          periodId: true,
          moviments: {
            where: {
              OR: [
                { centreOrigenId: { in: centres.map((centre) => centre.id) } },
                { centreDestiId: { in: centres.map((centre) => centre.id) } },
              ],
            },
            select: { centreOrigenId: true, centreDestiId: true, import_: true },
          },
        },
      });
      const mesPerPeriodId = new Map(periods.map((period) => [period.id, period.mes]));
      for (const execucio of execucionsTraspass) {
        const mes = mesPerPeriodId.get(execucio.periodId);
        if (!mes) continue;
        for (const moviment of execucio.moviments) {
          const import_ = Number(moviment.import_);
          const lnOrigen = lnIdPerCentre.get(moviment.centreOrigenId);
          const lnDesti = lnIdPerCentre.get(moviment.centreDestiId);
          const deltasOrigen = lnOrigen ? deltaTraspassPerLn.get(lnOrigen) : null;
          const deltasDesti = lnDesti ? deltaTraspassPerLn.get(lnDesti) : null;
          if (deltasOrigen) deltasOrigen[mes - 1] = (deltasOrigen[mes - 1] ?? 0) + import_;
          if (deltasDesti) deltasDesti[mes - 1] = (deltasDesti[mes - 1] ?? 0) - import_;
        }
      }
      const personalDirecte = (findEvRow(NODE_COST_SALARIAL)?.valors ?? []).map(
        (valor, mesIdx) => valor + (deltaTraspassPerLn.get(lnActual.id)?.[mesIdx] ?? 0)
      );

      personalKpiMensual = await Promise.all(
        Array.from({ length: 12 }, async (_, mesIdx) => {
          const directe = new Map(
            lnsPersonal.map((ln) => {
              const nodes = new Map(
                (evolucioPerLn.get(ln.id)?.concepts ?? []).map((row) => [
                  row.node,
                  row.valors[mesIdx] ?? 0,
                ])
              );
              const deltaTraspass = deltaTraspassPerLn.get(ln.id)?.[mesIdx] ?? 0;
              if (deltaTraspass !== 0) {
                const detalls = nodesPresentacioGestio(NODE_COST_SALARIAL);
                const bases = detalls.map((node) => nodes.get(node) ?? 0);
                const fraccions = fraccionsRepartimentDetall(bases);
                for (let i = 0; i < detalls.length; i++) {
                  const node = detalls[i];
                  if (node == null) continue;
                  nodes.set(node, (nodes.get(node) ?? 0) + deltaTraspass * (fraccions[i] ?? 0));
                }
              }
              return [ln.id, nodes] as const;
            })
          );
          const [costs] = await Promise.all([carregarCostPersonalDeptSc(anyActual, mesIdx + 1)]);
          const moviments = calcularMovimentsPersonalDepartaments(
            costs,
            configPersonal.configsLn,
            configPersonal.configsDept,
            directe,
            lnIdByCodi,
            configPersonal.pesDefecte,
            configPersonal.fraccioSobrantIguals
          );
          const objectiu = moviments.find(
            (moviment) =>
              moviment.liniaNegociDestiId === lnActual.id &&
              moviment.concepteNode === NODE_COST_SALARIAL
          )?.importCalculat;

          // Sense retenció configurada, Central/Agenda queda a zero; la resta
          // de LN conserva el seu Directe si no rep cap assignació.
          if (objectiu != null) return objectiu;
          return lnActual.codi === CODI_LN_CENTRAL ? 0 : (personalDirecte[mesIdx] ?? 0);
        })
      );
    }
  }

  /** Traspàs específic: Administració Restaurants (LN00001) → Green Vita (LN00006). */
  if (
    vistaInclouRepartiment(vista) &&
    personalKpiMensual &&
    (codiLnPersonal === CODI_LN_RESTAURANTS || codiLnPersonal === CODI_LN_GREEN_VITA)
  ) {
    const [norma, periods] = await Promise.all([
      db.normaRepartiment.findFirst({
        where: { nom: NOM_NORMA_ADMIN_REST_GREEN_VITA, actiu: true, valorPercent: { not: null } },
        select: { valorPercent: true },
      }),
      db.period.findMany({
        where: { any: anyActual },
        select: { id: true, mes: true },
      }),
    ]);

    if (norma) {
      const periodIdPerMes = new Map(periods.map((period) => [period.mes, period.id]));
      const pct = Number(norma.valorPercent) / 100;
      const costsAdmin = await Promise.all(
        Array.from({ length: 12 }, (_, mesIdx) => {
          const periodId = periodIdPerMes.get(mesIdx + 1);
          return periodId ? carregarCostSapAdminRestaurants(periodId) : Promise.resolve(null);
        })
      );

      personalKpiMensual = personalKpiMensual.map((personal, mesIdx) => {
        const cost = costsAdmin[mesIdx];
        if (!cost) return personal;
        const quota = (Math.abs(cost.sous) + Math.abs(cost.seguretatSocial)) * pct;
        return codiLnPersonal === CODI_LN_GREEN_VITA ? personal - quota : personal + quota;
      });
    }
  }

  if (ev && (gestioKpiMensual || compresKpiMensual || personalKpiMensual)) {
    const ebitdaPropi = findEvRow(NODE_EBITDA)?.valors ?? [];
    const gestioPropia = findEvRow(NODE_COST_GESTIO)?.valors ?? [];
    const compresPropies = findEvRow(NODE_COMPRES)?.valors ?? [];
    const personalPropi = findEvRow(NODE_COST_SALARIAL)?.valors ?? [];
    ebitdaKpiMensual = ebitdaPropi.map(
      (ebitda, mesIdx) =>
        ebitda +
        (gestioKpiMensual?.[mesIdx] ?? gestioPropia[mesIdx] ?? 0) -
        (gestioPropia[mesIdx] ?? 0) +
        (compresKpiMensual?.[mesIdx] ?? compresPropies[mesIdx] ?? 0) -
        (compresPropies[mesIdx] ?? 0) +
        (personalKpiMensual?.[mesIdx] ?? personalPropi[mesIdx] ?? 0) -
        (personalPropi[mesIdx] ?? 0)
    );
  }

  const valorKpi = (node: number) => {
    const valors =
      node === NODE_COST_GESTIO && gestioKpiMensual
        ? gestioKpiMensual
        : node === NODE_COMPRES && compresKpiMensual
          ? compresKpiMensual
          : node === NODE_COST_SALARIAL && personalKpiMensual
            ? personalKpiMensual
            : node === NODE_EBITDA && ebitdaKpiMensual
              ? ebitdaKpiMensual
              : (findEvRow(node)?.valors ?? []);
    return valors.slice(rang.des - 1, rang.fins).reduce((s, v) => s + v, 0);
  };
  const kpis = ev && !ev.buit ? buildKpisInforme(valorKpi) : [];

  // Mateix càlcul que el KPI, aplicat als detalls de Compres (7–8), Personal
  // (13–16) i Gestió (18–29) perquè els totals i l'EBITDA quadrin amb Gestió.
  let conceptsTaula = ev?.concepts ?? [];
  if (
    ev &&
    vistaInclouRepartiment(vista) &&
    (gestioKpiMensual || compresKpiMensual || personalKpiMensual)
  ) {
    const rowsGestio = ev.concepts.map((row) => ({ ...row, valors: [...row.valors] }));
    const byNode = new Map(rowsGestio.map((row) => [row.node, row]));
    if (gestioKpiMensual) {
      const gestioDirecte = findEvRow(NODE_COST_GESTIO)?.valors ?? [];
      for (let mesIdx = 0; mesIdx < gestioKpiMensual.length; mesIdx++) {
        const delta = (gestioKpiMensual[mesIdx] ?? 0) - (gestioDirecte[mesIdx] ?? 0);
        aplicarDeltaPresentacioGestio(byNode, NODE_COST_GESTIO, mesIdx, delta, {
          substituirObjectiu: esAgenda,
        });
      }
    }

    if (compresKpiMensual) {
      const compresDirecte = findEvRow(NODE_COMPRES)?.valors ?? [];
      for (let mesIdx = 0; mesIdx < compresKpiMensual.length; mesIdx++) {
        const delta = (compresKpiMensual[mesIdx] ?? 0) - (compresDirecte[mesIdx] ?? 0);
        aplicarDeltaPresentacioGestio(byNode, NODE_COMPRES, mesIdx, delta, {
          substituirObjectiu: esAgendaCompres,
        });
      }
    }

    if (personalKpiMensual) {
      const personalDirecte = findEvRow(NODE_COST_SALARIAL)?.valors ?? [];
      for (let mesIdx = 0; mesIdx < personalKpiMensual.length; mesIdx++) {
        const delta = (personalKpiMensual[mesIdx] ?? 0) - (personalDirecte[mesIdx] ?? 0);
        aplicarDeltaPresentacioGestio(byNode, NODE_COST_SALARIAL, mesIdx, delta, {
          substituirObjectiu: esAgenda,
        });
      }
    }

    conceptsTaula = recalcularSubtotalsCompte(rowsGestio, rowsGestio);
  }

  const mesosCols = MESOS_CURTS.slice(rang.des - 1, rang.fins);
  const columnsMes: PivotColumn[] = mesosCols.map((m, i) => ({
    key: String(rang.des - 1 + i),
    label: m,
  }));
  const rowsMes = ev ? retallaRang(conceptsTaula, rang) : [];

  const valorsTaula = (node: number) =>
    conceptsTaula.find((c) => c.node === node)?.valors ?? findEvRow(node)?.valors ?? [];

  const chartSeries = ev
    ? [
        {
          name: "Ingressos",
          type: "bar" as const,
          color: OPSIA_CHART.ingressos,
          data: valorsTaula(NODE_INGRESSOS).slice(rang.des - 1, rang.fins),
        },
        {
          name: "EBITDA",
          type: "line" as const,
          color: OPSIA_CHART.ebitda,
          data: valorsTaula(NODE_EBITDA).slice(rang.des - 1, rang.fins),
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
        subtitle={`${ev?.titol ?? lnEtiqueta} — total de la línia · ${periodeLabel} · ${vistaLabel.toLowerCase()}`}
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
              subtitle={ev ? `${ev.titol} — ${periodeLabel} · ${vistaLabel}` : periodeLabel}
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
