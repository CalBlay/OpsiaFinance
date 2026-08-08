"use client";

import type { BarraCostPersonal, MesCostPersonal } from "@/lib/cost-personal-centre/consultes";
import { OPSIA_CHART } from "@/lib/opsia-colors";
import { cn, formatNum } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "./CostPersonalPresentacio.module.css";

function formatEuro(v: number): string {
  return `${formatNum(v)} €`;
}

function formatEix(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(Math.round(v));
}

function pctTxt(pct: number | null): string {
  if (pct == null) return "–";
  return `${formatNum(pct, 1)}%`;
}

const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "0.65rem",
  fontSize: "0.85rem",
};

export function CostPersonalPresentacio({
  periode,
  titol,
  nivellLabel,
  vistaLabel,
  totals,
  barres,
  evolucioMensual,
  chartTitle,
}: {
  periode: string;
  titol: string;
  nivellLabel: string;
  vistaLabel: string;
  totals: {
    costPersonal: number;
    importBrut: number;
    totalSegSocial: number;
    pctSobreVendes: number | null;
  };
  barres: BarraCostPersonal[];
  evolucioMensual: MesCostPersonal[];
  chartTitle: string;
}) {
  const ranked = [...barres]
    .filter((b) => b.costPersonal > 0)
    .sort((a, b) => b.costPersonal - a.costPersonal);
  const maxCost = ranked[0]?.costPersonal || 1;

  const mesData = evolucioMensual.map((m) => ({
    name: m.label,
    cost: m.costPersonal,
    pct: m.pctSobreEmpresa,
    pctLabel: m.pctSobreEmpresa != null ? pctTxt(m.pctSobreEmpresa) : "",
  }));

  return (
    <div className={styles.wrap}>
      <section className={styles.hero}>
        <div className={styles.heroTop}>
          <div>
            <div className={styles.heroTitleRow}>
              <h2 className={styles.heroTitle}>{titol}</h2>
              <p className={styles.heroPeriode}>{periode}</p>
            </div>
            <p className={styles.heroMeta}>
              <span className={styles.badge}>{vistaLabel}</span>
              <span className={styles.metaSep}>·</span>
              <span>{nivellLabel}</span>
            </p>
          </div>
          <div className={styles.heroMetric}>
            <span className={styles.heroMetricLabel}>Cost de personal</span>
            <span className={styles.heroMetricValue}>{formatEuro(totals.costPersonal)}</span>
            {totals.pctSobreVendes != null && (
              <span className={styles.heroMetricHint}>
                {pctTxt(totals.pctSobreVendes)} de les vendes del període
              </span>
            )}
          </div>
        </div>

        {mesData.length > 0 && (
          <div className={styles.monthBlock}>
            <div className={styles.monthHead}>
              <span className={styles.monthTitle}>Cost per mes</span>
              <span className={styles.monthHint}>
                % sobre el cost personal total de l&apos;empresa
              </span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={mesData} margin={{ top: 22, right: 8, left: 0, bottom: 0 }}>
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
                <Tooltip
                  formatter={(value, _n, item) => {
                    const cost = Number(value ?? 0);
                    const pct =
                      item && typeof item === "object" && "payload" in item
                        ? (item.payload as { pct?: number | null })?.pct
                        : null;
                    return [
                      pct != null
                        ? `${formatEuro(cost)} · ${pctTxt(pct)} s/ empresa`
                        : formatEuro(cost),
                      "Cost",
                    ];
                  }}
                  contentStyle={tooltipStyle}
                />
                <Bar
                  dataKey="cost"
                  fill={OPSIA_CHART.personal}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                >
                  <LabelList
                    dataKey="pctLabel"
                    position="top"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      fill: "var(--color-muted-foreground)",
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className={styles.rankCard}>
        <div className={styles.rankHead}>
          <h3 className={styles.rankTitle}>{chartTitle}</h3>
          <p className={styles.rankLead}>Ordenat de més a menys cost.</p>
        </div>

        {ranked.length === 0 ? (
          <p className={styles.empty}>Sense dades per aquest període.</p>
        ) : (
          <ul className={styles.rankList}>
            {ranked.map((row, i) => {
              const widthPct = (row.costPersonal / maxCost) * 100;
              const content = (
                <>
                  <span className={styles.rankIndex}>{i + 1}</span>
                  <span className={styles.rankName}>{row.name}</span>
                  <span className={styles.rankTrack}>
                    <span className={styles.rankFill} style={{ width: `${widthPct}%` }} />
                  </span>
                  <span className={styles.rankPct}>{pctTxt(row.pctSobreTotal)}</span>
                  <span className={styles.rankEuro}>{formatEuro(row.costPersonal)}</span>
                  {row.href ? <ChevronRight size={16} className={styles.rankChevron} /> : <span />}
                </>
              );

              return (
                <li key={row.id}>
                  {row.href ? (
                    <Link href={row.href} className={cn(styles.rankRow, styles.rankRowLink)}>
                      {content}
                    </Link>
                  ) : (
                    <div className={styles.rankRow}>{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
