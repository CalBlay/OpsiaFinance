import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./DadesFilterBar.module.css";

export type DadesFilterOption = {
  value: string;
  label: string;
};

export type DadesFilterSelect = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: DadesFilterOption[];
  /** Text de l’opció buida (ex. «Tots els anys»). */
  allLabel: string;
  "aria-label"?: string;
};

type DadesFilterBarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder?: string;
  filters?: DadesFilterSelect[];
  /** Resum a sota (ex. «12 de 40 fitxers»). */
  summary?: ReactNode;
  /** Si es passa, substitueix el netejat per defecte (útil amb filtres URL). */
  onClear?: () => void;
  className?: string;
};

/**
 * Barra corporativa de cerca + filtres per a totes les pestanyes de Dades.
 */
export function DadesFilterBar({
  query,
  onQueryChange,
  placeholder = "Cerca…",
  filters = [],
  summary,
  onClear,
  className,
}: DadesFilterBarProps) {
  const teFiltres = !!(query.trim() || filters.some((f) => f.value));

  const netejar = () => {
    if (onClear) {
      onClear();
      return;
    }
    onQueryChange("");
    for (const f of filters) f.onChange("");
  };

  return (
    <div className={cn(styles.wrap, className)}>
      <div className={styles.searchWrap}>
        <Search size={16} className={styles.searchIcon} aria-hidden />
        <input
          type="search"
          className={styles.searchInput}
          placeholder={placeholder}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Cerca"
        />
        {teFiltres && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={netejar}
            aria-label="Netejar cerca i filtres"
            title="Netejar"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {filters.length > 0 && (
        <div className={styles.filtersRow}>
          {filters.map((f) => (
            <select
              key={f.id}
              className={styles.select}
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              aria-label={f["aria-label"] ?? f.allLabel}
            >
              <option value="">{f.allLabel}</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ))}
        </div>
      )}

      {summary != null && summary !== false ? <p className={styles.summary}>{summary}</p> : null}
    </div>
  );
}

/** Normalitza text per a cerca intel·ligent (sense accents, minúscules). */
export function normalitzarCerca(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** True si tots els tokens de la query apareixen al haystack. */
export function coincideixCerca(haystack: string, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  const h = normalitzarCerca(haystack);
  return q
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => h.includes(normalitzarCerca(token)));
}
