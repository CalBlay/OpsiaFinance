"use client";

import type { VistaCompte } from "@/lib/vista-compte";
import { FILTRE, VISTA_OPCIONS } from "./consulta-filtres";
import styles from "./report.module.css";

/** Selector Vista corporatiu: Directe | Gestió. */
export function ConsultaVistaSelect({
  id,
  value,
  onChange,
  disabled = false,
  pendingHint = false,
}: {
  id: string;
  value: VistaCompte;
  onChange: (vista: VistaCompte) => void;
  disabled?: boolean;
  pendingHint?: boolean;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={id}>
        {FILTRE.vista}
      </label>
      <select
        id={id}
        className={styles.select}
        style={{ minWidth: 120 }}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "gestio" ? "gestio" : "directe")}
      >
        <option value="directe">{VISTA_OPCIONS.directe}</option>
        <option value="gestio">{VISTA_OPCIONS.gestio}</option>
      </select>
      {pendingHint ? <span className={styles.filterPending}>Actualitzant…</span> : null}
    </div>
  );
}
