"use client";

import { OPSIA_CHART, OPSIA_CHART_SERIES, OPSIA_NUM } from "@/lib/opsia-colors";
import type {
  RrhhComparativa,
  RrhhDistribucioHores,
  RrhhInforme,
  RrhhMes,
} from "@/lib/rrhh/format";
import { formatDistribucioJornada } from "@/lib/rrhh/format";
import { cn, formatNum } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "./RrhhPresentacio.module.css";

type Metrica = "persones" | "hores";

const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "0.65rem",
  fontSize: "0.85rem",
};

function pctTxt(pct: number | null): string {
  if (pct == null) return "–";
  return `${formatNum(pct, 1)}%`;
}

function valorFila(f: { nombrePersones: number; horesSetmanals: number }, m: Metrica): number {
  return m === "persones" ? f.nombrePersones : f.horesSetmanals;
}

function DistChips({
  dist,
  decimalsPersones = 0,
  compact = false,
}: {
  dist: RrhhDistribucioHores[];
  decimalsPersones?: number;
  compact?: boolean;
}) {
  if (!dist.length) return null;
  const shown = dist.slice(0, compact ? 4 : 10);
  return (
    <div
      className={cn(styles.distChips, compact && styles.distChipsCompact)}
      title={formatDistribucioJornada(dist, { decimalsPersones })}
    >
      {shown.map((d) => {
        const h = Number.isInteger(d.hores) ? String(d.hores) : formatNum(d.hores, 1);
        return (
          <span key={d.hores} className={styles.distChip}>
            <strong>{formatNum(d.persones, decimalsPersones)}</strong>
            <span className={styles.distChipSep}>a</span>
            <span>{h} h</span>
          </span>
        );
      })}
      {dist.length > shown.length ? (
        <span className={styles.distChipMore}>+{dist.length - shown.length}</span>
      ) : null}
    </div>
  );
}

