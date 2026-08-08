"use client";

import { cn, formatNum } from "@/lib/utils";
import type { ReactNode } from "react";
import styles from "./OpsiaKpiCard.module.css";

/**
 * Targeta KPI corporativa.
 * Spec: `src/design-system/kpi-card.json`
 * Tokens: `--opsia-cx-*` (`styles/opsia-consultes.css`)
 *
 * Cada pantalla només omple dades; el disseny és compartit.
 */
export type OpsiaKpiAccent =
  | "neutral"
  | "ingressos"
  | "cost"
  | "ebitda"
  | "ebitda-pos"
  | "ebitda-neg";

export type OpsiaKpiCardProps = {
  label: string;
  /** Import principal (€). Si es passa `value`, té prioritat. */
  import_?: number;
  value?: ReactNode;
  periode?: string;
  /** Percentatge destacat (més protagonisme que el text auxiliar). */
  pct?: number | null;
  /** Text petit al costat del % (ex. «s/ ingressos», «sobre vendes»). */
  pctHint?: string;
  /** Si true, el % conserva el signe (EBITDA). */
  pctSigned?: boolean;
  /** Subtítol sense % (ex. «Explotació», «Total del període»). */
  hint?: string;
  accent?: OpsiaKpiAccent;
  /** Contingut extra (banners, comparatives…). */
  children?: ReactNode;
  className?: string;
  /** Marca l’import en vermell si és negatiu. */
  negImport?: boolean;
};

function formatPct(pct: number, signed: boolean): string {
  return signed ? formatNum(pct, 1) : formatNum(Math.abs(pct), 1);
}

export function resolveEbitdaAccent(import_: number): "ebitda-pos" | "ebitda-neg" {
  return import_ < 0 ? "ebitda-neg" : "ebitda-pos";
}

export function OpsiaKpiCard({
  label,
  import_,
  value,
  periode,
  pct,
  pctHint = "s/ ingressos",
  pctSigned = false,
  hint,
  accent = "neutral",
  children,
  className,
  negImport,
}: OpsiaKpiCardProps) {
  const dataAccent = accent === "ebitda" && import_ != null ? resolveEbitdaAccent(import_) : accent;

  const showPct = pct != null && Number.isFinite(pct);
  const pctValue = showPct ? pct : null;
  const displayValue = value ?? (import_ != null ? <>{formatNum(import_)} €</> : null);

  return (
    <div className={cn(styles.card, className)} data-accent={dataAccent}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        {periode ? <span className={styles.periode}>{periode}</span> : null}
      </div>

      {displayValue != null && (
        <div
          className={cn(
            styles.value,
            negImport && import_ != null && import_ < 0 && styles.valueNeg
          )}
        >
          {displayValue}
        </div>
      )}

      {showPct ? (
        <div className={styles.pctRow}>
          <span
            className={cn(
              styles.pct,
              pctSigned && pctValue != null && pctValue > 0 && styles.pctPos,
              pctSigned && pctValue != null && pctValue < 0 && styles.pctNeg
            )}
          >
            {pctValue != null ? `${formatPct(pctValue, pctSigned)}%` : null}
          </span>
          {pctHint ? <span className={styles.pctHint}>{pctHint}</span> : null}
        </div>
      ) : hint ? (
        <p className={styles.hint}>{hint}</p>
      ) : null}

      {children ? <div className={styles.footer}>{children}</div> : null}
    </div>
  );
}

export function OpsiaKpiCardRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(styles.row, className)}>{children}</div>;
}
