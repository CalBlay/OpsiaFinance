import { ConsultaHeader } from "@/components/consultes/ConsultaHeader";
import styles from "@/components/consultes/report.module.css";
import { ExportInformeButton } from "@/components/export/ExportInformeButton";
import { etiquetaCentre } from "@/lib/consultes-etiquetes";
import type { CompteCostSalarial } from "@/lib/cost-salarial/compte";
import {
  PARTIDES_SALARIALS,
  getAnysCostSalarial,
  getCentresRestaurants,
  getComparativaRestaurants,
  getInformeRestaurant,
  pctPartidaSobreTotal,
} from "@/lib/cost-salarial/consultes";
import {
  costComparativaToExportInforme,
  costInformeToExportInforme,
} from "@/lib/export/restaurants";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { grupFiltraRestaurantsNomesMirall } from "@/lib/grups-empresa";
import { MESOS_LLARGS } from "@/lib/periodes";
import { formatNum } from "@/lib/utils";
import { CostSalarialPresentacio } from "../presenters-dynamic";
import { CostSalarialSelectors } from "./CostSalarialSelectors";
import { DetallNumericCollapsible } from "./DetallNumericCollapsible";
import { DetallNumericRestaurantTable } from "./DetallNumericRestaurantTable";
import local from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cost salarial restaurants — OpsiaFinance" };

type AmbitCost = "comparativa" | "restaurant" | "sala-cuina";

function pctLabel(pct: number | null): string {
  if (pct == null) return "–";
  return `${formatNum(pct, 1)}%`;
}

function periodeLabel(any: number, mes: number | null): string {
  if (mes == null) return `Acumulat ${any}`;
  return `${MESOS_LLARGS[mes - 1]} ${any}`;
}

function parseAmbit(sp: { ambit?: string; vista?: string }): AmbitCost {
  if (sp.ambit === "restaurant" || sp.ambit === "sala-cuina" || sp.ambit === "comparativa") {
    return sp.ambit;
  }
  // Compat URLs antigues (?vista=restaurant)
  if (sp.vista === "restaurant" || sp.vista === "sala-cuina" || sp.vista === "comparativa") {
    return sp.vista;
  }
  return "comparativa";
}

function parseVistaCompte(sp: { vista?: string; compte?: string }): CompteCostSalarial {
  if (sp.vista === "gestio" || sp.compte === "gestio") return "gestio";
  return "directe";
}

