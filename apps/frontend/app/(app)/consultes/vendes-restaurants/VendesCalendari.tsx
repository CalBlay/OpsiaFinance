"use client";

import { cn, formatNum } from "@/lib/utils";
import type { DiaVenda } from "@/lib/vendes-restaurants/consultes";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import styles from "./VendesPresentacio.module.css";

const DIES_SET = ["dg.", "dl.", "dt.", "dc.", "dj.", "dv.", "ds."];

function diaSetmana(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return DIES_SET[d.getDay()] ?? "";
}

export function VendesCalendari({ dies }: { dies: DiaVenda[] }) {
  const [taulaOberta, setTaulaOberta] = useState(false);

  if (!dies.length) return null;

  const max = Math.max(...dies.map((d) => d.base), 1);
  const totalBase = dies.reduce((s, d) => s + d.base, 0);
  const totalUd = dies.reduce((s, d) => s + d.unitats, 0);
  const primer = dies[0];
  if (!primer) return null;
  const maxDia = dies.reduce((a, b) => (b.base > a.base ? b : a), primer);
  const minDia = dies.reduce((a, b) => (b.base < a.base ? b : a), primer);

  return (
    <section className={styles.panel}>
      <header className={styles.panelHead}>
        <h3 className={styles.panelTitle}>Vendes per dia</h3>
        <p className={styles.panelLead}>
          Base sense IVA. Dia més fort: {maxDia.dia} ({formatNum(maxDia.base)} €). Més feble:{" "}
          {minDia.dia} ({formatNum(minDia.base)} €).
        </p>
      </header>

      <div className={styles.calWrap}>
        {dies.map((d) => (
          <div
            key={d.dia}
            className={styles.calDay}
            title={`${d.dia} ${diaSetmana(d.dataIso)} · ${formatNum(d.base)} € · ${formatNum(d.unitats, 0)} ud`}
          >
            <div className={styles.calBarTrack}>
              <div
                className={styles.calBar}
                style={{ height: `${Math.max(8, (d.base / max) * 100)}%` }}
              />
            </div>
            <span className={styles.calLabel}>{d.dia}</span>
          </div>
        ))}
      </div>

      <div className={styles.taulaToggleWrap}>
        <button
          type="button"
          className={styles.taulaToggle}
          onClick={() => setTaulaOberta((v) => !v)}
          aria-expanded={taulaOberta}
        >
          <ChevronDown
            size={16}
            className={cn(styles.taulaChevron, taulaOberta && styles.taulaChevronOpen)}
          />
          Taula de vendes diàries
          <span className={styles.taulaHint}>{taulaOberta ? "Amaga" : "Mostra"}</span>
        </button>

        {taulaOberta && (
          <div className={styles.taulaWrap}>
            <table className={styles.taula}>
              <thead>
                <tr>
                  <th>Dia</th>
                  <th>Data</th>
                  <th className={styles.num}>Unitats</th>
                  <th className={styles.num}>Vendes (€)</th>
                  <th className={styles.num}>% del mes</th>
                </tr>
              </thead>
              <tbody>
                {dies.map((d) => {
                  const pctMes = totalBase ? (d.base / totalBase) * 100 : 0;
                  return (
                    <tr key={d.dia}>
                      <td className={styles.nowrap}>
                        {d.dia} <span className={styles.dow}>{diaSetmana(d.dataIso)}</span>
                      </td>
                      <td className={styles.muted}>
                        {d.dataIso.slice(8, 10)}/{d.dataIso.slice(5, 7)}/{d.dataIso.slice(0, 4)}
                      </td>
                      <td className={styles.num}>{formatNum(d.unitats, 0)}</td>
                      <td className={styles.num}>{formatNum(d.base)}</td>
                      <td className={styles.num}>{formatNum(pctMes, 1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>
                    <strong>Total mes</strong>
                  </td>
                  <td className={styles.num}>
                    <strong>{formatNum(totalUd, 0)}</strong>
                  </td>
                  <td className={styles.num}>
                    <strong>{formatNum(totalBase)}</strong>
                  </td>
                  <td className={styles.num}>
                    <strong>100%</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
