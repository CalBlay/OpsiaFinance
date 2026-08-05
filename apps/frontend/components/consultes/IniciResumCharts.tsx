"use client";

import type { VendesSegment } from "@/lib/consultes-grafics";
import { formatNum } from "@/lib/utils";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import styles from "./IniciResumCharts.module.css";

const PIE_COLORS = [
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

const COST_COLORS = ["#6366f1", "#f59e0b", "#14b8a6"];

type SliceLabelProps = {
  cx?: number;
  cy?: number;
  midAngle?: number;
  outerRadius?: number;
  percent?: number;
};

function SlicePct({ cx = 0, cy = 0, midAngle = 0, outerRadius = 0, percent = 0 }: SliceLabelProps) {
  if (percent < 0.04) return null;
  const RADIAN = Math.PI / 180;
  const x = cx + outerRadius * 0.55 * Math.cos(-midAngle * RADIAN);
  const y = cy + outerRadius * 0.55 * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={percent >= 0.12 ? 15 : percent >= 0.07 ? 13 : 11}
      fontWeight={800}
    >
      {formatNum(percent * 100, 0)}%
    </text>
  );
}

function QuesitoCard({
  title,
  lead,
  segments,
  colors,
}: {
  title: string;
  lead: string;
  segments: VendesSegment[];
  colors: string[];
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total <= 0) {
    return (
      <article className={styles.card}>
        <header className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>{title}</h2>
          <p className={styles.cardLead}>{lead}</p>
        </header>
        <p className={styles.empty}>Sense dades per a aquest període.</p>
      </article>
    );
  }

  return (
    <article className={styles.card}>
      <header className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>{title}</h2>
        <p className={styles.cardLead}>
          {lead} · <strong>{formatNum(total)} €</strong>
        </p>
      </header>
      <div className={styles.pieWrap}>
        <div className={styles.chart}>
          <ResponsiveContainer width="100%" height={340}>
            <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Pie
                data={segments}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius="88%"
                paddingAngle={1}
                stroke="var(--opsia-bg-card, #fff)"
                strokeWidth={2}
                label={SlicePct}
                labelLine={false}
              >
                {segments.map((segment, i) => (
                  <Cell key={segment.name} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, _name, item) => {
                  const n = Number(value ?? 0);
                  const pct = total ? (n / total) * 100 : 0;
                  const payloadName =
                    item && typeof item === "object" && "payload" in item
                      ? (item.payload as { name?: string } | null)?.name
                      : undefined;
                  return [`${formatNum(n)} € · ${formatNum(pct, 1)}%`, payloadName];
                }}
                contentStyle={{
                  background: "var(--opsia-bg-card, #fff)",
                  border: "1px solid var(--opsia-line-soft)",
                  borderRadius: "0.5rem",
                  fontSize: "0.85rem",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className={styles.legend}>
          {segments.map((s, i) => {
            const pct = (s.value / total) * 100;
            return (
              <li key={s.name} className={styles.legendItem}>
                <span className={styles.swatch} style={{ background: colors[i % colors.length] }} />
                <div className={styles.legendText}>
                  <span className={styles.legendName}>{s.name}</span>
                  <span className={styles.legendEuro}>{formatNum(s.value)} €</span>
                </div>
                <span className={styles.legendPct}>{formatNum(pct, 1)}%</span>
              </li>
            );
          })}
        </ul>
      </div>
    </article>
  );
}

export function IniciResumCharts({
  periodeLabel,
  pesIngressos,
  titolIngressos,
  costos,
}: {
  periodeLabel: string;
  pesIngressos: VendesSegment[];
  /** Títol del primer quesito (per LN o per tipus d'ingrés FDLC). */
  titolIngressos: string;
  costos: VendesSegment[];
}) {
  const teIngressos = pesIngressos.some((x) => x.value > 0);
  const teCostos = costos.some((x) => x.value > 0);
  if (!teIngressos && !teCostos) return null;

  return (
    <section className={styles.section} aria-label={`Resum gràfic · ${periodeLabel}`}>
      <div className={styles.grid}>
        <QuesitoCard
          title={titolIngressos}
          lead={`% sobre el total · ${periodeLabel}`}
          segments={pesIngressos}
          colors={PIE_COLORS}
        />
        <QuesitoCard
          title="Estructura de costos"
          lead={`Personal · Compres · Gestió · ${periodeLabel}`}
          segments={costos}
          colors={COST_COLORS}
        />
      </div>
    </section>
  );
}
