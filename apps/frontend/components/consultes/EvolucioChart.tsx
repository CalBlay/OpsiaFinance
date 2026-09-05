"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ChartSeries {
  name: string;
  type: "bar" | "line";
  color: string;
  data: (number | null)[];
  /** Guions a la línia (p.ex. PE). */
  strokeDasharray?: string;
  /** Cartel·let al darrer punt de la línia. */
  endLabel?: string;
  /** Desplaçament vertical del cartel·let (px). */
  endLabelDy?: number;
}

function formatEix(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(v);
}

/** Cartel·let al final de la sèrie (només al darrer índex amb valor). */
function LineEndBadge({
  label,
  color,
  dy = 0,
  x,
  y,
  index,
  lastIndex,
  value,
}: {
  label: string;
  color: string;
  dy?: number;
  x?: number | string;
  y?: number | string;
  index?: number;
  lastIndex: number;
  value?: number | string | null;
}) {
  if (index !== lastIndex || x == null || y == null || !label) return null;
  if (value == null || value === "") return null;
  const nx = Number(x);
  const ny = Number(y) + dy;
  const padX = 6;
  const padY = 3;
  const fontSize = 11;
  const approxW = label.length * 6.6 + padX * 2;
  const h = fontSize + padY * 2;

  return (
    <g style={{ pointerEvents: "none" }}>
      <rect
        x={nx + 8}
        y={ny - h / 2}
        width={approxW}
        height={h}
        rx={4}
        ry={4}
        fill="var(--color-card)"
        stroke={color}
        strokeWidth={1.5}
      />
      <text
        x={nx + 8 + approxW / 2}
        y={ny}
        fill={color}
        fontSize={fontSize}
        fontWeight={700}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {label}
      </text>
    </g>
  );
}

export function EvolucioChart({
  categories,
  series,
  height = 300,
  tickAngle,
}: {
  categories: string[];
  series: ChartSeries[];
  height?: number;
  /** Inclinar etiquetes de l'eix X (p. ex. noms de centre). */
  tickAngle?: number;
}) {
  const data = categories.map((cat, i) => {
    const row: Record<string, string | number | null> = { name: cat };
    for (const s of series) {
      const v = s.data[i];
      row[s.name] = v === undefined ? null : v;
    }
    return row;
  });

  const bottomMargin = tickAngle ? 56 : 0;
  const hasEndLabels = series.some((s) => s.type === "line" && s.endLabel);
  const rightMargin = hasEndLabels ? 72 : 12;

  /** Preferim l'últim mes amb barra ≠ 0; si no, el darrer valor no nul de cada línia. */
  const lastBarIndex = (() => {
    const bars = series.filter((s) => s.type === "bar");
    for (let i = categories.length - 1; i >= 0; i--) {
      if (bars.some((s) => Math.abs(Number(s.data[i] ?? 0)) > 0)) return i;
    }
    return -1;
  })();

  const lastIndexBySeries = series.map((s) => {
    if (lastBarIndex >= 0) return lastBarIndex;
    for (let i = s.data.length - 1; i >= 0; i--) {
      if (s.data[i] != null && Number.isFinite(s.data[i] as number)) return i;
    }
    return -1;
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart
        data={data}
        margin={{ top: 10, right: rightMargin, left: 4, bottom: bottomMargin }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: tickAngle ? 10 : 12, fill: "var(--color-muted-foreground)" }}
          angle={tickAngle}
          textAnchor={tickAngle ? "end" : "middle"}
          height={tickAngle ? 72 : undefined}
          interval={0}
          axisLine={{ stroke: "var(--color-border)" }}
          tickLine={false}
        />
        <YAxis
          domain={["auto", "auto"]}
          tickFormatter={formatEix}
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          formatter={(value) =>
            value == null
              ? "—"
              : `${new Intl.NumberFormat("ca-ES", { maximumFractionDigits: 0 }).format(
                  Number(value)
                )} €`
          }
          contentStyle={{
            background: "var(--color-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "0.5rem",
            fontSize: "0.8rem",
          }}
        />
        <Legend wrapperStyle={{ fontSize: "0.8rem" }} />
        {series.map((s, seriesIdx) =>
          s.type === "bar" ? (
            <Bar
              key={s.name}
              dataKey={s.name}
              fill={s.color}
              radius={[3, 3, 0, 0]}
              maxBarSize={40}
            />
          ) : (
            <Line
              key={s.name}
              type="monotone"
              dataKey={s.name}
              stroke={s.color}
              strokeWidth={2.5}
              strokeDasharray={s.strokeDasharray}
              dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
              connectNulls
            >
              {s.endLabel ? (
                <LabelList
                  dataKey={s.name}
                  content={(props) => (
                    <LineEndBadge
                      label={s.endLabel!}
                      color={s.color}
                      dy={s.endLabelDy ?? 0}
                      x={props.x}
                      y={props.y}
                      index={props.index}
                      lastIndex={lastIndexBySeries[seriesIdx] ?? -1}
                      value={props.value as number | string | null | undefined}
                    />
                  )}
                />
              ) : null}
            </Line>
          )
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
