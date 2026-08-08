"use client";

import { FILTRE } from "@/components/consultes/consulta-filtres";
import styles from "@/components/consultes/report.module.css";
import { MESOS_LLARGS, type RangMesos, normalitzaRangMesos } from "@/lib/periodes";

/** Selector Des de / Fins a + dreceres «Tot l'any» / «Fins ara». */
export function PeriodRangSelectors({
  rang,
  onChange,
  anyActual,
  disabled = false,
}: {
  rang: RangMesos;
  onChange: (rang: RangMesos) => void;
  anyActual: number;
  disabled?: boolean;
}) {
  const mesAra = new Date().getMonth() + 1;
  const anyEnCurs = anyActual === new Date().getFullYear();
  const fromSelectId = "period-rang-from";
  const toSelectId = "period-rang-to";

  function setDes(des: number) {
    onChange(normalitzaRangMesos(des, Math.max(des, rang.fins)));
  }

  function setFins(fins: number) {
    onChange(normalitzaRangMesos(Math.min(rang.des, fins), fins));
  }

  return (
    <>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={fromSelectId}>
          {FILTRE.desDe}
        </label>
        <select
          id={fromSelectId}
          className={styles.select}
          style={{ minWidth: 120 }}
          value={rang.des}
          disabled={disabled}
          onChange={(e) => setDes(Number(e.target.value))}
          aria-label={FILTRE.desDe}
        >
          {MESOS_LLARGS.map((m, i) => (
            <option key={`${i + 1}-${m}`} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={toSelectId}>
          {FILTRE.finsA}
        </label>
        <select
          id={toSelectId}
          className={styles.select}
          style={{ minWidth: 120 }}
          value={rang.fins}
          disabled={disabled}
          onChange={(e) => setFins(Number(e.target.value))}
          aria-label={FILTRE.finsA}
        >
          {MESOS_LLARGS.map((m, i) => (
            <option key={`${i + 1}-${m}`} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <div className={styles.fieldLabel} aria-hidden="true">
          &nbsp;
        </div>
        <div className={styles.periodPresets}>
          <button
            type="button"
            className={styles.periodPresetBtn}
            disabled={disabled}
            onClick={() => onChange(normalitzaRangMesos(1, 12))}
          >
            Tot l&apos;any
          </button>
          {anyEnCurs ? (
            <button
              type="button"
              className={styles.periodPresetBtn}
              disabled={disabled}
              onClick={() => onChange(normalitzaRangMesos(1, mesAra))}
            >
              Fins ara
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}
