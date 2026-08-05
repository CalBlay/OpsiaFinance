import styles from "@/components/consultes/report.module.css";
import { etiquetaCentre } from "@/lib/consultes-etiquetes";
import {
  PARTIDES_SALARIALS,
  getAnysCostSalarial,
  getCentresRestaurants,
  getComparativaRestaurants,
  getInformeRestaurant,
} from "@/lib/cost-salarial/consultes";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { grupFiltraRestaurantsNomesMirall } from "@/lib/grups-empresa";
import { MESOS_LLARGS } from "@/lib/periodes";
import { formatNum } from "@/lib/utils";
import { CostSalarialPresentacio } from "./CostSalarialPresentacio";
import { CostSalarialSelectors } from "./CostSalarialSelectors";
import { DetallNumericCollapsible } from "./DetallNumericCollapsible";
import local from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cost salarial restaurants — OpsiaFinance" };

function pctLabel(pct: number | null): string {
  if (pct == null) return "–";
  return `${formatNum(pct, 1)}%`;
}

function periodeLabel(any: number, mes: number | null): string {
  if (mes == null) return `Acumulat ${any}`;
  return `${MESOS_LLARGS[mes - 1]} ${any}`;
}

export default async function ConsultaCostSalarialPage({
  searchParams,
}: {
  searchParams: Promise<{ any?: string; mes?: string; centre?: string; vista?: string }>;
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
  // Sense ?mes= → acumulat de tot l'any (visió general de la línia).
  const mes = sp.mes ? Number(sp.mes) : null;
  const centreId =
    sp.centre && centres.some((c) => c.id === sp.centre)
      ? sp.centre
      : nomesMirall
        ? (centres[0]?.id ?? null)
        : (sp.centre ?? null);
  const vista: "comparativa" | "restaurant" | "sala-cuina" = nomesMirall
    ? centreId
      ? sp.vista === "sala-cuina"
        ? "sala-cuina"
        : "restaurant"
      : "comparativa"
    : sp.vista === "restaurant" || sp.vista === "sala-cuina"
      ? sp.vista
      : "comparativa";

  const periode = periodeLabel(anyActual, mes);

  const [comparativa, informe] = await Promise.all([
    vista === "comparativa" || !centreId
      ? getComparativaRestaurants(anyActual, mes)
      : Promise.resolve(null),
    centreId && (vista === "restaurant" || vista === "sala-cuina")
      ? getInformeRestaurant(centreId, anyActual, mes)
      : Promise.resolve(null),
  ]);

  // Amb FDLC (només CCR00008), la comparativa multi-centre no té sentit: filtrar files.
  const _comparativaFiltrada =
    comparativa && nomesMirall
      ? {
          ...comparativa,
          files: comparativa.files.filter((f) => centres.some((c) => c.id === f.centre.id)),
        }
      : comparativa;

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Cost salarial · restaurants</h1>
          <p className={styles.subtitle}>
            Vista per comité: targetes amb imports clars i un gràfic per pregunta (sense repetir la
            mateixa informació). Detall numèric a sota, opcional.
          </p>
        </div>
        <CostSalarialSelectors
          centres={centres}
          anys={anys}
          any={anyActual}
          mes={mes}
          centreId={centreId}
          vista={vista}
        />
      </div>

      {vista === "comparativa" || !centreId ? (
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
              periode={periode}
              totals={{
                costTotal: comparativa.totals.costTotal,
                sala: comparativa.totals.sala,
                cuina: comparativa.totals.cuina,
                pctSobreVendes: comparativa.totals.pctSobreVendes,
                partides: PARTIDES_SALARIALS.map((p) => {
                  const import_ = comparativa.totals.partides[p.key];
                  return {
                    key: p.key,
                    label: p.label,
                    import_,
                    pct: comparativa.totals.costTotal
                      ? (import_ / comparativa.totals.costTotal) * 100
                      : null,
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

            <DetallNumericCollapsible
              title="Detall numèric · comparativa per restaurant"
              caption="Imports en euros. % sobre vendes des del compte de resultats."
            >
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
                            href={`/consultes/cost-salarial?vista=restaurant&centre=${f.centre.id}&any=${anyActual}${mes ? `&mes=${mes}` : ""}`}
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
            mode={vista}
            vista={vista}
            periode={periode}
            titol={informe.centre.etiqueta}
            subtitol={informe.centre.codi}
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

          <DetallNumericCollapsible
            title={`Detall numèric · ${informe.centre.etiqueta}`}
            caption="Partides del cost salarial. El pes % és sobre el total del restaurant."
          >
            <div className={local.tableWrap}>
              <table className={local.table}>
                <thead>
                  <tr>
                    <th>Partida</th>
                    <th className={local.right}>Import</th>
                    <th className={local.right}>Pes %</th>
                    <th className={local.right}>Sala</th>
                    <th className={local.right}>Cuina</th>
                  </tr>
                </thead>
                <tbody>
                  {informe.partidesTotals.map((p, i) => (
                    <tr key={p.key}>
                      <td>{p.label}</td>
                      <td className={local.right}>{formatNum(p.import_)}</td>
                      <td className={local.right}>{pctLabel(p.pct)}</td>
                      <td className={local.right}>
                        {formatNum(informe.sala.partides[i]?.import_ ?? 0)}
                      </td>
                      <td className={local.right}>
                        {formatNum(informe.cuina.partides[i]?.import_ ?? 0)}
                      </td>
                    </tr>
                  ))}
                  <tr className={local.totalRow}>
                    <td>Total</td>
                    <td className={local.right}>{formatNum(informe.costTotal)}</td>
                    <td className={local.right}>100%</td>
                    <td className={local.right}>{formatNum(informe.sala.total)}</td>
                    <td className={local.right}>{formatNum(informe.cuina.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </DetallNumericCollapsible>
        </>
      )}
    </div>
  );
}
