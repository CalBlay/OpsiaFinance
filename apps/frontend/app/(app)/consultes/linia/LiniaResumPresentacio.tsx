"use client";

import {
  type KpiComite,
  PresentacioComite,
  type SerieMensualComite,
  type SeriePerLnComite,
} from "@/components/consultes/PresentacioComite";
import { cn, formatNum } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import styles from "../cost-personal/CostPersonalPresentacio.module.css";

export type FilaResumLinia = {
  id: string;
  name: string;
  ingressos: number;
  pctSobreTotal: number | null;
  ebitda: number;
  ebitdaPct: number | null;
  href: string;
};

function formatEuro(v: number): string {
  return `${formatNum(v)} €`;
}

function pctTxt(pct: number | null): string {
  if (pct == null) return "–";
  return `${formatNum(pct, 1)}%`;
}

export function LiniaResumPresentacio({
  periode,
  vistaLabel,
  kpis,
  mensual,
  perLn,
  files,
}: {
  periode: string;
  vistaLabel: string;
  kpis: KpiComite[];
  mensual: SerieMensualComite;
  perLn: SeriePerLnComite;
  files: FilaResumLinia[];
}) {
  const ranked = [...files]
    .filter((f) => f.ingressos > 0 || f.ebitda !== 0)
    .sort((a, b) => b.ingressos - a.ingressos);
  const maxIng = ranked[0]?.ingressos || 1;

  return (
    <div className={styles.wrap}>
      <PresentacioComite
        titol="Resum per línia de negoci"
        periode={periode}
        kpis={kpis}
        mensual={mensual}
        perLn={perLn}
      />

      <section className={styles.rankCard}>
        <div className={styles.rankHead}>
          <h3 className={styles.rankTitle}>Tria una línia per veure el compte</h3>
          <p className={styles.rankLead}>Ordenat per ingressos · % sobre el total · {vistaLabel}</p>
        </div>

        {ranked.length === 0 ? (
          <p className={styles.empty}>Sense dades per aquest període.</p>
        ) : (
          <ul className={styles.rankList}>
            {ranked.map((row, i) => {
              const widthPct = Math.min(100, (row.ingressos / maxIng) * 100);
              return (
                <li key={row.id}>
                  <Link href={row.href} className={cn(styles.rankRow, styles.rankRowLink)}>
                    <span className={styles.rankIndex}>{i + 1}</span>
                    <span className={styles.rankName}>{row.name}</span>
                    <span className={styles.rankTrack}>
                      <span className={styles.rankFill} style={{ width: `${widthPct}%` }} />
                    </span>
                    <span className={styles.rankPct}>{pctTxt(row.pctSobreTotal)}</span>
                    <span className={styles.rankEuro}>
                      {formatEuro(row.ingressos)}
                      {row.ebitdaPct != null ? (
                        <span
                          style={{
                            display: "block",
                            fontSize: "0.72rem",
                            fontWeight: 500,
                            color: "var(--color-muted-foreground)",
                          }}
                        >
                          EBITDA {pctTxt(row.ebitdaPct)}
                        </span>
                      ) : null}
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
