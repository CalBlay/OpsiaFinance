"use client";

import type { KpiComparatiuItem, KpiInformeItem } from "@/lib/kpi-definitions";
import { cn, formatNum } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";
import styles from "./report.module.css";

function variacioPct(actual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((actual - anterior) / Math.abs(anterior)) * 100;
}

function pctAbs(pct: number | null): string | null {
  if (pct === null) return null;
  return formatNum(Math.abs(pct), 1);
}

function DeltaIcon({ positiu, size = 16 }: { positiu: boolean; size?: number }) {
  if (positiu) return <TrendingUp size={size} strokeWidth={2.5} />;
  return <TrendingDown size={size} strokeWidth={2.5} />;
}

function KpiCardShell({
  label,
  periodeLabel,
  children,
}: {
  label: string;
  periodeLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.kpiCardExec}>
      <div className={styles.kpiExecHeader}>
        <span className={styles.kpiExecLabel}>{label}</span>
        <span className={styles.kpiExecPeriode}>{periodeLabel}</span>
      </div>
      {children}
    </div>
  );
}

function KpiImportBlock({ import_, neg }: { import_: number; neg?: boolean }) {
  return (
    <div className={cn(styles.kpiExecImport, neg && import_ < 0 && styles.kpiExecImportNeg)}>
      {formatNum(import_)} €
    </div>
  );
}

function KpiPctSobreVendes({ pct, hint }: { pct: number; hint: string }) {
  return (
    <div className={styles.kpiExecPctRow}>
      <span className={styles.kpiExecPctVal}>{pctAbs(pct)}%</span>
      <span className={styles.kpiExecPctHint}>{hint}</span>
    </div>
  );
}

function KpiCardInforme({ k, periodeLabel }: { k: KpiInformeItem; periodeLabel: string }) {
  return (
    <KpiCardShell label={k.label} periodeLabel={periodeLabel}>
      <KpiImportBlock import_={k.import_} neg />
      {k.tipus === "vendes" && k.nota && k.importSecundari !== undefined ? (
        <div className={styles.kpiExecSub}>
          {k.nota}: {formatNum(k.importSecundari)} €
        </div>
      ) : k.tipus === "vendes" ? (
        <div className={styles.kpiExecSub}>Total del període</div>
      ) : k.pctVendes !== null ? (
        <KpiPctSobreVendes pct={k.pctVendes} hint="sobre vendes" />
      ) : null}
    </KpiCardShell>
  );
}

function KpiCardComparatiu({ k, periodeLabel }: { k: KpiComparatiuItem; periodeLabel: string }) {
  const teComparativa = k.refLabel && k.totalitatAnterior !== null;
  const varPct = teComparativa ? variacioPct(k.totalitat, k.totalitatAnterior!) : null;
  const ppDiff =
    k.pctActual !== null && k.pctAnterior !== null
      ? Math.abs(k.pctActual) - Math.abs(k.pctAnterior)
      : null;

  const usaVarPct = k.tipus === "vendes" || k.tipus === "ebitda";
  const deltaPrincipal = usaVarPct ? varPct : ppDiff;
  const deltaPositiu =
    deltaPrincipal === null ? null : k.tipus === "cost" ? deltaPrincipal < 0 : deltaPrincipal > 0;

  return (
    <KpiCardShell label={k.label} periodeLabel={periodeLabel}>
      <KpiImportBlock import_={k.totalitat} neg />
      {k.tipus !== "vendes" && k.pctActual !== null && (
        <KpiPctSobreVendes pct={k.pctActual} hint={`sobre vendes · ${k.actualLabel ?? ""}`} />
      )}
      {k.tipus === "vendes" && k.actualLabel && (
        <div className={styles.kpiExecSub}>{k.actualLabel}</div>
      )}

      {teComparativa && deltaPrincipal !== null && deltaPositiu !== null && (
        <div
          className={cn(
            styles.kpiExecBanner,
            deltaPositiu ? styles.kpiExecBannerPos : styles.kpiExecBannerNeg
          )}
        >
          <DeltaIcon positiu={deltaPositiu} size={18} />
          <span className={styles.kpiExecBannerText}>
            {usaVarPct ? (
              <>
                {varPct! > 0 ? "+" : ""}
                {formatNum(varPct!, 1)}%
                <span className={styles.kpiExecBannerVs}>
                  {k.tipus === "vendes" ? " vendes" : " EBITDA"} vs {k.refLabel}
                </span>
              </>
            ) : (
              <>
                {ppDiff! > 0 ? "+" : ""}
                {formatNum(ppDiff!, 1)} pp
                <span className={styles.kpiExecBannerVs}> sobre vendes vs {k.refLabel}</span>
              </>
            )}
          </span>
        </div>
      )}

      {teComparativa && k.tipus !== "vendes" && k.pctAnterior !== null && k.pctActual !== null && (
        <div className={styles.kpiExecCompare}>
          <div className={styles.kpiExecCompareItem}>
            <span className={styles.kpiExecCompareAny}>{k.refLabel}</span>
            <span className={styles.kpiExecComparePct}>{pctAbs(k.pctAnterior)}%</span>
          </div>
          <span className={styles.kpiExecCompareArrow}>→</span>
          <div className={styles.kpiExecCompareItem}>
            <span className={styles.kpiExecCompareAny}>{k.actualLabel}</span>
            <span className={cn(styles.kpiExecComparePct, styles.kpiExecComparePctActual)}>
              {pctAbs(k.pctActual)}%
            </span>
          </div>
        </div>
      )}

      {teComparativa && k.totalitatAnterior !== null && (
        <div className={styles.kpiExecFoot}>
          {k.refLabel}: <strong>{formatNum(k.totalitatAnterior)} €</strong>
          {k.tipus !== "vendes" && k.pctAnterior !== null && (
            <span className={styles.kpiExecFootPct}> · {pctAbs(k.pctAnterior)}% s/ vendes</span>
          )}
        </div>
      )}
    </KpiCardShell>
  );
}

export function KpiInformeCards({
  kpis,
  periodeLabel,
}: {
  kpis: KpiInformeItem[];
  periodeLabel: string;
}) {
  return (
    <div className={styles.kpiRowExec}>
      {kpis.map((k) => (
        <KpiCardInforme key={k.label} k={k} periodeLabel={periodeLabel} />
      ))}
    </div>
  );
}

export function KpiComparatiuCards({
  kpis,
  periodeLabel,
}: {
  kpis: KpiComparatiuItem[];
  periodeLabel: string;
}) {
  return (
    <div className={styles.kpiRowExec}>
      {kpis.map((k) => (
        <KpiCardComparatiu key={k.label} k={k} periodeLabel={periodeLabel} />
      ))}
    </div>
  );
}
