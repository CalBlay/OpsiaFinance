"use client";

import { KpiComparatiuCards } from "@/components/consultes/KpiCards";
import { OpsiaKpiCard, OpsiaKpiCardRow } from "@/components/consultes/OpsiaKpiCard";
import type { KpiComparatiuItem } from "@/lib/kpi-definitions";
import {
  OPSIA_CHART,
  OPSIA_CHART_SERIES,
  OPSIA_GREEN,
  OPSIA_INK,
  OPSIA_YELLOW,
} from "@/lib/opsia-colors";
import { cn, formatNum } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "./PresentacioComparativa.module.css";
import reportStyles from "./report.module.css";

export type SerieComparativaAny = {
  label: string;
  vendes: number;
  ebitda: number;
  personal: number;
  compres: number;
  gestio: number;
  /** Vendes empresa (només mode LN). */
  vendesEmpresa?: number;
  /** Pes % = vendes LN / vendes empresa. */
  pesEmpresa?: number | null;
};

export type SerieComparativaMes = {
  mes: string;
  [key: string]: string | number;
};

export type KpiPesEmpresa = {
  pesActual: number | null;
  pesAnterior: number | null;
  vendesEmpresa: number;
  vendesEmpresaAnterior: number | null;
  refLabel: string | null;
  actualLabel: string | null;
};

/** Pes de vendes per LN (mode empresa). */
export type PesLnComparativa = {
  linies: { key: string; name: string }[];
  /** Distribució € per any (selector al pastís). */
  perAny: {
    label: string;
    segments: { name: string; value: number; key: string }[];
  }[];
};

function formatEix(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(Math.round(v));
}

function euroTip(value: number): string {
  return `${formatNum(value)} €`;
}

function pctTip(value: number): string {
  return `${formatNum(value, 1)} %`;
}

const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "0.65rem",
  fontSize: "0.85rem",
};

function costPos(v: number): number {
  return Math.abs(v);
}

function variacioPct(actual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((actual - anterior) / Math.abs(anterior)) * 100;
}

function ChartCard({
  title,
  children,
  wide,
  actions,
  dense,
  bare,
}: {
  title: string;
  children: React.ReactNode;
  wide?: boolean;
  actions?: React.ReactNode;
  /** Menys padding — pastís a pantalla completa dins la targeta. */
  dense?: boolean;
  /** Sense marc ni fons: prioritat a la dada. */
  bare?: boolean;
}) {
  return (
    <section
      className={cn(
        styles.chartCard,
        wide && styles.chartCardWide,
        dense && styles.chartCardDense,
        bare && styles.chartCardBare
      )}
    >
      <div className={styles.chartHead}>
        <h3 className={styles.chartTitle}>{title}</h3>
        {actions ? <div className={styles.chartActions}>{actions}</div> : null}
      </div>
      <div className={cn(styles.chartBody, dense && styles.chartBodyFill)}>{children}</div>
    </section>
  );
}