export default async function ConsultaCostSalarialPage({
  searchParams,
}: {
  searchParams: Promise<{
    any?: string;
    mes?: string;
    centre?: string;
    vista?: string;
    ambit?: string;
    compte?: string;
  }>;
}) {
  const sp = await searchParams;
  const grup = await getGrupEmpresaActual();
  const nomesMirall = grupFiltraRestaurantsNomesMirall(grup);
  const [centres, anysCost] = await Promise.all([
    getCentresRestaurants(nomesMirall),
    getAnysCostSalarial(),
  ]);

  const anyCalendari = new Date().getFullYear();
  const anyActual = sp.any
    ? Number(sp.any)
    : anysCost.includes(anyCalendari)
      ? anyCalendari
      : (anysCost[0] ?? anyCalendari);
  const anys = anysCost.length ? anysCost : [anyActual];
  const mes = sp.mes ? Number(sp.mes) : null;
  const vista = parseVistaCompte(sp);
  const ambit = parseAmbit(sp);
  const centreId = sp.centre && centres.some((c) => c.id === sp.centre) ? sp.centre : null;

  const periode = periodeLabel(anyActual, mes);
  const vistaLabel = vista === "gestio" ? "Gestió (traspassos)" : "Directe (Excel)";

  const [comparativa, informe] = await Promise.all([
    ambit === "comparativa" || !centreId
      ? getComparativaRestaurants(anyActual, mes, vista)
      : Promise.resolve(null),
    centreId && (ambit === "restaurant" || ambit === "sala-cuina")
      ? getInformeRestaurant(centreId, anyActual, mes, vista)
      : Promise.resolve(null),
  ]);

  const comparativaFiltrada =
    comparativa && nomesMirall
      ? {
          ...comparativa,
          files: comparativa.files.filter((f) => centres.some((c) => c.id === f.centre.id)),
        }
      : comparativa;

  const exportInforme =
    (ambit === "comparativa" || !centreId) && comparativaFiltrada && !comparativaFiltrada.buit
      ? costComparativaToExportInforme(comparativaFiltrada, { periode })
      : informe && !informe.buit
        ? costInformeToExportInforme(informe, { periode })
        : null;

  return (
    <div className={styles.page}>
      <ConsultaHeader
        title="Cost salarial · restaurants"
        subtitle={`${vistaLabel} · Fora centre: Excel o net +destí −origen. A gestió, indemnitzacions només informatives (no entren al total ni al % / vendes).`}
        actions={
          <>
            <CostSalarialSelectors
              centres={centres}
              anys={anys}
              any={anyActual}
              mes={mes}
              centreId={centreId}
              ambit={ambit}
              vista={vista}
            />
            <ExportInformeButton informe={exportInforme} />
          </>
        }
      />

      {ambit === "comparativa" || !centreId ? (
        !comparativa || comparativa.buit ? (
          <div className={styles.prompt}>
            <h3>Sense dades per {periode}</h3>
            <p>
              Puja l&apos;Excel de cost salarial a{" "}
              <a href="/dades/cost-salarial">Dades → Cost salarial</a>.
            </p>
          </div>
        ) : (
          <>
            <CostSalarialPresentacio
              mode="comparativa"
              compte={vista}
              periode={periode}
              totals={{
                costTotal: comparativa.totals.costTotal,
                sala: comparativa.totals.sala,
                cuina: comparativa.totals.cuina,
                vendes: comparativa.totals.vendes,
                pctSobreVendes: comparativa.totals.pctSobreVendes,
                partides: PARTIDES_SALARIALS.map((p) => {
                  const import_ = comparativa.totals.partides[p.key];
                  return {
                    key: p.key,
                    label: p.label,
                    import_,
                    pct: pctPartidaSobreTotal(p.key, import_, comparativa.totals.costTotal, vista),
                  };
                }),
                partidesSala: PARTIDES_SALARIALS.map((p) => {
                  const import_ = comparativa.totals.partidesSala[p.key];
                  return {
                    key: p.key,
                    label: p.label,
                    import_,
                    pct: pctPartidaSobreTotal(p.key, import_, comparativa.totals.sala, vista),
                  };
                }),
                partidesCuina: PARTIDES_SALARIALS.map((p) => {
                  const import_ = comparativa.totals.partidesCuina[p.key];
                  return {
                    key: p.key,
                    label: p.label,
                    import_,
                    pct: pctPartidaSobreTotal(p.key, import_, comparativa.totals.cuina, vista),
                  };
                }),
              }}
              restaurants={comparativa.files.map((f) => ({
                id: f.centre.id,
                name: f.centre.etiqueta,
                sala: f.sala,
                cuina: f.cuina,
                costTotal: f.costTotal,
                pctVendes: f.pctSobreVendes,
              }))}
            />

            <DetallNumericCollapsible title="Detall numèric · comparativa per restaurant">
              <div className={local.tableWrap}>
                <table className={local.table}>
                  <thead>
                    <tr>
                      <th>Restaurant</th>
                      <th className={local.right}>Sala</th>
                      <th className={local.right}>% Sala</th>
                      <th className={local.right}>Cuina</th>
                      <th className={local.right}>% Cuina</th>
                      <th className={local.right}>Cost total</th>
                      <th className={local.right}>Vendes</th>
                      <th className={local.right}>% / vendes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparativa.files.map((f) => (
                      <tr key={f.centre.id}>
                        <td>
                          <a
                            className={local.link}
                            href={`/consultes/cost-salarial?ambit=restaurant&vista=${vista}&centre=${f.centre.id}&any=${anyActual}${mes ? `&mes=${mes}` : ""}`}
                          >
                            {etiquetaCentre(f.centre)}
                          </a>
                        </td>
                        <td className={local.right}>{formatNum(f.sala)}</td>
                        <td className={local.right}>{pctLabel(f.pctSala)}</td>
                        <td className={local.right}>{formatNum(f.cuina)}</td>
                        <td className={local.right}>{pctLabel(f.pctCuina)}</td>
                        <td className={local.right}>{formatNum(f.costTotal)}</td>
                        <td className={local.right}>{formatNum(f.vendes)}</td>
                        <td className={local.right}>{pctLabel(f.pctSobreVendes)}</td>
                      </tr>
                    ))}
                    <tr className={local.totalRow}>
                      <td>Total</td>
                      <td className={local.right}>{formatNum(comparativa.totals.sala)}</td>
                      <td className={local.right}>
                        {pctLabel(
                          comparativa.totals.costTotal
                            ? (comparativa.totals.sala / comparativa.totals.costTotal) * 100
                            : null
                        )}
                      </td>
                      <td className={local.right}>{formatNum(comparativa.totals.cuina)}</td>
                      <td className={local.right}>
                        {pctLabel(
                          comparativa.totals.costTotal
                            ? (comparativa.totals.cuina / comparativa.totals.costTotal) * 100
                            : null
                        )}
                      </td>
                      <td className={local.right}>{formatNum(comparativa.totals.costTotal)}</td>
                      <td className={local.right}>{formatNum(comparativa.totals.vendes)}</td>
                      <td className={local.right}>{pctLabel(comparativa.totals.pctSobreVendes)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </DetallNumericCollapsible>
          </>
        )
      ) : !informe || informe.buit ? (
        <div className={styles.prompt}>
          <h3>Sense dades per aquest restaurant</h3>
          <p>No hi ha cost salarial carregat per {periode}.</p>
        </div>
      ) : (
        <>
          <CostSalarialPresentacio
            mode={ambit}
            vista={ambit}
            compte={vista}
            periode={periode}
            titol={informe.centre.etiqueta}
            subtitol={informe.centre.codi}
            centreId={informe.centre.id}
            any={anyActual}
            mes={mes}
            costTotal={informe.costTotal}
            salaTotal={informe.sala.total}
            cuinaTotal={informe.cuina.total}
            pctSala={informe.sala.pctSobreTotal}
            pctCuina={informe.cuina.pctSobreTotal}
            pctSobreVendes={informe.pctSobreVendes}
            vendes={informe.vendes}
            partidesTotals={informe.partidesTotals}
            partidesSala={informe.sala.partides}
            partidesCuina={informe.cuina.partides}
          />

          <DetallNumericCollapsible title={`Export / detall ampliat · ${informe.centre.etiqueta}`}>
            <DetallNumericRestaurantTable
              centreId={informe.centre.id}
              centreLabel={informe.centre.etiqueta}
              any={anyActual}
              mes={mes}
              compte={vista}
              partidesTotals={informe.partidesTotals}
              partidesSala={informe.sala.partides}
              partidesCuina={informe.cuina.partides}
              costTotal={informe.costTotal}
              salaTotal={informe.sala.total}
              cuinaTotal={informe.cuina.total}
            />
          </DetallNumericCollapsible>
        </>
      )}
    </div>
  );
}
