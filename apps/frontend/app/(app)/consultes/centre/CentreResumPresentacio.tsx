"use client";

import { OpsiaKpiCard, OpsiaKpiCardRow } from "@/components/consultes/OpsiaKpiCard";
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
import styles from "../cost-personal/CostPersonalPresentacio.module.css";

export type FilaResumCentre = {
  id: string;
  name: string;
  costPersonal: number;
  pctSobreTotal: number | null;
  /** Intensitat: cost personal ÷ vendes */
  personalPctVendes: number | null;
  /** Food cost: |compres| ÷ vendes */
  foodPctVendes: number | null;
  ebitdaPct: number | null;
  href: string;
};

export type MesCostCentre = {
  label: string;
  cost: number;
  pctSobreEmpresa: number | null;
};

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

export function CentreResumPresentacio({
  periode,
  lnNom,
  vistaLabel,
  totals,
  cobertura,
  files,
  evolucioMensual,
}: {
  periode: string;
  lnNom: string;
  vistaLabel: string;
  totals: {
    costPersonal: number;
    vendes: number;
    personalPctVendes: number | null;
    foodPctVendes: number | null;
    ebitdaPct: number | null;
  };
  cobertura: { ambDades: number; total: number };
  files: FilaResumCentre[];
  evolucioMensual: MesCostCentre[];
}) {
  const ranked = [...files]
    .filter((f) => f.costPersonal > 0 || f.personalPctVendes != null)
    .sort((a, b) => (b.personalPctVendes ?? -1) - (a.personalPctVendes ?? -1));
  const maxIntensity = Math.max(...ranked.map((r) => r.personalPctVendes ?? 0), 1);

  const mesData = evolucioMensual.map((m) => ({
    name: m.label,
    cost: m.cost,
    pct: m.pctSobreEmpresa,
    pctLabel: m.pctSobreEmpresa != null ? pctTxt(m.pctSobreEmpresa) : "",
  }));

  return (
    <div className={styles.wrap}>
      <section className={styles.hero}>
        <div className={styles.heroTop}>
          <div>
            <div className={styles.heroTitleRow}>
              <h2 className={styles.heroTitle}>Costos per centre · {lnNom}</h2>
              <p className={styles.heroPeriode}>{periode}</p>
            </div>
            <p className={styles.heroMeta}>
              <span className={styles.badge}>{vistaLabel}</span>
              <span className={styles.metaSep}>·</span>
              <span>
                {cobertura.ambDades} de {cobertura.total} centres amb cost
              </span>
            </p>
          </div>
          <div className={styles.heroMetric}>
            <span className={styles.heroMetricLabel}>Cost de personal</span>
            <span className={styles.heroMetricValue}>{formatEuro(totals.costPersonal)}</span>
            {totals.personalPctVendes != null && (
              <span className={styles.heroMetricHint}>
                {pctTxt(totals.personalPctVendes)} de les vendes de la línia
              </span>
            )}
          </div>
        </div>

        <OpsiaKpiCardRow>
          <OpsiaKpiCard
            label="Personal % s/ vendes"
            value={pctTxt(totals.personalPctVendes)}
            hint="Intensitat laboral de la línia"
            accent="cost"
            size="lg"
          />
          <OpsiaKpiCard
            label="Food cost % s/ vendes"
            value={pctTxt(totals.foodPctVendes)}
            hint="|Compres| ÷ vendes"
            accent="cost"
            size="lg"
          />
          <OpsiaKpiCard
            label="EBITDA % s/ vendes"
            value={pctTxt(totals.ebitdaPct)}
            hint="Marge agregat de la línia"
            accent={
              totals.ebitdaPct == null
                ? "neutral"
                : totals.ebitdaPct >= 0
                  ? "ebitda-pos"
                  : "ebitda-neg"
            }
            size="lg"
          />
          <OpsiaKpiCard
            label="Cobertura"
            value={`${cobertura.ambDades}/${cobertura.total}`}
            hint="Centres amb cost personal"
            accent="neutral"
            size="lg"
          />
        </OpsiaKpiCardRow>

        {mesData.length > 0 && (
          <div className={styles.monthBlock}>
            <div className={styles.monthHead}>
              <span className={styles.monthTitle}>Cost personal per mes</span>
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
                      "Cost personal",
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
          <h3 className={styles.rankTitle}>Intensitat de personal per centre</h3>
          <p className={styles.rankLead}>
            Ordenat per cost personal % s/ vendes (més intensiu primer). Clic per obrir el compte.
          </p>
        </div>

        {ranked.length === 0 ? (
          <p className={styles.empty}>Sense dades de cost per aquest any.</p>
        ) : (
          <ul className={styles.rankList}>
            {ranked.map((row, i) => {
              const widthPct = ((row.personalPctVendes ?? 0) / maxIntensity) * 100;
              return (
                <li key={row.id}>
                  <Link href={row.href} className={cn(styles.rankRow, styles.rankRowLink)}>
                    <span className={styles.rankIndex}>{i + 1}</span>
                    <span className={styles.rankName}>{row.name}</span>
                    <span className={styles.rankTrack}>
                      <span className={styles.rankFill} style={{ width: `${widthPct}%` }} />
                    </span>
                    <span className={styles.rankPct}>{pctTxt(row.personalPctVendes)}</span>
                    <span className={styles.rankEuro}>
                      {formatEuro(row.costPersonal)}
                      <span
                        style={{
                          display: "block",
                          fontSize: "0.72rem",
                          fontWeight: 500,
                          color: "var(--color-muted-foreground)",
                        }}
                      >
                        Food {pctTxt(row.foodPctVendes)}
                        {row.ebitdaPct != null ? ` · EBITDA ${pctTxt(row.ebitdaPct)}` : ""}
                      </span>
                    </span>
                    <ChevronRight size={16} className={styles.rankChevron} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Selector lleuger de LN quan encara no n'hi ha cap (no és un resum d'empresa). */
export function CentreLnChooser({
  linies,
  anyActual,
  vista,
}: {
  linies: { id: string; name: string; nCentres: number; href: string }[];
  anyActual: number;
  vista: string;
}) {
  return (
    <div className={styles.wrap}>
      <section className={styles.rankCard}>
        <div className={styles.rankHead}>
          <h3 className={styles.rankTitle}>Tria una línia per veure els centres</h3>
          <p className={styles.rankLead}>
            El resum de costos (personal % s/ vendes, food cost, intensitat) es calcula per línia ·{" "}
            {anyActual} · {vista}.
          </p>
        </div>
        {linies.length === 0 ? (
          <p className={styles.empty}>No hi ha línies disponibles.</p>
        ) : (
          <ul className={styles.rankList}>
            {linies.map((ln, i) => (
              <li key={ln.id}>
                <Link href={ln.href} className={cn(styles.rankRow, styles.rankRowLink)}>
                  <span className={styles.rankIndex}>{i + 1}</span>
                  <span className={styles.rankName}>{ln.name}</span>
                  <span className={styles.rankTrack}>
                    <span
                      className={styles.rankFill}
                      style={{
                        width: `${Math.min(100, (ln.nCentres / Math.max(...linies.map((l) => l.nCentres), 1)) * 100)}%`,
                      }}
                    />
                  </span>
                  <span className={styles.rankPct}>{ln.nCentres}</span>
                  <span className={styles.rankEuro}>centres</span>
                  <ChevronRight size={16} className={styles.rankChevron} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
