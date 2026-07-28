"use client";

import { cn, formatNum } from "@/lib/utils";
import { Check, Pencil, X as XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import styles from "./PivotTable.module.css";

export interface PivotColumn {
  key: string;
  label: string;
  sublabel?: string;
}

export interface PivotRow {
  node: number;
  concepteId?: string;
  descripcio: string;
  esSubtotal: boolean;
  valors: number[];
  total: number;
}

export type PivotEditSave = (input: {
  centreId: string;
  any: number;
  mes: number;
  concepteResultatId: string;
  valorActual: number;
  valorObjectiu: number;
  motiu: string;
}) => Promise<{ ok: boolean; missatge: string }>;

export interface PivotEditConfig {
  centreId: string;
  any: number;
  onSave: PivotEditSave;
}

/** Accepta un import o una operació (p.ex. `122052,81 + 1000`). */
function parseInput(s: string): number | null {
  const src = s
    .trim()
    .replace(/\s+/g, "")
    .replace(/(\d),(\d)/g, "$1.$2");
  if (!src) return null;
  if (!/^[\d.+\-*/]+$/.test(src)) return null;

  let i = 0;
  const peek = () => src[i];
  const consume = () => src[i++];

  function parseNumber(): number {
    const start = i;
    while (i < src.length && ((src[i] >= "0" && src[i] <= "9") || src[i] === ".")) i++;
    if (start === i) throw new Error("bad number");
    const n = Number(src.slice(start, i));
    if (!Number.isFinite(n)) throw new Error("bad number");
    return n;
  }

  function parseFactor(): number {
    if (peek() === "+") {
      consume();
      return parseFactor();
    }
    if (peek() === "-") {
      consume();
      return -parseFactor();
    }
    return parseNumber();
  }

  function parseTerm(): number {
    let v = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const op = consume();
      const r = parseFactor();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }

  function parseExpr(): number {
    let v = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = consume();
      const r = parseTerm();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }

  try {
    const v = parseExpr();
    if (i !== src.length || !Number.isFinite(v)) return null;
    return Math.round(v * 100) / 100;
  } catch {
    return null;
  }
}

function CellDisplay({ value }: { value: number }) {
  if (value === 0) return <span className={styles.zero}>–</span>;
  return <span className={value < 0 ? styles.neg : styles.pos}>{formatNum(value)}</span>;
}

function EditableCell({
  value,
  concepteId,
  mes,
  edit,
}: {
  value: number;
  concepteId: string;
  mes: number;
  edit: PivotEditConfig;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [motiu, setMotiu] = useState("");
  const [current, setCurrent] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setCurrent(value);
  }, [value, editing]);

  function startEdit() {
    setDraft(String(current).replace(".", ","));
    setMotiu("");
    setError(null);
    setEditing(true);
    setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }, 0);
  }

  function cancel() {
    setEditing(false);
    setError(null);
    setMotiu("");
  }

  function save() {
    const nou = parseInput(draft);
    if (nou === null) {
      setError("Valor no vàlid");
      return;
    }
    if (!motiu.trim()) {
      setError("El motiu és obligatori");
      return;
    }
    if (nou === current) {
      setEditing(false);
      return;
    }

    startTransition(async () => {
      const res = await edit.onSave({
        centreId: edit.centreId,
        any: edit.any,
        mes,
        concepteResultatId: concepteId,
        valorActual: current,
        valorObjectiu: nou,
        motiu: motiu.trim(),
      });
      if (res.ok) {
        setCurrent(nou);
        setEditing(false);
        setMotiu("");
        router.refresh();
      } else {
        setError(res.missatge);
      }
    });
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    }
    if (e.key === "Escape") cancel();
  }

  if (!editing) {
    return (
      <span className={styles.importWrap}>
        <CellDisplay value={current} />
        <button
          type="button"
          className={styles.editTrigger}
          onClick={startEdit}
          aria-label="Ajusta import"
        >
          <Pencil size={12} />
        </button>
      </span>
    );
  }

  return (
    <span className={styles.editPanel}>
      <input
        ref={inputRef}
        className={styles.editInput}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKey}
        disabled={isPending}
        aria-label="Nou import"
        placeholder="Import o operació"
      />
      <input
        className={styles.motiuInput}
        value={motiu}
        onChange={(e) => setMotiu(e.target.value)}
        onKeyDown={handleKey}
        disabled={isPending}
        aria-label="Motiu de l'ajust"
        placeholder="Motiu"
      />
      <span className={styles.editActions}>
        <button
          type="button"
          className={styles.editBtn}
          onMouseDown={(e) => {
            e.preventDefault();
            save();
          }}
          disabled={isPending}
          aria-label="Desa"
        >
          <Check size={13} />
        </button>
        <button
          type="button"
          className={styles.editBtnCancel}
          onMouseDown={(e) => {
            e.preventDefault();
            cancel();
          }}
          disabled={isPending}
          aria-label="Cancel·la"
        >
          <XIcon size={13} />
        </button>
      </span>
      {error && <span className={styles.editError}>{error}</span>}
    </span>
  );
}

export function PivotTable({
  columns,
  rows,
  totalLabel = "Total",
  showTotal = true,
  firstColLabel = "Concepte",
  canEdit = false,
  editConfig,
}: {
  columns: PivotColumn[];
  rows: PivotRow[];
  totalLabel?: string;
  showTotal?: boolean;
  firstColLabel?: string;
  canEdit?: boolean;
  editConfig?: PivotEditConfig;
}) {
  const editable = canEdit && !!editConfig;

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={cn(styles.th, styles.stickyCol, styles.left)}>{firstColLabel}</th>
            {columns.map((c) => (
              <th key={c.key} className={cn(styles.th, styles.right)}>
                <span className={styles.colLabel}>{c.label}</span>
                {c.sublabel && <span className={styles.colSub}>{c.sublabel}</span>}
              </th>
            ))}
            {showTotal && (
              <th className={cn(styles.th, styles.right, styles.totalCol)}>{totalLabel}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.node} className={r.esSubtotal ? styles.subtotalRow : undefined}>
              <td className={cn(styles.td, styles.stickyCol, styles.left, styles.concept)}>
                {r.descripcio}
              </td>
              {r.valors.map((v, i) => {
                const cellEditable = editable && !r.esSubtotal && !!r.concepteId;
                const edit = cellEditable ? editConfig : undefined;
                const columnKey = columns[i]?.key ?? `${r.node}-${i}`;
                return (
                  <td
                    key={columnKey}
                    className={cn(styles.td, styles.right, cellEditable && styles.editableTd)}
                  >
                    {cellEditable && r.concepteId && edit ? (
                      <EditableCell value={v} concepteId={r.concepteId} mes={i + 1} edit={edit} />
                    ) : (
                      <CellDisplay value={v} />
                    )}
                  </td>
                );
              })}
              {showTotal && (
                <td className={cn(styles.td, styles.right, styles.totalCol)}>
                  <CellDisplay value={r.total} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
