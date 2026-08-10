"use client";

import { cn } from "@/lib/utils";
import { ChevronDown, Loader2 } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import styles from "./report.module.css";

export function DetallCompteCollapsible({
  caption,
  children,
  defaultOpen = false,
  title = "Compte d'explotació detallat",
  /** Es crida la primera vegada que s'obre (per carregar el pivot en diferit). */
  onFirstOpen,
  loading = false,
}: {
  caption?: string;
  children: ReactNode;
  /** Obre el compte detallat per defecte (p. ex. vista Gestió empresa). */
  defaultOpen?: boolean;
  title?: string;
  onFirstOpen?: () => void | Promise<void>;
  /** Mostra estat de càrrega dins del cos mentre arriba el pivot. */
  loading?: boolean;
}) {
  const [obert, setObert] = useState(defaultOpen);
  const openedOnce = useRef(defaultOpen);

  const handleToggle = () => {
    const next = !obert;
    setObert(next);
    if (next && !openedOnce.current) {
      openedOnce.current = true;
      void onFirstOpen?.();
    }
  };

  return (
    <div className={styles.detallSection}>
      <button
        type="button"
        className={styles.detallToggle}
        onClick={handleToggle}
        aria-expanded={obert}
      >
        <ChevronDown
          size={16}
          className={cn(styles.detallChevron, obert && styles.detallChevronOpen)}
        />
        {title}
        <span className={styles.detallHint}>{obert ? "Amaga" : "Mostra"}</span>
      </button>
      {obert && (
        <div className={styles.detallBody}>
          {loading ? (
            <output className={styles.detallLoading}>
              <Loader2 size={16} className={styles.detallSpinner} aria-hidden />
              Carregant compte detallat…
            </output>
          ) : (
            children
          )}
          {!loading && caption ? <p className={styles.tableCaption}>{caption}</p> : null}
        </div>
      )}
    </div>
  );
}
