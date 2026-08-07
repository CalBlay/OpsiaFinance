"use client";

import { Button } from "@/components/ui/Button";
import { type ExportInforme, downloadXlsx, printInforme } from "@/lib/export";
import { cn } from "@/lib/utils";
import { FileSpreadsheet, FileText, Printer } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./ExportInformeButton.module.css";

type CommonProps = {
  disabled?: boolean;
  className?: string;
};

/** Payload ja montat (adapters de restaurants, etc.). */
type FromInformeProps = CommonProps & {
  informe: ExportInforme | null;
  filename?: never;
  title?: never;
  columns?: never;
  rows?: never;
};

/** Parts explícites (pantalles de Resultats / pivots). */
type FromPartsProps = CommonProps & {
  informe?: undefined;
  filename: string;
  title: string;
  subtitle?: string;
  columns: ExportInforme["columns"];
  rows: ExportInforme["rows"];
  firstColLabel?: string;
  showTotal?: boolean;
  totalLabel?: string;
  sheetName?: string;
};

export type ExportInformeButtonProps = FromInformeProps | FromPartsProps;

function resolveInforme(props: ExportInformeButtonProps): ExportInforme | null {
  if ("informe" in props) return props.informe ?? null;
  if (!props.columns.length || !props.rows.length) return null;
  return {
    filename: props.filename,
    title: props.title,
    subtitle: props.subtitle,
    firstColLabel: props.firstColLabel ?? "Concepte",
    columns: props.columns,
    rows: props.rows,
    showTotal: props.showTotal ?? true,
    totalLabel: props.totalLabel ?? "Total",
    sheetName: props.sheetName,
  };
}

export function ExportInformeButton(props: ExportInformeButtonProps) {
  const { disabled, className } = props;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"xlsx" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const informe = resolveInforme(props);
  const isDisabled = disabled || !informe || busy !== null;

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const runXlsx = async () => {
    if (!informe) return;
    setError(null);
    setBusy("xlsx");
    try {
      await downloadXlsx(informe);
      setOpen(false);
    } catch {
      setError("No s'ha pogut generar l'Excel.");
    } finally {
      setBusy(null);
    }
  };

  const runPdf = () => {
    if (!informe) return;
    setError(null);
    setBusy("pdf");
    try {
      const ok = printInforme(informe);
      if (!ok) {
        setError("Permet finestres emergents per desar PDF.");
      } else {
        setOpen(false);
      }
    } catch {
      setError("No s'ha pogut obrir la vista d'impressió.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={cn(styles.root, className)} ref={rootRef}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={styles.trigger}
        disabled={isDisabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Exportar informe"
        title="Exportar informe"
        onClick={() => setOpen((v) => !v)}
      >
        <Printer className={styles.icon} aria-hidden />
      </Button>

      {open && (
        <div className={styles.menu} id={menuId} role="menu" aria-label="Formats d'exportació">
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            disabled={busy !== null}
            onClick={runXlsx}
          >
            <FileSpreadsheet className={styles.itemIcon} aria-hidden />
            <span className={styles.itemText}>
              <span className={styles.itemTitle}>
                {busy === "xlsx" ? "Generant Excel…" : "Excel (.xlsx)"}
              </span>
              <span className={styles.itemHint}>Full de càlcul amb els imports de la taula</span>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            disabled={busy !== null}
            onClick={runPdf}
          >
            <FileText className={styles.itemIcon} aria-hidden />
            <span className={styles.itemText}>
              <span className={styles.itemTitle}>
                {busy === "pdf" ? "Obrint impressió…" : "PDF / Imprimir"}
              </span>
              <span className={styles.itemHint}>
                Vista corporativa · desar com a PDF del navegador
              </span>
            </span>
          </button>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      )}
    </div>
  );
}