export function RrhhBoard({
  titol,
  periodeLabel,
  nivellLabel,
  informe,
  evolucio,
  esMitjana,
  metricDefault = "persones",
  hrefByKey,
  detallHref,
}: {
  titol: string;
  periodeLabel: string;
  nivellLabel: string;
  informe: RrhhInforme;
  evolucio?: RrhhMes[];
  esMitjana: boolean;
  metricDefault?: Metrica;
  /** Enllaços de drill-down per clau de fila (serialitzable). */
  hrefByKey?: Record<string, string>;
  /** Enllaç a taula detallada (opcional). */
  detallHref?: string;
}) {
  const [metrica, setMetrica] = useState<Metrica>(metricDefault);

  const total =
    metrica === "persones" ? informe.totals.nombrePersones : informe.totals.horesSetmanals;
  const ranked = useMemo(() => {
    return [...informe.files]
      .map((f) => {
        const v = valorFila(f, metrica);
        return {
          ...f,
          valor: v,
          pct: total > 0 ? (v / total) * 100 : null,
        };
      })
      .filter((f) => f.valor > 0)
      .sort((a, b) => b.valor - a.valor);
  }, [informe.files, metrica, total]);

  const maxVal = ranked[0]?.valor || 1;

  const pieData = useMemo(() => {
    const top = ranked.slice(0, 8);
    const shortCount = new Map<string, number>();
    for (const f of top) {
      const short = f.label.split(" · ")[0] ?? f.label;
      shortCount.set(short, (shortCount.get(short) ?? 0) + 1);
    }
    return top.map((f, i) => {
      const short = f.label.split(" · ")[0] ?? f.label;
      const name =
        (shortCount.get(short) ?? 0) > 1 && f.sublabel
          ? `${short} (${f.sublabel.split(" · ")[0] ?? f.sublabel})`
          : short;
      return {
        key: f.key,
        name,
        value: f.valor,
        fill: OPSIA_CHART_SERIES[i % OPSIA_CHART_SERIES.length],
      };
    });
  }, [ranked]);

  const mesData = (evolucio ?? []).map((m) => ({
    name: m.label,
    persones: m.nombrePersones,
    hores: Math.round(m.horesSetmanals * 10) / 10,
  }));

  const horesPerPers =
    informe.totals.nombrePersones > 0
      ? informe.totals.horesSetmanals / informe.totals.nombrePersones
      : null;

  if (informe.buit) {
    return (
      <p className={styles.empty}>
        Sense dades de jornada per aquest període. Importa l&apos;Excel a{" "}
        <strong>Dades → Jornada</strong>.
      </p>
    );
  }

  return (
    <div className={styles.wrap}>
      <section className={styles.hero}>
        <div className={styles.heroTop}>
          <div>
            <div className={styles.heroTitleRow}>
              <h2 className={styles.heroTitle}>{titol}</h2>
              <p className={styles.heroPeriode}>{periodeLabel}</p>
            </div>
            <p className={styles.heroMeta}>
              <span className={styles.badge}>{nivellLabel}</span>
              <span className={styles.metaSep}>·</span>
              <span>{esMitjana ? "Mitjana dels mesos amb dades" : "Snapshot del mes"}</span>
              <span className={styles.metaSep}>·</span>
              <span>Font: jornada contractada</span>
            </p>
          </div>
          <div className={styles.heroMetrics}>
            <div className={styles.heroMetric}>
              <span className={styles.heroMetricLabel}>
                {esMitjana ? "Mitjana persones" : "Treballadors"}
              </span>
              <span className={styles.heroMetricValuePeople}>
                {formatNum(informe.totals.nombrePersones, esMitjana ? 1 : 0)}
              </span>
              <span className={styles.heroMetricHint}>Caps contractats</span>
            </div>
            <div className={styles.heroMetric}>
              <span className={styles.heroMetricLabel}>
                {esMitjana ? "Mitjana h/setmana" : "Hores / setmana"}
              </span>
              <span className={styles.heroMetricValuePeople}>
                {formatNum(informe.totals.horesSetmanals, 1)}
              </span>
              <span className={styles.heroMetricHint}>
                {horesPerPers != null
                  ? `${formatNum(horesPerPers, 1)} h / persona`
                  : "Contractades"}
              </span>
            </div>
          </div>
        </div>

        {informe.totals.distribucio.length > 0 ? (
          <div className={styles.distBlock}>
            <div className={styles.distBlockHead}>
              <span className={styles.monthTitle}>Composició de jornades</span>
              <span className={styles.monthHint}>
                Persones per hores contractades / setmana
                {esMitjana ? " (mitjana mensual)" : ""}
              </span>
            </div>
            <DistChips dist={informe.totals.distribucio} decimalsPersones={esMitjana ? 1 : 0} />
            <p className={styles.distText}>
              {formatDistribucioJornada(informe.totals.distribucio, {
                decimalsPersones: esMitjana ? 1 : 0,
              })}
            </p>
          </div>
        ) : null}

        {mesData.length > 1 && (
          <div className={styles.monthBlock}>
            <div className={styles.monthHead}>
              <span className={styles.monthTitle}>Evolució mensual</span>
              <span className={styles.monthHint}>Persones (barres) · hores/setmana (etiqueta)</span>
            </div>
            <ResponsiveContainer width="100%" height={210}>
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
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name) => {
                    const n = Number(value ?? 0);
                    if (name === "persones") return [formatNum(n, 0), "Persones"];
                    return [formatNum(n, 1), "Hores/setmana"];
                  }}
                />
                <Bar
                  dataKey="persones"
                  fill={OPSIA_CHART.personal}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={42}
                >
                  <LabelList
                    dataKey="hores"
                    position="top"
                    formatter={(v) => (Number(v) > 0 ? formatNum(Number(v), 0) : "")}
                    style={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <fieldset className={styles.metricToggle} aria-label="Mètrica del rànquing">
        <button
          type="button"
          className={cn(styles.metricBtn, metrica === "persones" && styles.metricBtnActive)}
          onClick={() => setMetrica("persones")}
        >
          Persones
        </button>
        <button
          type="button"
          className={cn(styles.metricBtn, metrica === "hores" && styles.metricBtnActive)}
          onClick={() => setMetrica("hores")}
        >
          Hores / setmana
        </button>
      </fieldset>

      <div className={styles.grid2}>
        <section className={styles.rankCard}>
          <div className={styles.rankHead}>
            <h3 className={styles.rankTitle}>
              {metrica === "persones"
                ? "On es concentra la plantilla"
                : "On es concentren les hores"}
            </h3>
            <p className={styles.rankLead}>
              Ordenat de més a menys · % sobre el total del període
              {detallHref ? (
                <>
                  {" "}
                  ·{" "}
                  <Link href={detallHref} className={styles.inlineLink}>
                    veure detall
                  </Link>
                </>
              ) : null}
            </p>
          </div>
          <ul className={styles.rankList}>
            {ranked.map((row, i) => {
              const widthPct = (row.valor / maxVal) * 100;
              const href = hrefByKey?.[row.key];
              const content = (
                <>
                  <span className={styles.rankIndex}>{i + 1}</span>
                  <span className={styles.rankName}>
                    {row.label}
                    {row.sublabel ? <span className={styles.rankSub}>{row.sublabel}</span> : null}
                    {row.distribucio?.length ? (
                      <span className={styles.rankDist}>
                        {formatDistribucioJornada(row.distribucio, {
                          decimalsPersones: esMitjana ? 1 : 0,
                          max: 4,
                        })}
                      </span>
                    ) : null}
                  </span>
                  <span className={styles.rankTrack}>
                    <span className={styles.rankFill} style={{ width: `${widthPct}%` }} />
                  </span>
                  <span className={styles.rankPct}>{pctTxt(row.pct)}</span>
                  <span className={styles.rankVals}>
                    {metrica === "persones"
                      ? `${formatNum(row.nombrePersones, esMitjana ? 1 : 0)} pers.`
                      : `${formatNum(row.horesSetmanals, 1)} h`}
                    <span className={styles.rankValsAlt}>
                      {metrica === "persones"
                        ? ` · ${formatNum(row.horesSetmanals, 1)} h`
                        : ` · ${formatNum(row.nombrePersones, esMitjana ? 1 : 0)} pers.`}
                    </span>
                  </span>
                  {href ? <ChevronRight size={16} className={styles.rankChevron} /> : <span />}
                </>
              );
              return (
                <li key={row.key}>
                  {href ? (
                    <Link href={href} className={cn(styles.rankRow, styles.rankRowLink)}>
                      {content}
                    </Link>
                  ) : (
                    <div className={styles.rankRow}>{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className={styles.chartCard}>
          <div className={styles.rankHead}>
            <h3 className={styles.rankTitle}>Distribució</h3>
            <p className={styles.rankLead}>
              Top {Math.min(8, pieData.length)} · {metrica === "persones" ? "persones" : "hores"}
            </p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={92}
                paddingAngle={2}
              >
                {pieData.map((d) => (
                  <Cell key={d.key} fill={d.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value) => [
                  metrica === "persones"
                    ? formatNum(Number(value ?? 0), esMitjana ? 1 : 0)
                    : formatNum(Number(value ?? 0), 1),
                  metrica === "persones" ? "Persones" : "Hores",
                ]}
              />
              <Legend verticalAlign="bottom" height={48} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </section>
      </div>

      <section className={styles.detailCard}>
        <div className={styles.rankHead}>
          <h3 className={styles.rankTitle}>Detall tabular</h3>
          <p className={styles.rankLead}>Per a exportació i revisió del comitè</p>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Àmbit</th>
                <th className={styles.num}>{esMitjana ? "Pers./mes" : "Persones"}</th>
                <th className={styles.num}>Hores / setmana</th>
                <th className={styles.num}>h / persona</th>
                <th>Jornades</th>
                <th className={styles.num}>% persones</th>
                <th className={styles.num}>% hores</th>
              </tr>
            </thead>
            <tbody>
              {informe.files.map((f) => {
                const pctP =
                  informe.totals.nombrePersones > 0
                    ? (f.nombrePersones / informe.totals.nombrePersones) * 100
                    : null;
                const pctH =
                  informe.totals.horesSetmanals > 0
                    ? (f.horesSetmanals / informe.totals.horesSetmanals) * 100
                    : null;
                return (
                  <tr key={f.key}>
                    <td>
                      <div className={styles.cellMain}>{f.label}</div>
                      {f.sublabel ? <div className={styles.cellSub}>{f.sublabel}</div> : null}
                    </td>
                    <td className={styles.num}>{formatNum(f.nombrePersones, esMitjana ? 1 : 0)}</td>
                    <td className={styles.num}>{formatNum(f.horesSetmanals, 1)}</td>
                    <td className={styles.num}>
                      {f.horesPerPersona != null ? formatNum(f.horesPerPersona, 1) : "—"}
                    </td>
                    <td>
                      <DistChips
                        dist={f.distribucio}
                        decimalsPersones={esMitjana ? 1 : 0}
                        compact
                      />
                      {!f.distribucio.length ? <span className={styles.cellSub}>—</span> : null}
                    </td>
                    <td className={styles.num}>{pctTxt(pctP)}</td>
                    <td className={styles.num}>{pctTxt(pctH)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className={styles.num}>
                  {formatNum(informe.totals.nombrePersones, esMitjana ? 1 : 0)}
                </td>
                <td className={styles.num}>{formatNum(informe.totals.horesSetmanals, 1)}</td>
                <td className={styles.num}>
                  {horesPerPers != null ? formatNum(horesPerPers, 1) : "—"}
                </td>
                <td>
                  <DistChips
                    dist={informe.totals.distribucio}
                    decimalsPersones={esMitjana ? 1 : 0}
                    compact
                  />
                </td>
                <td className={styles.num}>100%</td>
                <td className={styles.num}>100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}

export function RrhhComparativaBoard({ data }: { data: RrhhComparativa }) {
  const deltaPers = data.totalsB.nombrePersones - data.totalsA.nombrePersones;
  const deltaHores = data.totalsB.horesSetmanals - data.totalsA.horesSetmanals;
  const pctPers =
    data.totalsA.nombrePersones > 0 ? (deltaPers / data.totalsA.nombrePersones) * 100 : null;
  const pctHores =
    data.totalsA.horesSetmanals > 0 ? (deltaHores / data.totalsA.horesSetmanals) * 100 : null;

  const topBars = useMemo(() => {
    return [...data.files]
      .map((f) => ({
        name: (f.label.split(" · ")[0] ?? f.label).slice(0, 18),
        a: f.personesA,
        b: f.personesB,
        absDelta: Math.abs(f.deltaPersones),
      }))
      .filter((f) => f.a > 0 || f.b > 0)
      .sort((x, y) => y.absDelta - x.absDelta)
      .slice(0, 10);
  }, [data.files]);

  const movers = useMemo(() => {
    return [...data.files]
      .filter((f) => f.deltaPersones !== 0 || f.deltaHores !== 0)
      .sort((a, b) => Math.abs(b.deltaPersones) - Math.abs(a.deltaPersones))
      .slice(0, 8);
  }, [data.files]);

  if (data.buit) {
    return (
      <p className={styles.empty}>
        Sense dades per comparar. Revisa els períodes o importa jornada a Dades.
      </p>
    );
  }

  return (
    <div className={styles.wrap}>
      <section className={styles.hero}>
        <div className={styles.heroTop}>
          <div>
            <h2 className={styles.heroTitle}>Comparativa de plantilla</h2>
            <p className={styles.heroMeta}>
              <span className={styles.badge}>{data.labelA}</span>
              <span className={styles.metaSep}>→</span>
              <span className={styles.badge}>{data.labelB}</span>
            </p>
          </div>
          <div className={styles.heroMetrics}>
            <div className={styles.heroMetric}>
              <span className={styles.heroMetricLabel}>Δ Persones</span>
              <span
                className={styles.heroMetricValuePeople}
                style={{
                  color:
                    deltaPers > 0
                      ? OPSIA_NUM.positive
                      : deltaPers < 0
                        ? "var(--color-destructive)"
                        : undefined,
                }}
              >
                {deltaPers > 0 ? "+" : ""}
                {formatNum(deltaPers, 1)}
              </span>
              <span className={styles.heroMetricHint}>
                {pctPers != null ? `${pctPers > 0 ? "+" : ""}${formatNum(pctPers, 1)}%` : "—"} vs{" "}
                {data.labelA}
              </span>
            </div>
            <div className={styles.heroMetric}>
              <span className={styles.heroMetricLabel}>Δ Hores / setmana</span>
              <span
                className={styles.heroMetricValuePeople}
                style={{
                  color:
                    deltaHores > 0
                      ? OPSIA_NUM.positive
                      : deltaHores < 0
                        ? "var(--color-destructive)"
                        : undefined,
                }}
              >
                {deltaHores > 0 ? "+" : ""}
                {formatNum(deltaHores, 1)}
              </span>
              <span className={styles.heroMetricHint}>
                {pctHores != null ? `${pctHores > 0 ? "+" : ""}${formatNum(pctHores, 1)}%` : "—"} vs{" "}
                {data.labelA}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.insightRow}>
          <div
            className={cn(
              styles.insight,
              deltaPers > 0
                ? styles.insightPos
                : deltaPers < 0
                  ? styles.insightNeg
                  : styles.insightNeu
            )}
          >
            Plantilla {deltaPers > 0 ? "creix" : deltaPers < 0 ? "baixa" : "estable"} en{" "}
            <strong>
              {deltaPers > 0 ? "+" : ""}
              {formatNum(deltaPers, 1)}
            </strong>{" "}
            persones
          </div>
          <div
            className={cn(
              styles.insight,
              deltaHores > 0
                ? styles.insightPos
                : deltaHores < 0
                  ? styles.insightNeg
                  : styles.insightNeu
            )}
          >
            Hores contractades {deltaHores > 0 ? "pugen" : deltaHores < 0 ? "baixen" : "estables"}{" "}
            <strong>
              {deltaHores > 0 ? "+" : ""}
              {formatNum(deltaHores, 1)} h/setm.
            </strong>
          </div>
        </div>
      </section>

      <div className={styles.grid2}>
        <section className={styles.chartCard}>
          <div className={styles.rankHead}>
            <h3 className={styles.rankTitle}>Persones · top moviments</h3>
            <p className={styles.rankLead}>
              {data.labelA} vs {data.labelB}
            </p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={topBars}
              layout="vertical"
              margin={{ left: 8, right: 12, top: 8, bottom: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="var(--color-border)"
              />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Bar
                dataKey="a"
                name={data.labelA}
                fill={OPSIA_CHART_SERIES[0]}
                radius={[0, 3, 3, 0]}
              />
              <Bar
                dataKey="b"
                name={data.labelB}
                fill={OPSIA_CHART_SERIES[1]}
                radius={[0, 3, 3, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className={styles.rankCard}>
          <div className={styles.rankHead}>
            <h3 className={styles.rankTitle}>Majors variacions</h3>
            <p className={styles.rankLead}>Δ persones i hores (B − A)</p>
          </div>
          <ul className={styles.deltaList}>
            {movers.map((f) => (
              <li key={f.key} className={styles.deltaItem}>
                <div>
                  <div className={styles.cellMain}>{f.label}</div>
                  {f.sublabel ? <div className={styles.cellSub}>{f.sublabel}</div> : null}
                </div>
                <div className={styles.deltaNums}>
                  <span
                    className={cn(
                      f.deltaPersones > 0 ? styles.pos : f.deltaPersones < 0 ? styles.neg : ""
                    )}
                  >
                    {f.deltaPersones > 0 ? "+" : ""}
                    {formatNum(f.deltaPersones, 1)} pers.
                  </span>
                  <span
                    className={cn(
                      f.deltaHores > 0 ? styles.pos : f.deltaHores < 0 ? styles.neg : ""
                    )}
                  >
                    {f.deltaHores > 0 ? "+" : ""}
                    {formatNum(f.deltaHores, 1)} h
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className={styles.detailCard}>
        <div className={styles.rankHead}>
          <h3 className={styles.rankTitle}>Taula comparativa completa</h3>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Àmbit</th>
                <th className={styles.num}>{data.labelA}</th>
                <th className={styles.num}>{data.labelB}</th>
                <th className={styles.num}>Δ pers.</th>
                <th className={styles.num}>{data.labelA} h</th>
                <th className={styles.num}>{data.labelB} h</th>
                <th className={styles.num}>Δ h</th>
              </tr>
            </thead>
            <tbody>
              {data.files.map((f) => (
                <tr key={f.key}>
                  <td>
                    <div className={styles.cellMain}>{f.label}</div>
                    {f.sublabel ? <div className={styles.cellSub}>{f.sublabel}</div> : null}
                  </td>
                  <td className={styles.num}>{formatNum(f.personesA, 1)}</td>
                  <td className={styles.num}>{formatNum(f.personesB, 1)}</td>
                  <td
                    className={cn(
                      styles.num,
                      f.deltaPersones > 0 ? styles.pos : f.deltaPersones < 0 ? styles.neg : ""
                    )}
                  >
                    {formatNum(f.deltaPersones, 1)}
                  </td>
                  <td className={styles.num}>{formatNum(f.horesA, 1)}</td>
                  <td className={styles.num}>{formatNum(f.horesB, 1)}</td>
                  <td
                    className={cn(
                      styles.num,
                      f.deltaHores > 0 ? styles.pos : f.deltaHores < 0 ? styles.neg : ""
                    )}
                  >
                    {formatNum(f.deltaHores, 1)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className={styles.num}>{formatNum(data.totalsA.nombrePersones, 1)}</td>
                <td className={styles.num}>{formatNum(data.totalsB.nombrePersones, 1)}</td>
                <td
                  className={cn(
                    styles.num,
                    deltaPers > 0 ? styles.pos : deltaPers < 0 ? styles.neg : ""
                  )}
                >
                  {formatNum(deltaPers, 1)}
                </td>
                <td className={styles.num}>{formatNum(data.totalsA.horesSetmanals, 1)}</td>
                <td className={styles.num}>{formatNum(data.totalsB.horesSetmanals, 1)}</td>
                <td
                  className={cn(
                    styles.num,
                    deltaHores > 0 ? styles.pos : deltaHores < 0 ? styles.neg : ""
                  )}
                >
                  {formatNum(deltaHores, 1)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
