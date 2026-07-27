"use client";

import type { PartidaKey } from "@/lib/cost-salarial/consultes";
import { formatNum } from "@/lib/utils";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "./CostSalarialPresentacio.module.css";

const COLOR_SALA = "#0ea5e9";
const COLOR_CUINA = "#f59e0b";
const COLORS_PARTIDES = [
  "#6366f1",
  "#16a34a",
  "#ec4899",
  "#14b8a6",
  "#8b5cf6",
  "#f97316",
  "#06b6d4",
  "#64748b",
];

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
  periode: string;
  totals: {
    costTotal: number;
    sala: number;
    cuina: number;
    pctSobreVendes: number | null;
    partides: PartidaSlice[];
  };
  restaurants: RestaurantBarRow[];
}

export interface PresentacioRestaurantProps {
  mode: "restaurant" | "sala-cuina";
  vista: "restaurant" | "sala-cuina";
  periode: string;
  titol: string;
  subtitol?: string;
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

function formatEuro(v: number): string {
  return `${formatNum(v)} €`;
}

function euroPctLabel(import_: number, pct: number): string {
  return `${formatNum(import_)} € · ${formatNum(pct, 1)}%`;
}

const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "0.5rem",
  fontSize: "0.85rem",
};

function KpiStrip({
  periode,
  titol,
  costTotal,
  sala,
  cuina,
  pctSobreVendes,
  vendes,
}: {
  periode: string;
  titol: string;
  costTotal: number;
  sala: number;
  cuina: number;
  pctSobreVendes: number | null;
  vendes?: number;
}) {
  const total = sala + cuina || costTotal;
  const pctSala = total ? (sala / total) * 100 : null;
  const pctCuina = total ? (cuina / total) * 100 : null;

  return (
    <header className={styles.kpiStrip}>
      <div className={styles.kpiHead}>
        <p className={styles.kpiEyebrow}>{periode}</p>
        <h2 className={styles.kpiTitle}>{titol}</h2>
      </div>
      <div className={styles.kpiCards}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Cost salarial</span>
          <span className={styles.kpiValue}>{formatEuro(costTotal)}</span>
          {pctSobreVendes != null && (
            <span className={styles.kpiHint}>{pctTxt(pctSobreVendes)} sobre vendes</span>
          )}
        </div>
        <div className={styles.kpiCard} data-accent="sala">
          <span className={styles.kpiLabel}>Sala</span>
          <span className={styles.kpiValue}>{formatEuro(sala)}</span>
          <span className={styles.kpiHint}>{pctTxt(pctSala)} del cost</span>
        </div>
        <div className={styles.kpiCard} data-accent="cuina">
          <span className={styles.kpiLabel}>Cuina</span>
          <span className={styles.kpiValue}>{formatEuro(cuina)}</span>
          <span className={styles.kpiHint}>{pctTxt(pctCuina)} del cost</span>
        </div>
        {vendes != null && vendes > 0 && (
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Vendes</span>
            <span className={styles.kpiValue}>{formatEuro(vendes)}</span>
            <span className={styles.kpiHint}>període seleccionat</span>
          </div>
        )}
      </div>
    </header>
  );
}

