"use client";

import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";
import styles from "./report.module.css";

export function DetallCompteCollapsible({
  caption,
  children,
  defaultOpen = false,
  title = "Compte d'explotació detallat",
}: {
  caption: string;
  children: ReactNode;
  /** Obre el compte detallat per defecte (p. ex. vista Gestió empresa). */
  defaultOpen?: boolean;
  title?: string;
}) {
  const [obert, setObert] = useState(defaultOpen);

  return (
    <div className={styles.detallSection}>
      <button
        type="button"
        className={styles.detallToggle}
        onClick={() => setObert((v) => !v)}
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
          {children}
          <p className={styles.tableCaption}>{caption}</p>
        </div>
      )}
    </div>
  );
}