function AnyLegend({
  anys,
  colors,
}: {
  anys: number[];
  colors: readonly string[];
}) {
  const last = anys.length - 1;
  return (
    <ul className={styles.anyLegend} aria-label="Anys">
      {anys.map((year, i) => {
        const color = colors[(last - i) % colors.length] ?? colors[0] ?? "#245956";
        return (
          <li key={year} className={cn(styles.anyLegendItem, i === last && styles.anyLegendActual)}>
            <span
              className={styles.anySwatch}
              style={{
                background: color,
                ...(i === last
                  ? undefined
                  : {
                      backgroundColor: "transparent",
                      border: `2px solid ${color}`,
                      backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 7px)`,
                    }),
              }}
              aria-hidden
            />
            <span className={styles.anyYear}>{year}</span>
            {i === last ? <span className={styles.anyTag}>actual</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

function EndYearLabel({
  year,
  color,
  isActual,
  x,
  y,
  index,
  lastIndex,
}: {
  year: number;
  color: string;
  isActual: boolean;
  x?: number | string;
  y?: number | string;
  index?: number;
  lastIndex: number;
}) {
  if (index !== lastIndex || x == null || y == null) return null;
  const nx = Number(x);
  const ny = Number(y);
  return (
    <text
      x={nx + 8}
      y={ny}
      fill={color}
      fontSize={isActual ? 13 : 12}
      fontWeight={isActual ? 800 : 700}
      dominantBaseline="middle"
      style={{ pointerEvents: "none" }}
    >
      {year}
    </text>
  );
}

function acumularSerie(
  data: SerieComparativaMes[],
  anys: number[],
  prefix: "v_" | "e_"
): SerieComparativaMes[] {
  const running: Record<string, number> = {};
  for (const y of anys) running[`${prefix}${y}`] = 0;
  return data.map((row) => {
    const out: SerieComparativaMes = { mes: row.mes };
    for (const y of anys) {
      const key = `${prefix}${y}`;
      const next = (running[key] ?? 0) + Number(row[key] ?? 0);
      running[key] = next;
      out[key] = next;
    }
    return out;
  });
}

function TendenciaMensualChart({
  title,
  data,
  anys,
  dataKeyPrefix,
}: {
  title: string;
  data: SerieComparativaMes[];
  anys: number[];
  dataKeyPrefix: "v_" | "e_";
}) {
  const [mode, setMode] = useState<"mes" | "acumulat">("acumulat");
  const lastIdx = anys.length - 1;
  const lastPoint = data.length - 1;
  const wide = dataKeyPrefix === "v_" && title.includes("LN");
  const chartData = mode === "acumulat" ? acumularSerie(data, anys, dataKeyPrefix) : data;

  return (
    <ChartCard
      title={title}
      wide={wide}
      actions={
        <fieldset className={styles.modeToggle} aria-label="Vista temporal">
          <legend className={styles.srOnly}>Vista temporal</legend>
          <button
            type="button"
            className={cn(styles.modeBtn, mode === "mes" && styles.modeBtnOn)}
            onClick={() => setMode("mes")}
          >
            Mes
          </button>
          <button
            type="button"
            className={cn(styles.modeBtn, mode === "acumulat" && styles.modeBtnOn)}
            onClick={() => setMode("acumulat")}
          >
            Acumulat
          </button>
        </fieldset>
      }
    >
      <AnyLegend anys={anys} colors={OPSIA_CHART_SERIES} />
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 12, right: 44, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="mes"
            tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
            axisLine={{ stroke: "var(--color-border)" }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatEix}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            formatter={(v, name) => [
              euroTip(Number(v ?? 0)),
              mode === "acumulat" ? `${name} · acum.` : String(name),
            ]}
            contentStyle={tooltipStyle}
          />
          {anys.map((year, i) => {
            const isActual = i === lastIdx;
            const color =
              OPSIA_CHART_SERIES[(lastIdx - i) % OPSIA_CHART_SERIES.length] ??
              OPSIA_CHART_SERIES[0];
            return (
              <Line
                key={`${dataKeyPrefix}${year}`}
                type="monotone"
                dataKey={`${dataKeyPrefix}${year}`}
                name={String(year)}
                stroke={color}
                strokeWidth={isActual ? 3.5 : 2}
                strokeDasharray={isActual ? undefined : i % 2 === 0 ? "6 4" : "2 3"}
                dot={{ r: isActual ? 4.5 : 3, fill: color, strokeWidth: 0 }}
                activeDot={{ r: isActual ? 6 : 5 }}
              >
                <LabelList
                  dataKey={`${dataKeyPrefix}${year}`}
                  content={(props) => (
                    <EndYearLabel
                      year={year}
                      color={color}
                      isActual={isActual}
                      x={props.x}
                      y={props.y}
                      index={props.index}
                      lastIndex={lastPoint}
                    />
                  )}
                />
              </Line>
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function PesLnSliceLabel({
  cx = 0,
  cy = 0,
  midAngle = 0,
  outerRadius = 0,
  percent = 0,
  name = "",
}: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  outerRadius?: number;
  percent?: number;
  name?: string;
}) {
  if (percent < 0.018) return null;
  const RADIAN = Math.PI / 180;
  const inside = percent >= 0.06;
  const radius = inside ? outerRadius * 0.52 : outerRadius + 14;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const pct = formatNum(percent * 100, percent >= 0.1 ? 0 : 1);
  const maxLen = inside ? (percent >= 0.15 ? 16 : 12) : 11;
  const short = name.length > maxLen ? `${name.slice(0, maxLen - 1)}…` : name;
  const fill = inside ? "#fff" : OPSIA_INK.strong;
  const fontSize = inside ? (percent >= 0.2 ? 15 : percent >= 0.12 ? 13 : 11) : 11;

  return (
    <text
      x={x}
      y={y}
      fill={fill}
      textAnchor={inside ? "middle" : x > cx ? "start" : "end"}
      dominantBaseline="central"
      fontSize={fontSize}
      fontWeight={700}
      style={{ pointerEvents: "none" }}
    >
      {inside ? (
        <>
          <tspan x={x} dy="-0.55em">
            {short}
          </tspan>
          <tspan x={x} dy="1.2em" fontSize={fontSize + 1} fontWeight={800}>
            {pct}%
          </tspan>
        </>
      ) : (
        `${short} ${pct}%`
      )}
    </text>
  );
}

function PesLnPieCard({ pesLn }: { pesLn: PesLnComparativa }) {
  const labels = pesLn.perAny.map((p) => p.label);
  const [anySel, setAnySel] = useState(labels[labels.length - 1] ?? "");
  const bloc = pesLn.perAny.find((p) => p.label === anySel) ?? pesLn.perAny.at(-1);
  const segments = [...(bloc?.segments ?? [])]
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = segments.reduce((s, x) => s + x.value, 0);

  if (segments.length === 0 && pesLn.perAny.length === 0) return null;

  return (
    <ChartCard
      title="Pes LN · ingressos"
      dense
      bare
      actions={
        labels.length > 1 ? (
          <select
            className={styles.yearSelect}
            value={anySel}
            onChange={(e) => setAnySel(e.target.value)}
            aria-label="Any del pastís"
          >
            {labels.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        ) : (
          <span className={styles.yearStatic}>{anySel || bloc?.label}</span>
        )
      }
    >
      {segments.length === 0 ? (
        <p className={styles.emptyChart}>Sense ingressos per LN en aquest any.</p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 2, right: 4, bottom: 2, left: 4 }}>
            <Pie
              data={segments}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius="94%"
              paddingAngle={1.25}
              stroke="#fff"
              strokeWidth={2}
              label={PesLnSliceLabel}
              labelLine={false}
            >
              {segments.map((s, i) => (
                <Cell key={s.key} fill={OPSIA_CHART_SERIES[i % OPSIA_CHART_SERIES.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v, _n, item) => {
                const n = Number(v ?? 0);
                const pct = total ? (n / total) * 100 : 0;
                const name = (item as { payload?: { name?: string } })?.payload?.name ?? "";
                return [`${formatNum(n)} € · ${formatNum(pct, 1)}%`, name];
              }}
              contentStyle={tooltipStyle}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function KpisLn({
  vendes,
  pes,
  periodeLabel,
}: {
  vendes: KpiComparatiuItem;
  pes: KpiPesEmpresa | null;
  periodeLabel: string;
}) {
  const varPct =
    vendes.refLabel && vendes.totalitatAnterior !== null
      ? variacioPct(vendes.totalitat, vendes.totalitatAnterior)
      : null;
  const deltaAbs =
    vendes.diferencia ??
    (vendes.totalitatAnterior !== null ? vendes.totalitat - vendes.totalitatAnterior : null);
  const deltaPositiu = varPct === null ? null : varPct >= 0;

  const ppDiff =
    pes != null && pes.pesActual !== null && pes.pesAnterior !== null
      ? pes.pesActual - pes.pesAnterior
      : null;
  const ppPositiu = ppDiff === null ? null : ppDiff >= 0;

  return (
    <OpsiaKpiCardRow size="lg">
      <OpsiaKpiCard
        label="Ingressos LN"
        import_={vendes.totalitat}
        periode={periodeLabel}
        accent="ingressos"
        hint={vendes.actualLabel ?? undefined}
        negImport
        size="lg"
      >
        {varPct !== null && deltaPositiu !== null && vendes.refLabel ? (
          <div
            className={cn(
              reportStyles.kpiExecBanner,
              reportStyles.kpiExecBannerLg,
              deltaPositiu ? reportStyles.kpiExecBannerPos : reportStyles.kpiExecBannerNeg
            )}
          >
            {deltaPositiu ? (
              <TrendingUp size={20} strokeWidth={2.5} />
            ) : (
              <TrendingDown size={20} strokeWidth={2.5} />
            )}
            <span className={reportStyles.kpiExecBannerText}>
              {varPct > 0 ? "+" : ""}
              {formatNum(varPct, 1)}%
              {deltaAbs !== null ? (
                <>
                  {" · "}
                  {deltaAbs > 0 ? "+" : ""}
                  {formatNum(deltaAbs)} €
                </>
              ) : null}
              <span className={reportStyles.kpiExecBannerVs}> vs {vendes.refLabel}</span>
            </span>
          </div>
        ) : null}
        {vendes.totalitatAnterior !== null && vendes.refLabel ? (
          <div className={cn(reportStyles.kpiExecFoot, reportStyles.kpiExecFootLg)}>
            {vendes.refLabel}: <strong>{formatNum(vendes.totalitatAnterior)} €</strong>
          </div>
        ) : null}
      </OpsiaKpiCard>

      <OpsiaKpiCard
        label="Pes s/ empresa"
        value={pes?.pesActual != null ? <>{formatNum(pes.pesActual, 1)} %</> : <>—</>}
        periode={periodeLabel}
        accent="ingressos"
        size="lg"
      >
        {ppDiff !== null && ppPositiu !== null && pes?.refLabel ? (
          <div
            className={cn(
              reportStyles.kpiExecBanner,
              reportStyles.kpiExecBannerLg,
              ppPositiu ? reportStyles.kpiExecBannerPos : reportStyles.kpiExecBannerNeg
            )}
          >
            {ppPositiu ? (
              <TrendingUp size={20} strokeWidth={2.5} />
            ) : (
              <TrendingDown size={20} strokeWidth={2.5} />
            )}
            <span className={reportStyles.kpiExecBannerText}>
              {ppDiff > 0 ? "+" : ""}
              {formatNum(ppDiff, 1)} pp
              <span className={reportStyles.kpiExecBannerVs}> vs {pes.refLabel}</span>
            </span>
          </div>
        ) : null}
        {pes?.pesAnterior != null && pes.refLabel ? (
          <div className={cn(reportStyles.kpiExecFoot, reportStyles.kpiExecFootLg)}>
            {pes.refLabel}: <strong>{formatNum(pes.pesAnterior, 1)} %</strong>
          </div>
        ) : null}
      </OpsiaKpiCard>

      <OpsiaKpiCard
        label="Ingressos empresa"
        import_={pes?.vendesEmpresa ?? 0}
        periode={periodeLabel}
        accent="neutral"
        negImport
        size="lg"
      >
        {pes?.vendesEmpresaAnterior != null && pes.refLabel ? (
          <div className={cn(reportStyles.kpiExecFoot, reportStyles.kpiExecFootLg)}>
            {pes.refLabel}: <strong>{formatNum(pes.vendesEmpresaAnterior)} €</strong>
          </div>
        ) : null}
      </OpsiaKpiCard>
    </OpsiaKpiCardRow>
  );
}

export function PresentacioComparativa({
  titol,
  periode,
  kpis,
  periodeLabelKpi,
  perAny,
  mensual,
  anysMensual,
  ambit = "general",
  pesEmpresa = null,
  pesLn = null,
}: {
  titol: string;
  periode: string;
  kpis: KpiComparatiuItem[];
  periodeLabelKpi: string;
  perAny: SerieComparativaAny[];
  mensual: SerieComparativaMes[] | null;
  anysMensual: number[];
  mode?: "anual" | "mes" | "mensual";
  /** LN: només vendes + pes s/ empresa (Directe). */
  ambit?: "general" | "linia";
  pesEmpresa?: KpiPesEmpresa | null;
  /** Distribució de vendes per LN (només empresa). */
  pesLn?: PesLnComparativa | null;
}) {
  const esLn = ambit === "linia";
  const vendesKpi = kpis.find((k) => k.tipus === "vendes");

  const dataAny = perAny.map((r) => ({
    name: r.label,
    Ingressos: r.vendes,
    "Ingressos empresa": r.vendesEmpresa ?? 0,
    "Pes %": r.pesEmpresa ?? null,
    EBITDA: r.ebitda,
    "Marge EBITDA %": r.vendes !== 0 ? (r.ebitda / r.vendes) * 100 : null,
    Personal: costPos(r.personal),
    Compres: costPos(r.compres),
    Gestió: costPos(r.gestio),
  }));

  /** % s/ vendes: any anterior vs actual (+ delta en pp). Sense Vendes. */
  const refAnyLabel = kpis.find((k) => k.refLabel)?.refLabel ?? "Anterior";
  const actualAnyLabel = kpis.find((k) => k.actualLabel)?.actualLabel ?? "Actual";

  const dataPesComparat = (esLn ? [] : kpis)
    .filter(
      (k) => k.tipus !== "vendes" && k.pctActual !== null && k.pctAnterior !== null && k.refLabel
    )
    .map((k) => {
      const pctAnterior = k.pctAnterior ?? 0;
      const pctActual = k.pctActual ?? 0;
      const anterior = k.tipus === "cost" ? Math.abs(pctAnterior) : pctAnterior;
      const actual = k.tipus === "cost" ? Math.abs(pctActual) : pctActual;
      const pp = actual - anterior;
      const millora = k.tipus === "cost" ? pp <= 0 : pp >= 0;
      return {
        name: k.label,
        Anterior: anterior,
        Actual: actual,
        pp,
        millora,
        etiqueta: `${k.label}  ${pp > 0 ? "+" : ""}${formatNum(pp, 1)} pp`,
      };
    });

  /** Només LN: variació YoY de vendes. */
  const dataVariacioLn = esLn
    ? kpis
        .filter((k) => k.tipus === "vendes" && k.refLabel && k.totalitatAnterior !== null)
        .map((k) => {
          const anterior = k.totalitatAnterior;
          if (anterior === null) return null;
          const pct = variacioPct(k.totalitat, anterior);
          if (pct === null) return null;
          return {
            name: k.label,
            Delta: pct,
            fill: pct >= 0 ? OPSIA_GREEN[500] : OPSIA_YELLOW[600],
          };
        })
        .filter((d): d is NonNullable<typeof d> => d !== null)
    : [];

  return (
    <div className={styles.wrap}>
      <header className={styles.hero}>
        <div className={styles.heroMain}>
          <h2 className={styles.heroTitle}>{titol}</h2>
          <p className={styles.heroPeriode}>{periode}</p>
        </div>
      </header>

      {esLn && vendesKpi ? (
        <KpisLn vendes={vendesKpi} pes={pesEmpresa} periodeLabel={periodeLabelKpi} />
      ) : (
        <KpiComparatiuCards kpis={kpis} periodeLabel={periodeLabelKpi} />
      )}

      {esLn ? (
        <div className={styles.grid2}>
          <ChartCard title="Ingressos LN vs empresa">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dataAny} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                  axisLine={{ stroke: "var(--color-border)" }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatEix}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip formatter={(v) => euroTip(Number(v ?? 0))} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: "0.82rem" }} />
                <Bar
                  dataKey="Ingressos"
                  name="Ingressos LN"
                  fill={OPSIA_CHART.vendes}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
                <Bar
                  dataKey="Ingressos empresa"
                  name="Ingressos empresa"
                  fill={OPSIA_CHART.gestio}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Pes sobre ingressos empresa">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={dataAny} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                  axisLine={{ stroke: "var(--color-border)" }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `${formatNum(Number(v), 0)}%`}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip formatter={(v) => pctTip(Number(v ?? 0))} contentStyle={tooltipStyle} />
                <Bar
                  dataKey="Pes %"
                  fill={OPSIA_CHART.ebitda}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
                <Line
                  type="monotone"
                  dataKey="Pes %"
                  stroke={OPSIA_GREEN[700]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  legendType="none"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      ) : (
        <>
          <div className={styles.grid2}>
            <ChartCard title="Ingressos">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={dataAny} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cmpVendesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={OPSIA_CHART.vendes} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={OPSIA_CHART.vendes} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                    axisLine={{ stroke: "var(--color-border)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={formatEix}
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                  />
                  <Tooltip formatter={(v) => euroTip(Number(v ?? 0))} contentStyle={tooltipStyle} />
                  <Area
                    type="monotone"
                    dataKey="Ingressos"
                    name="Ingressos"
                    stroke={OPSIA_CHART.vendes}
                    strokeWidth={3}
                    fill="url(#cmpVendesFill)"
                    dot={{ r: 4, fill: OPSIA_CHART.vendes }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="EBITDA i marge %">
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={dataAny} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                    axisLine={{ stroke: "var(--color-border)" }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="eur"
                    tickFormatter={formatEix}
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                  />
                  <YAxis
                    yAxisId="pct"
                    orientation="right"
                    tickFormatter={(v) => `${formatNum(Number(v), 0)}%`}
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip
                    formatter={(v, name) => {
                      const n = Number(v ?? 0);
                      if (String(name).includes("%")) return pctTip(n);
                      return euroTip(n);
                    }}
                    contentStyle={tooltipStyle}
                  />
                  <Legend wrapperStyle={{ fontSize: "0.82rem" }} />
                  <Bar
                    yAxisId="eur"
                    dataKey="EBITDA"
                    fill={OPSIA_CHART.ebitda}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                    fillOpacity={0.85}
                  />
                  <Line
                    yAxisId="pct"
                    type="monotone"
                    dataKey="Marge EBITDA %"
                    stroke={OPSIA_GREEN[700]}
                    strokeWidth={3}
                    dot={{ r: 5, fill: OPSIA_GREEN[700] }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className={styles.grid2}>
            {dataPesComparat.length > 0 ? (
              <ChartCard title={`% s/ ingressos · ${refAnyLabel} vs ${actualAnyLabel}`}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={dataPesComparat}
                    layout="vertical"
                    margin={{ top: 4, right: 56, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => `${formatNum(Number(v), 0)}%`}
                      tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={72}
                      tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(v, name) => [pctTip(Number(v ?? 0)), String(name)]}
                      labelFormatter={(label) => {
                        const row = dataPesComparat.find((d) => d.name === label);
                        if (!row) return String(label);
                        return `${label} · diferència ${row.pp > 0 ? "+" : ""}${formatNum(row.pp, 1)} pp`;
                      }}
                      contentStyle={tooltipStyle}
                    />
                    <Legend wrapperStyle={{ fontSize: "0.82rem" }} />
                    <Bar
                      dataKey="Anterior"
                      name={refAnyLabel}
                      fill={OPSIA_CHART.gestio}
                      radius={[0, 3, 3, 0]}
                      maxBarSize={14}
                    >
                      <LabelList
                        dataKey="Anterior"
                        position="right"
                        formatter={(v) => `${formatNum(Number(v), 1)}%`}
                        style={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                      />
                    </Bar>
                    <Bar
                      dataKey="Actual"
                      name={actualAnyLabel}
                      fill={OPSIA_CHART.vendes}
                      radius={[0, 3, 3, 0]}
                      maxBarSize={14}
                    >
                      <LabelList
                        dataKey="Actual"
                        position="right"
                        formatter={(v) => `${formatNum(Number(v), 1)}%`}
                        style={{ fontSize: 11, fontWeight: 700, fill: "var(--color-foreground)" }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <ul className={styles.deltaList}>
                  {dataPesComparat.map((d) => (
                    <li
                      key={d.name}
                      className={cn(
                        styles.deltaItem,
                        d.millora ? styles.deltaPos : styles.deltaNeg
                      )}
                    >
                      <span className={styles.deltaName}>{d.name}</span>
                      <span className={styles.deltaValues}>
                        {formatNum(d.Anterior, 1)}% → {formatNum(d.Actual, 1)}%
                      </span>
                      <span className={styles.deltaPp}>
                        {d.pp > 0 ? "+" : ""}
                        {formatNum(d.pp, 1)} pp
                      </span>
                    </li>
                  ))}
                </ul>
              </ChartCard>
            ) : null}

            {pesLn && pesLn.perAny.length > 0 ? <PesLnPieCard pesLn={pesLn} /> : null}
          </div>
        </>
      )}

      {mensual && mensual.length > 0 && anysMensual.length > 0 ? (
        esLn ? (
          <TendenciaMensualChart
            title="Tendència mes a mes · Ingressos LN"
            data={mensual}
            anys={anysMensual}
            dataKeyPrefix="v_"
          />
        ) : (
          <div className={styles.grid2}>
            <TendenciaMensualChart
              title="Tendència mes a mes · Ingressos"
              data={mensual}
              anys={anysMensual}
              dataKeyPrefix="v_"
            />
            <TendenciaMensualChart
              title="Tendència mes a mes · EBITDA"
              data={mensual}
              anys={anysMensual}
              dataKeyPrefix="e_"
            />
          </div>
        )
      ) : null}

      {esLn && dataVariacioLn.length > 0 ? (
        <ChartCard title="Variació vs període anterior">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              data={dataVariacioLn}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                horizontal={false}
              />
              <XAxis
                type="number"
                tickFormatter={(v) => `${formatNum(Number(v), 1)}%`}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={80}
                tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v) => `${formatNum(Number(v ?? 0), 1)} %`}
                contentStyle={tooltipStyle}
              />
              <Bar dataKey="Delta" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {dataVariacioLn.map((d) => (
                  <Cell key={d.name} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : null}
    </div>
  );
}
