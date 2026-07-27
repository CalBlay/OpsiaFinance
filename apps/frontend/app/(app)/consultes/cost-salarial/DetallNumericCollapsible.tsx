"use client";

import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";
import styles from "./DetallNumericCollapsible.module.css";

export function DetallNumericCollapsible({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: ReactNode;
}) {
  const [obert, setObert] = useState(false);

  return (
    <div className={styles.section}>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setObert((v) => !v)}
        aria-expanded={obert}
      >
        <ChevronDown size={16} className={cn(styles.chevron, obert && styles.chevronOpen)} />
        {title}
        <span className={styles.hint}>{obert ? "Amaga" : "Mostra"}</span>
      </button>
      {obert && (
        <div className={styles.body}>
          {children}
          {caption && <p className={styles.caption}>{caption}</p>}
        </div>
      )}
    </div>
  );
}
