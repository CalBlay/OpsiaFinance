"use client";

import type { CompteCostSalarial } from "@/lib/cost-salarial/compte";
import type { PartidaKey } from "@/lib/cost-salarial/partides";
import { OPSIA_CHART, OPSIA_CHART_SERIES } from "@/lib/opsia-colors";
import { formatNum } from "@/lib/utils";
import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import styles from "./CostSalarialPresentacio.module.css";
import { type ForaCentreDetallContext, ForaCentreDetallModal } from "./ForaCentreDetallModal";

const COLOR_SALA = OPSIA_CHART.sala;
const COLOR_CUINA = OPSIA_CHART.cuina;
const PIE_COLORS = [...OPSIA_CHART_SERIES];

export interface PartidaSlice {
  key: PartidaKey;
  label: string;
  import_: number;
  pct: number | null;
}

export interface RestaurantBarRow {
  id: string;
  name: string;
  sala: number;
  cuina: number;
  costTotal: number;
  pctVendes: number | null;
}

export interface PresentacioComparativaProps {
  mode: "comparativa";
  compte?: CompteCostSalarial;
  periode: string;
  totals: {
    costTotal: number;
    sala: number;
    cuina: number;
    vendes: number;
    pctSobreVendes: number | null;
    partides: PartidaSlice[];
    partidesSala: PartidaSlice[];
    partidesCuina: PartidaSlice[];
  };
  restaurants: RestaurantBarRow[];
}

export interface PresentacioRestaurantProps {
  mode: "restaurant" | "sala-cuina";
  vista: "restaurant" | "sala-cuina";
  compte: CompteCostSalarial;
  periode: string;
  titol: string;
  subtitol?: string;
  centreId: string;
  any: number;
  mes: number | null;
  costTotal: number;
  salaTotal: number;
  cuinaTotal: number;
  pctSala: number | null;
  pctCuina: number | null;
  pctSobreVendes: number | null;
  vendes: number;
  partidesTotals: PartidaSlice[];
  partidesSala: PartidaSlice[];
  partidesCuina: PartidaSlice[];
}

export type CostSalarialPresentacioProps = PresentacioComparativaProps | PresentacioRestaurantProps;

function pctTxt(pct: number | null, decimals = 1): string {
  if (pct == null) return "–";
  return `${formatNum(pct, decimals)}%`;
}

function formatEuro(v: number, decimals = 0): string {
  return `${formatNum(v, decimals)} €`;
}

function HeroScorecard({
  periode,
  titol,
  subtitol,
  costTotal,
  pctSobreVendes,
  sala,
  cuina,
  vendes,
}: {
  periode: string;
  titol: string;
  subtitol?: string;
  costTotal: number;
  pctSobreVendes: number | null;
  sala: number;
  cuina: number;
  vendes?: number;
}) {
  const total = sala + cuina || costTotal;
  const pctSala = total ? (sala / total) * 100 : 0;
  const pctCuina = total ? (cuina / total) * 100 : 0;
  const vendesVal = vendes ?? 0;
  const teVendes = Math.abs(vendesVal) > 0.005;

  return (
    <header className={styles.hero}>
      <div className={styles.heroHead}>
        <div className={styles.heroTitleRow}>
          <h2 className={styles.heroTitle}>{titol}</h2>
          <p className={styles.heroPeriode}>{periode}</p>
        </div>
        {subtitol ? <p className={styles.heroSub}>{subtitol}</p> : null}
      </div>

      <div className={styles.ratioStrip} aria-label="Vendes, cost personal i percentatge">
        <div className={styles.ratioCard}>
          <span className={styles.ratioLabel}>Vendes</span>
          <span className={styles.ratioValue}>{teVendes ? formatEuro(vendesVal) : "–"}</span>
          <span className={styles.ratioHint}>Ingressos del període</span>
        </div>
        <div className={styles.ratioCard} data-accent="cost">
          <span className={styles.ratioLabel}>Cost personal</span>
          <span className={styles.ratioValue}>{formatEuro(costTotal)}</span>
          <span className={styles.ratioHint}>Cost salarial total</span>
        </div>
        <div className={styles.ratioCard} data-accent="pct">
          <span className={styles.ratioLabel}>% sobre vendes</span>
          <span className={styles.ratioValueBig}>
            {pctSobreVendes != null && teVendes ? pctTxt(pctSobreVendes) : "–"}
          </span>
          <span className={styles.ratioHint}>Cost ÷ vendes</span>
        </div>
      </div>

      <div className={styles.heroSide}>
        <div className={styles.splitHead}>
          <span>Sala / Cuina</span>
          <span className={styles.splitVals}>
            <span data-tone="sala">{formatEuro(sala)}</span>
            <span data-tone="cuina">{formatEuro(cuina)}</span>
          </span>
        </div>
        <div
          className={styles.splitBar}
          role="img"
          aria-label={`Sala ${pctTxt(pctSala)}, Cuina ${pctTxt(pctCuina)}`}
        >
          <div
            style={{ width: `${pctSala}%`, background: COLOR_SALA }}
            title={`Sala ${pctTxt(pctSala)}`}
          />
          <div
            style={{ width: `${pctCuina}%`, background: COLOR_CUINA }}
            title={`Cuina ${pctTxt(pctCuina)}`}
          />
        </div>
        <div className={styles.splitLegend}>
          <span>
            <i style={{ background: COLOR_SALA }} /> Sala {pctTxt(pctSala)}
          </span>
          <span>
            <i style={{ background: COLOR_CUINA }} /> Cuina {pctTxt(pctCuina)}
          </span>
        </div>
      </div>
    </header>
  );
}

