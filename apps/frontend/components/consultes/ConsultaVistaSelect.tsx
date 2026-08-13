"use client";

import { VISTA_COMPTE_CADENA, type VistaCompte, etiquetaVistaCompte } from "@/lib/vista-compte";
import { FILTRE, VISTA_OPCIONS } from "./consulta-filtres";
import styles from "./report.module.css";

/** Selector Vista: per defecte SAP → Directe → + Traspassos → Gestió. */
export function ConsultaVistaSelect<T extends VistaCompte = VistaCompte>({
  id,
  value,
  onChange,
  disabled = false,
  pendingHint = false,
  opcions = VISTA_COMPTE_CADENA as readonly T[],
}: {
  id: string;
  value: T;
  onChange: (vista: T) => void;
  disabled?: boolean;
  pendingHint?: boolean;
  /** Subconjunt (p.ex. només Directe/Gestió a cost personal). */
  opcions?: readonly T[];
}) {
  const valueEfectiu = opcions.includes(value) ? value : (opcions[0] ?? ("directe" as T));

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
        onChange={(e) => onChange(e.target.value as T)}
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
