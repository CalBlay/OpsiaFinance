"use client";

import type { VendesSegment } from "@/lib/consultes-grafics";
import { formatNum } from "@/lib/utils";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = [
  "#0ea5e9",
  "#6366f1",
  "#16a34a",
  "#f59e0b",
  "#ec4899",
  "#14b8a6",
  "#8b5cf6",
  "#f97316",
  "#06b6d4",
  "#84cc16",
];

type SliceLabelProps = {
  cx?: number;
  cy?: number;
  midAngle?: number;
  outerRadius?: number;
  name?: string;
  percent?: number;
};

function SliceLabels({
  cx = 0,
  cy = 0,
  midAngle = 0,
  outerRadius = 0,
  name = "",
  percent = 0,
}: SliceLabelProps) {
  if (percent < 0.02) return null;

  const RADIAN = Math.PI / 180;
  const cos = Math.cos(-midAngle * RADIAN);
  const sin = Math.sin(-midAngle * RADIAN);

  const innerX = cx + outerRadius * 0.62 * cos;
  const innerY = cy + outerRadius * 0.62 * sin;

  const sx = cx + outerRadius * cos;
  const sy = cy + outerRadius * sin;
  const mx = cx + (outerRadius + 12) * cos;
  const my = cy + (outerRadius + 12) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 6;
  const ey = my;
  const textAnchor = cos >= 0 ? "start" : "end";

  return (
    <g>
      {percent >= 0.04 && (
        <text
          x={innerX}
          y={innerY}
          fill="#fff"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={percent >= 0.08 ? 12 : 10}
          fontWeight={600}
        >
          {formatNum(percent * 100, 0)}%
        </text>
      )}
      {percent >= 0.03 && (
        <>
          <polyline
            points={`${sx},${sy} ${mx},${my} ${ex},${ey}`}
            stroke="var(--color-muted-foreground)"
            strokeWidth={1}
            fill="none"
          />
          <text
            x={ex + (cos >= 0 ? 3 : -3)}
            y={ey}
            textAnchor={textAnchor}
            dominantBaseline="central"
            fill="var(--color-foreground)"
            fontSize={10}
          >
            {name}
          </text>
        </>
      )}
    </g>
  );
}

export function VendesPieChart({
  segments,
  height = 320,
}: {
  segments: VendesSegment[];
  height?: number;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (total === 0) {
    return (
      <p
        style={{
          fontSize: "0.85rem",
          color: "var(--color-muted-foreground)",
          padding: "2rem 0",
          textAlign: "center",
        }}
      >
        Sense dades de vendes operatives per al període seleccionat.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart margin={{ top: 8, right: 52, bottom: 8, left: 52 }}>
        <Pie
          data={segments}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius="72%"
          paddingAngle={1}
          label={SliceLabels}
          labelLine={false}
        >
          {segments.map((segment, i) => (
            <Cell key={segment.name} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, _name, item) => {
            const n = Number(value ?? 0);
            const pct = total !== 0 ? (n / total) * 100 : 0;
            const payloadName =
              item && typeof item === "object" && "payload" in item
                ? (item.payload as { name?: string } | null)?.name
                : undefined;
            return [`${formatNum(n)} € (${formatNum(pct, 1)}%)`, payloadName];
          }}
          contentStyle={{
            background: "var(--color-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "0.5rem",
            fontSize: "0.8rem",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