/** Comparativa per restaurant: una barra apilada + import total al final. */
function RestaurantsStacked({ rows }: { rows: RestaurantBarRow[] }) {
  const data = [...rows]
    .sort((a, b) => b.costTotal - a.costTotal)
    .map((r) => ({
      name: r.name,
      Sala: r.sala,
      Cuina: r.cuina,
      total: r.costTotal,
      totalLabel: formatEuro(r.costTotal),
    }));

  if (!data.length) return null;

  return (
    <ResponsiveContainer width="100%" height={Math.max(300, data.length * 48 + 72)}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 108, left: 4, bottom: 8 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={112}
          tick={{ fontSize: 12, fill: "var(--color-foreground)", fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: number, name) => [formatEuro(value as number), name]}
          contentStyle={tooltipStyle}
        />
        <Legend wrapperStyle={{ fontSize: "0.82rem" }} />
        <Bar dataKey="Sala" stackId="stack" fill={COLOR_SALA} maxBarSize={28} />
        <Bar
          dataKey="Cuina"
          stackId="stack"
          fill={COLOR_CUINA}
          radius={[0, 4, 4, 0]}
          maxBarSize={28}
        >
          <LabelList
            dataKey="totalLabel"
            position="right"
            style={{ fontSize: 12, fontWeight: 700, fill: "var(--color-foreground)" }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Composició del cost (sense Sala/Cuina): barres + import i % junts. */
function PartidesComposicio({ partides, total }: { partides: PartidaSlice[]; total: number }) {
  const rows = partides
    .filter((p) => p.import_ > 0)
    .sort((a, b) => b.import_ - a.import_)
    .map((p) => {
      const pct = total ? (p.import_ / total) * 100 : 0;
      return {
        name: p.label,
        import_: p.import_,
        pct,
        caption: euroPctLabel(p.import_, pct),
      };
    });

  if (!rows.length) {
    return <p className={styles.emptyChart}>Cap partida amb import en aquest període.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(240, rows.length * 40 + 48)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 128, left: 4, bottom: 4 }}>
        <XAxis type="number" hide domain={[0, "dataMax"]} />
        <YAxis
          type="category"
          dataKey="name"
          width={128}
          tick={{ fontSize: 11, fill: "var(--color-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: number, _n, item) => [
            euroPctLabel(value as number, item.payload.pct),
            "Import",
          ]}
          contentStyle={tooltipStyle}
        />
        <Bar dataKey="import_" radius={[0, 4, 4, 0]} maxBarSize={24}>
          {rows.map((_, i) => (
            <Cell key={i} fill={COLORS_PARTIDES[i % COLORS_PARTIDES.length]} />
          ))}
          <LabelList
            dataKey="caption"
            position="right"
            style={{ fontSize: 11, fontWeight: 600, fill: "var(--color-foreground)" }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Un sol gràfic per restaurant: cada partida = barra Sala + Cuina + total en €. */
function PartidesSalaCuinaUnificat({
  labels,
  sala,
  cuina,
  costTotal,
}: {
  labels: string[];
  sala: number[];
  cuina: number[];
  costTotal: number;
}) {
  const rows = labels
    .map((name, i) => {
      const s = sala[i] ?? 0;
      const c = cuina[i] ?? 0;
      const total = s + c;
      const pct = costTotal ? (total / costTotal) * 100 : 0;
      return { name, Sala: s, Cuina: c, total, caption: euroPctLabel(total, pct) };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);

  if (!rows.length) {
    return <p className={styles.emptyChart}>Sense desglossament per partida.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(280, rows.length * 44 + 64)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 128, left: 4, bottom: 8 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={128}
          tick={{ fontSize: 11, fill: "var(--color-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: number, name) => [formatEuro(value as number), name]}
          contentStyle={tooltipStyle}
        />
        <Legend wrapperStyle={{ fontSize: "0.82rem" }} />
        <Bar dataKey="Sala" stackId="p" fill={COLOR_SALA} maxBarSize={26} />
        <Bar dataKey="Cuina" stackId="p" fill={COLOR_CUINA} radius={[0, 4, 4, 0]} maxBarSize={26}>
          <LabelList
            dataKey="caption"
            position="right"
            style={{ fontSize: 11, fontWeight: 600, fill: "var(--color-foreground)" }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CostSalarialPresentacio(props: CostSalarialPresentacioProps) {
  if (props.mode === "comparativa") {
    const { totals, periode, restaurants } = props;
    return (
      <div className={styles.wrap}>
        <KpiStrip
          periode={periode}
          titol="Tots els restaurants"
          costTotal={totals.costTotal}
          sala={totals.sala}
          cuina={totals.cuina}
          pctSobreVendes={totals.pctSobreVendes}
        />

        <article className={styles.chartCardWide}>
          <h3 className={styles.chartTitle}>Cost per restaurant</h3>
          <p className={styles.chartLead}>
            Sala (blau) i Cuina (taronja). L&apos;import total del local apareix al final de cada
            barra.
          </p>
          <RestaurantsStacked rows={restaurants} />
        </article>

        <article className={styles.chartCardWide}>
          <h3 className={styles.chartTitle}>De què està fet el cost</h3>
          <p className={styles.chartLead}>
            Salari base, incentius, hores extres i altres — amb import i pes sobre el total.
          </p>
          <PartidesComposicio partides={totals.partides} total={totals.costTotal} />
        </article>
      </div>
    );
  }

  const labels = props.partidesTotals.map((p) => p.label);
  const salaVals = props.partidesSala.map((p) => p.import_);
  const cuinaVals = props.partidesCuina.map((p) => p.import_);

  return (
    <div className={styles.wrap}>
      <KpiStrip
        periode={props.periode}
        titol={props.titol}
        costTotal={props.costTotal}
        sala={props.salaTotal}
        cuina={props.cuinaTotal}
        pctSobreVendes={props.pctSobreVendes}
        vendes={props.vendes}
      />

      <article className={styles.chartCardWide}>
        <h3 className={styles.chartTitle}>Partides per Sala i Cuina</h3>
        <p className={styles.chartLead}>
          Una fila per concepte: repartiment Sala/Cuina i total de la partida en euros i
          percentatge.
        </p>
        <PartidesSalaCuinaUnificat
          labels={labels}
          sala={salaVals}
          cuina={cuinaVals}
          costTotal={props.costTotal}
        />
      </article>
    </div>
  );
}
