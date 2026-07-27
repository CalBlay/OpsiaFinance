"use client";

import { formatNum } from "@/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "./PresentacioComite.module.css";

export type SerieMensualComite = {
  mesos: string[];
  ingressos: number[];
  ebitda: number[];
  personal: number[];
  compres: number[];
  gestio: number[];
};

export type SeriePerLnComite = {
  etiquetes: string[];
  ingressos: number[];
  ebitda: number[];
  personal: number[];
  compres: number[];
  gestio: number[];
};

export type KpiComite = {
  label: string;
  import_: number;
  hint?: string;
  accent?: "ingressos" | "cost" | "ebitda";
};

function formatEix(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(Math.round(v));
}

function costPositiu(v: number): number {
  return Math.abs(v);
}

const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "0.65rem",
  fontSize: "0.85rem",
};

function euroTip(value: number): string {
  return `${formatNum(value)} €`;
}

function ChartCard({
  title,
  lead,
  children,
  wide,
}: {
  title: string;
  lead?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <section className={wide ? styles.chartWide : styles.chartCard}>
      <h3 className={styles.chartTitle}>{title}</h3>
      {lead && <p className={styles.chartLead}>{lead}</p>}
      <div className={styles.chartBody}>{children}</div>
    </section>
  );
}

export function PresentacioComite({
  titol,
  periode,
  kpis,
  mensual,
  perLn,
}: {
  titol: string;
  periode: string;
  kpis: KpiComite[];
  mensual: SerieMensualComite;
  perLn: SeriePerLnComite;
}) {
  const dataMensual = mensual.mesos.map((mes, i) => ({
    name: mes,
    Ingressos: mensual.ingressos[i] ?? 0,
    EBITDA: mensual.ebitda[i] ?? 0,
    Personal: costPositiu(mensual.personal[i] ?? 0),
    Compres: costPositiu(mensual.compres[i] ?? 0),
    Gestió: costPositiu(mensual.gestio[i] ?? 0),
  }));

  // Etiquetes curtes de mes (Gen, Feb…) ja venen de MESOS_CURTS
  const dataLn = perLn.etiquetes.map((name, i) => ({
    name,
    Ingressos: perLn.ingressos[i] ?? 0,
    EBITDA: perLn.ebitda[i] ?? 0,
    Personal: costPositiu(perLn.personal[i] ?? 0),
    Compres: costPositiu(perLn.compres[i] ?? 0),
    Gestió: costPositiu(perLn.gestio[i] ?? 0),
  }));

  const tickAngleLn = dataLn.length > 5 ? -28 : 0;

  return (
    <div className={styles.wrap}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Presentació comitè</p>
        <h2 className={styles.heroTitle}>{titol}</h2>
        <p className={styles.heroPeriode}>{periode}</p>
      </header>

      <div className={styles.kpiRow}>
        {kpis.map((k) => (
          <div key={k.label} className={styles.kpiCard} data-accent={k.accent ?? "cost"}>
            <span className={styles.kpiLabel}>{k.label}</span>
            <span className={styles.kpiValue}>{formatNum(k.import_)} €</span>
            {k.hint && <span className={styles.kpiHint}>{k.hint}</span>}
          </div>
        ))}
      </div>

      <div className={styles.grid2}>
        <ChartCard
          title="Any · Ingressos i EBITDA"
          lead="Evolució mes a mes. Ideal per veure la tendència abans d’entrar al detall."
        >
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={dataMensual} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
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
              <Tooltip formatter={(v: number) => euroTip(v)} contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "0.82rem" }} />
              <Bar dataKey="Ingressos" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Line
                type="monotone"
                dataKey="EBITDA"
                stroke="#16a34a"
                strokeWidth={3}
                dot={{ r: 4, fill: "#16a34a" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Any · Costos clau"
          lead="Personal, compres i gestió (imports en positiu per llegir-los millor)."
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={dataMensual} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
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
              <Tooltip formatter={(v: number) => euroTip(v)} contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "0.82rem" }} />
              <Bar dataKey="Personal" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={22} />
              <Bar dataKey="Compres" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={22} />
              <Bar dataKey="Gestió" fill="#ec4899" radius={[3, 3, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard
        wide
        title={`Per línia de negoci · ${periode}`}
        lead="Compres, personal i gestió de cada negoci. Els imports de cost es mostren en positiu."
      >
        <ResponsiveContainer width="100%" height={Math.max(340, 48 + dataLn.length * 28)}>
          <BarChart
            data={dataLn}
            margin={{ top: 8, right: 12, left: 0, bottom: tickAngleLn ? 48 : 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              angle={tickAngleLn}
              textAnchor={tickAngleLn ? "end" : "middle"}
              interval={0}
              height={tickAngleLn ? 70 : undefined}
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
            <Tooltip formatter={(v: number) => euroTip(v)} contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: "0.82rem" }} />
            <Bar dataKey="Personal" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Bar dataKey="Compres" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Bar dataKey="Gestió" fill="#ec4899" radius={[3, 3, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        wide
        title={`Resultat per negoci · ${periode}`}
        lead="Ingressos i EBITDA de cada línia — la foto ràpida per al comitè."
      >
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart
            data={dataLn}
            margin={{ top: 8, right: 12, left: 0, bottom: tickAngleLn ? 48 : 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              angle={tickAngleLn}
              textAnchor={tickAngleLn ? "end" : "middle"}
              interval={0}
              height={tickAngleLn ? 70 : undefined}
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
            <Tooltip formatter={(v: number) => euroTip(v)} contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: "0.82rem" }} />
            <Bar dataKey="Ingressos" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Line
              type="monotone"
              dataKey="EBITDA"
              stroke="#16a34a"
              strokeWidth={3}
              dot={{ r: 4, fill: "#16a34a" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
