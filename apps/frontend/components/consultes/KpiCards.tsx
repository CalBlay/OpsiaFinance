"use client";

import {
  OpsiaKpiCard,
  OpsiaKpiCardRow,
  resolveEbitdaAccent,
} from "@/components/consultes/OpsiaKpiCard";
import type { KpiComparatiuItem, KpiInformeItem } from "@/lib/kpi-definitions";
import { cn, formatNum } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";
import styles from "./report.module.css";

function variacioPct(actual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((actual - anterior) / Math.abs(anterior)) * 100;
}

function pctFmt(pct: number | null, signed: boolean): string | null {
  if (pct === null) return null;
  return signed ? formatNum(pct, 1) : formatNum(Math.abs(pct), 1);
}

function DeltaIcon({ positiu, size = 16 }: { positiu: boolean; size?: number }) {
  if (positiu) return <TrendingUp size={size} strokeWidth={2.5} />;
  return <TrendingDown size={size} strokeWidth={2.5} />;
}

function accentFromTipus(
  tipus: KpiInformeItem["tipus"] | KpiComparatiuItem["tipus"],
  import_?: number
): "ingressos" | "cost" | "ebitda-pos" | "ebitda-neg" | "neutral" {
  if (tipus === "vendes") return "ingressos";
  if (tipus === "cost") return "cost";
  if (tipus === "ebitda") return resolveEbitdaAccent(import_ ?? 0);
  return "neutral";
}

function KpiCardInforme({ k, periodeLabel }: { k: KpiInformeItem; periodeLabel: string }) {
  return (
    <OpsiaKpiCard
      label={k.label}
      import_={k.import_}
      periode={periodeLabel}
      accent={accentFromTipus(k.tipus, k.import_)}
      pct={k.tipus !== "vendes" ? k.pctVendes : null}
      pctHint="sobre vendes"
      pctSigned={k.tipus === "ebitda"}
      hint={
        k.tipus === "vendes"
          ? k.nota && k.importSecundari !== undefined
            ? `${k.nota}: ${formatNum(k.importSecundari)} €`
            : "Total del període"
          : undefined
      }
      negImport
    />
  );
}

function KpiCardComparatiu({ k, periodeLabel }: { k: KpiComparatiuItem; periodeLabel: string }) {
  const teComparativa = k.refLabel && k.totalitatAnterior !== null;
  const anterior = k.totalitatAnterior;
  const varPct = teComparativa && anterior !== null ? variacioPct(k.totalitat, anterior) : null;
  const ppDiff =
    k.pctActual !== null && k.pctAnterior !== null
      ? Math.abs(k.pctActual) - Math.abs(k.pctAnterior)
      : null;

  const usaVarPct = k.tipus === "vendes" || k.tipus === "ebitda";
  const deltaPrincipal = usaVarPct ? varPct : ppDiff;
  const deltaPositiu =
    deltaPrincipal === null ? null : k.tipus === "cost" ? deltaPrincipal < 0 : deltaPrincipal > 0;
  const pctSigned = k.tipus === "ebitda";

  return (
    <OpsiaKpiCard
      label={k.label}
      import_={k.totalitat}
      periode={periodeLabel}
      accent={accentFromTipus(k.tipus, k.totalitat)}
      pct={k.tipus !== "vendes" ? k.pctActual : null}
      pctHint={`sobre vendes${k.actualLabel ? ` · ${k.actualLabel}` : ""}`}
      pctSigned={pctSigned}
      hint={k.tipus === "vendes" ? (k.actualLabel ?? undefined) : undefined}
      negImport
    >
      {teComparativa && deltaPrincipal !== null && deltaPositiu !== null && (
        <div
          className={cn(
            styles.kpiExecBanner,
            deltaPositiu ? styles.kpiExecBannerPos : styles.kpiExecBannerNeg
          )}
        >
          <DeltaIcon positiu={deltaPositiu} size={18} />
          <span className={styles.kpiExecBannerText}>
            {usaVarPct && varPct !== null ? (
              <>
                {varPct > 0 ? "+" : ""}
                {formatNum(varPct, 1)}%
                <span className={styles.kpiExecBannerVs}>
                  {k.tipus === "vendes" ? " vendes" : " EBITDA"} vs {k.refLabel}
                </span>
              </>
            ) : ppDiff !== null ? (
              <>
                {ppDiff > 0 ? "+" : ""}
                {formatNum(ppDiff, 1)} pp
                <span className={styles.kpiExecBannerVs}> sobre vendes vs {k.refLabel}</span>
              </>
            ) : null}
          </span>
        </div>
      )}

      {teComparativa && k.tipus !== "vendes" && k.pctAnterior !== null && k.pctActual !== null && (
        <div className={styles.kpiExecCompare}>
          <div className={styles.kpiExecCompareItem}>
            <span className={styles.kpiExecCompareAny}>{k.refLabel}</span>
            <span className={styles.kpiExecComparePct}>{pctFmt(k.pctAnterior, pctSigned)}%</span>
          </div>
          <span className={styles.kpiExecCompareArrow}>→</span>
          <div className={styles.kpiExecCompareItem}>
            <span className={styles.kpiExecCompareAny}>{k.actualLabel}</span>
            <span className={cn(styles.kpiExecComparePct, styles.kpiExecComparePctActual)}>
              {pctFmt(k.pctActual, pctSigned)}%
            </span>
          </div>
        </div>
      )}

      {teComparativa && k.totalitatAnterior !== null && (
        <div className={styles.kpiExecFoot}>
          {k.refLabel}: <strong>{formatNum(k.totalitatAnterior)} €</strong>
          {k.tipus !== "vendes" && k.pctAnterior !== null && (
            <span className={styles.kpiExecFootPct}>
              {" "}
              · {pctFmt(k.pctAnterior, pctSigned)}% s/ vendes
            </span>
          )}
        </div>
      )}
    </OpsiaKpiCard>
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
    <OpsiaKpiCardRow>
      {kpis.map((k) => (
        <KpiCardInforme key={k.label} k={k} periodeLabel={periodeLabel} />
      ))}
    </OpsiaKpiCardRow>
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
    <OpsiaKpiCardRow>
      {kpis.map((k) => (
        <KpiCardComparatiu key={k.label} k={k} periodeLabel={periodeLabel} />
      ))}
    </OpsiaKpiCardRow>
  );
}
