"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
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
  data: number[];
}

function formatEix(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(v);
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
    const row: Record<string, string | number> = { name: cat };
    for (const s of series) row[s.name] = s.data[i] ?? 0;
    return row;
  });

  const bottomMargin = tickAngle ? 56 : 0;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: bottomMargin }}>
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
          tickFormatter={formatEix}
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          formatter={(value: number) =>
            new Intl.NumberFormat("ca-ES", { maximumFractionDigits: 0 }).format(value) + " €"
          }
          contentStyle={{
            background: "var(--color-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "0.5rem",
            fontSize: "0.8rem",
          }}
        />
        <Legend wrapperStyle={{ fontSize: "0.8rem" }} />
        {series.map((s) =>
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
              dot={{ r: 3 }}
            />
          )
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
