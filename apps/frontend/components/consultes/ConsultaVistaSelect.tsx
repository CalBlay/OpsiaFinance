"use client";

import { VISTA_COMPTE_CADENA, type VistaCompte, etiquetaVistaCompte } from "@/lib/vista-compte";
import { FILTRE, VISTA_OPCIONS } from "./consulta-filtres";
import styles from "./report.module.css";

/** Selector Vista: per defecte SAP → Directe → + Traspassos → Gestió. */
export function ConsultaVistaSelect({
  id,
  value,
  onChange,
  disabled = false,
  pendingHint = false,
  opcions = VISTA_COMPTE_CADENA,
}: {
  id: string;
  value: VistaCompte;
  onChange: (vista: VistaCompte) => void;
  disabled?: boolean;
  pendingHint?: boolean;
  /** Subconjunt (p.ex. només Directe/Gestió a cost personal). */
  opcions?: readonly VistaCompte[];
}) {
  const valueEfectiu = opcions.includes(value) ? value : (opcions[0] ?? "directe");

  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={id}>
        {FILTRE.vista}
      </label>
      <select
        id={id}
        className={styles.select}
        style={{ minWidth: 140 }}
        value={valueEfectiu}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as VistaCompte)}
      >
        {opcions.map((v) => (
          <option key={v} value={v}>
            {VISTA_OPCIONS[v] ?? etiquetaVistaCompte(v)}
          </option>
        ))}
      </select>
      {pendingHint ? <span className={styles.filterPending}>Actualitzant…</span> : null}
    </div>
  );
}