/** Pastís amb el pes % de cada partida sobre el cost (exclou partides només informatives). */
function PartidesPie({ partides, total }: { partides: PartidaSlice[]; total: number }) {
  const data = partides
    .filter((p) => p.import_ > 0.005 && p.pct != null)
    .map((p, i) => ({
      name: p.label,
      value: p.import_,
      pct: total ? (p.import_ / total) * 100 : 0,
      color: PIE_COLORS[i % PIE_COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);

  if (!data.length) {
    return <p className={styles.emptyChart}>Sense partides positives per al pastís.</p>;
  }

  return (
    <div className={styles.pieLayout}>
      <div className={styles.pieChart}>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={78}
              paddingAngle={1.5}
              stroke="none"
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, _n, item) => {
                const pct =
                  item && typeof item === "object" && "payload" in item
                    ? Number((item.payload as { pct?: number })?.pct ?? 0)
                    : 0;
                return [`${formatEuro(Number(value ?? 0))} (${pctTxt(pct)})`, "Import"];
              }}
              contentStyle={{
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: "0.5rem",
                fontSize: "0.82rem",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className={styles.pieLegend}>
        {data.map((d) => (
          <li key={d.name}>
            <i style={{ background: d.color }} />
            <span className={styles.pieName}>{d.name}</span>
            <span className={styles.piePct}>{pctTxt(d.pct)}</span>
            <span className={styles.pieEuro}>{formatEuro(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type StatementRow = {
  key: string;
  label: string;
  import_: number;
  pct: number | null;
  sala: number;
  cuina: number;
  clickable?: boolean;
};

/** Distribució = barra apilada % Sala / % Cuina de cada partida. */
function StatementTable({
  rows,
  costTotal,
  salaTotal,
  cuinaTotal,
  showDept = true,
  onCell,
}: {
  rows: StatementRow[];
  costTotal: number;
  salaTotal: number;
  cuinaTotal: number;
  showDept?: boolean;
  onCell?: (dept: "SALA" | "CUINA" | null, value: number) => void;
}) {
  const cell = (row: StatementRow, dept: "SALA" | "CUINA" | null, value: number) => {
    const txt = formatNum(value);
    if (row.clickable && onCell) {
      return (
        <button
          type="button"
          className={styles.cellBtn}
          onClick={() => onCell(dept, value)}
          title="Veure detall"
        >
          {txt}
        </button>
      );
    }
    return txt;
  };

  return (
    <div className={styles.statementWrap}>
      <table className={styles.statement} data-dept={showDept ? "1" : "0"}>
        <thead>
          <tr>
            <th className={styles.colLabel}>Partida</th>
            <th className={styles.colNum}>Import</th>
            <th className={styles.colPct}>Pes %</th>
            <th className={styles.colBar}>Distribució Sala/Cuina</th>
            {showDept && (
              <>
                <th className={styles.colNum}>Sala</th>
                <th className={styles.colNum}>Cuina</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const neg = r.import_ < -0.005;
            const absSala = Math.abs(r.sala);
            const absCuina = Math.abs(r.cuina);
            const deptSum = absSala + absCuina;
            const pctSala = deptSum > 0 ? (absSala / deptSum) * 100 : 0;
            const pctCuina = deptSum > 0 ? (absCuina / deptSum) * 100 : 0;
            return (
              <tr key={r.key} data-neg={neg || undefined}>
                <td className={styles.colLabel}>{r.label}</td>
                <td className={styles.colNum} data-neg={neg || undefined}>
                  {cell(r, null, r.import_)}
                </td>
                <td className={styles.colPct}>{pctTxt(r.pct)}</td>
                <td className={styles.colBar}>
                  {deptSum > 0.005 ? (
                    <div
                      className={styles.microTrack}
                      title={`Sala ${pctTxt(pctSala)} · Cuina ${pctTxt(pctCuina)}`}
                    >
                      {pctSala > 0.05 && (
                        <div
                          className={styles.microSeg}
                          style={{ width: `${pctSala}%`, background: COLOR_SALA }}
                        />
                      )}
                      {pctCuina > 0.05 && (
                        <div
                          className={styles.microSeg}
                          style={{ width: `${pctCuina}%`, background: COLOR_CUINA }}
                        />
                      )}
                    </div>
                  ) : (
                    <div className={styles.microTrack} />
                  )}
                </td>
                {showDept && (
                  <>
                    <td className={styles.colNum}>{cell(r, "SALA", r.sala)}</td>
                    <td className={styles.colNum}>{cell(r, "CUINA", r.cuina)}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td className={styles.colLabel}>Total</td>
            <td className={styles.colNum}>{formatNum(costTotal)}</td>
            <td className={styles.colPct}>100%</td>
            <td className={styles.colBar}>
              {(() => {
                const sum = Math.abs(salaTotal) + Math.abs(cuinaTotal);
                if (sum < 0.005) return null;
                const ps = (Math.abs(salaTotal) / sum) * 100;
                const pc = (Math.abs(cuinaTotal) / sum) * 100;
                return (
                  <div className={styles.microTrack}>
                    <div
                      className={styles.microSeg}
                      style={{ width: `${ps}%`, background: COLOR_SALA }}
                    />
                    <div
                      className={styles.microSeg}
                      style={{ width: `${pc}%`, background: COLOR_CUINA }}
                    />
                  </div>
                );
              })()}
            </td>
            {showDept && (
              <>
                <td className={styles.colNum}>{formatNum(salaTotal)}</td>
                <td className={styles.colNum}>{formatNum(cuinaTotal)}</td>
              </>
            )}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function RestaurantsCompact({ rows }: { rows: RestaurantBarRow[] }) {
  const sorted = [...rows].sort((a, b) => b.costTotal - a.costTotal);
  if (!sorted.length) return null;
  const max = Math.max(...sorted.map((r) => r.costTotal), 1);

  return (
    <ul className={styles.rankList}>
      {sorted.map((r) => {
        const pctSala = r.costTotal ? (r.sala / r.costTotal) * 100 : 0;
        const pctCuina = r.costTotal ? (r.cuina / r.costTotal) * 100 : 0;
        const width = (r.costTotal / max) * 100;
        return (
          <li key={r.id} className={styles.rankRow}>
            <div className={styles.rankMeta}>
              <span className={styles.rankName}>{r.name}</span>
              <span className={styles.rankTotal}>{formatEuro(r.costTotal)}</span>
            </div>
            <div className={styles.rankTrack} style={{ width: `${Math.max(10, width)}%` }}>
              <div style={{ width: `${pctSala}%`, background: COLOR_SALA }} />
              <div style={{ width: `${pctCuina}%`, background: COLOR_CUINA }} />
            </div>
            <div className={styles.rankHints}>
              <span>Sala {pctTxt(pctSala)}</span>
              <span>Cuina {pctTxt(pctCuina)}</span>
              {r.pctVendes != null && <span>· {pctTxt(r.pctVendes)} / vendes</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function PresentacioComparativaView({
  periode,
  compte = "directe",
  totals,
  restaurants,
}: {
  periode: string;
  compte?: CompteCostSalarial;
  totals: PresentacioComparativaProps["totals"];
  restaurants: RestaurantBarRow[];
}) {
  const statementRows: StatementRow[] = totals.partides.map((p, i) => ({
    key: p.key,
    label: p.label,
    import_: p.import_,
    pct: p.pct,
    sala: totals.partidesSala[i]?.import_ ?? 0,
    cuina: totals.partidesCuina[i]?.import_ ?? 0,
  }));

  return (
    <div className={styles.wrap}>
      <HeroScorecard
        periode={periode}
        titol="Tots els restaurants"
        costTotal={totals.costTotal}
        pctSobreVendes={totals.pctSobreVendes}
        sala={totals.sala}
        cuina={totals.cuina}
        vendes={totals.vendes}
      />

      <div className={styles.splitRow}>
        <section className={styles.panel}>
          <h3 className={styles.panelTitle}>Pes de cada partida</h3>
          <p className={styles.panelLead}>
            {compte === "gestio"
              ? "% sobre el cost (sense indemnitzacions)."
              : "% de cada concepte sobre el cost."}
          </p>
          <PartidesPie partides={totals.partides} total={totals.costTotal} />
        </section>

        <section className={styles.panel}>
          <h3 className={styles.panelTitle}>Statement de partides</h3>
          <p className={styles.panelLead}>
            {compte === "gestio"
              ? "Indemnitzacions només informatives: no entren al total."
              : "Import, pes i % Sala/Cuina."}
          </p>
          <StatementTable
            rows={statementRows.filter(
              (r) => Math.abs(r.import_) >= 0.005 || r.key === "foraCentre"
            )}
            costTotal={totals.costTotal}
            salaTotal={totals.sala}
            cuinaTotal={totals.cuina}
            showDept
          />
        </section>
      </div>

      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>Cost per restaurant</h3>
        <p className={styles.panelLead}>Sala + Cuina, ordenat per cost.</p>
        <RestaurantsCompact rows={restaurants} />
      </section>
    </div>
  );
}

function PresentacioRestaurantView(props: PresentacioRestaurantProps) {
  const [detall, setDetall] = useState<ForaCentreDetallContext | null>(null);

  const rows: StatementRow[] = props.partidesTotals.map((p, i) => ({
    key: p.key,
    label: p.label,
    import_: p.import_,
    pct: p.pct,
    sala: props.partidesSala[i]?.import_ ?? 0,
    cuina: props.partidesCuina[i]?.import_ ?? 0,
    clickable: p.key === "foraCentre",
  }));

  return (
    <div className={styles.wrap}>
      <HeroScorecard
        periode={props.periode}
        titol={props.titol}
        subtitol={props.subtitol}
        costTotal={props.costTotal}
        pctSobreVendes={props.pctSobreVendes}
        sala={props.salaTotal}
        cuina={props.cuinaTotal}
        vendes={props.vendes}
      />

      <div className={styles.splitRow}>
        <section className={styles.panel}>
          <h3 className={styles.panelTitle}>Pes de cada partida</h3>
          <p className={styles.panelLead}>
            {props.compte === "gestio"
              ? "% sobre el cost (sense indemnitzacions)."
              : "% de cada concepte sobre el cost."}
          </p>
          <PartidesPie partides={props.partidesTotals} total={props.costTotal} />
        </section>

        <section className={styles.panel}>
          <h3 className={styles.panelTitle}>Statement · partides</h3>
          <p className={styles.panelLead}>
            {props.compte === "gestio"
              ? "Fora centre = traspassos (+destí −origen). Indemnitzacions només informatives (no al total)."
              : "Fora centre = Excel. Clica per al detall."}
          </p>
          <StatementTable
            rows={rows}
            costTotal={props.costTotal}
            salaTotal={props.salaTotal}
            cuinaTotal={props.cuinaTotal}
            onCell={(dept, value) =>
              setDetall({
                centreId: props.centreId,
                centreLabel: props.titol,
                any: props.any,
                mes: props.mes,
                departament: dept,
                cellValue: value,
                compte: props.compte,
              })
            }
          />
        </section>
      </div>

      {detall && <ForaCentreDetallModal context={detall} onClose={() => setDetall(null)} />}
    </div>
  );
}

export function CostSalarialPresentacio(props: CostSalarialPresentacioProps) {
  if (props.mode === "comparativa") {
    return (
      <PresentacioComparativaView
        periode={props.periode}
        compte={props.compte}
        totals={props.totals}
        restaurants={props.restaurants}
      />
    );
  }
  return <PresentacioRestaurantView {...props} />;
}
