"use client";

import { Check, Pencil, X as XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { updateDadaResultatImportAction } from "./actions";
import styles from "./page.module.css";

export interface DadaRow {
  id: string;
  import_: number | string;
  senseCentre: boolean;
  esSubtotal: boolean;
  descripcio: string;
  dimNom: string;
}

function fmt(v: number) {
  return v.toLocaleString("ca-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function CellEditable({ row, canEdit }: { row: DadaRow; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [current, setCurrent] = useState(Number(row.import_));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft(String(current).replace(".", ","));
    setError(null);
    setEditing(true);
    // Cursor al final per poder escriure directament `+ quantitat`
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
  }

  function save() {
    const nou = parseInput(draft);
    if (nou === null) {
      setError("Valor no vàlid");
      return;
    }
    if (nou === current) {
      setEditing(false);
      return;
    }

    startTransition(async () => {
      const res = await updateDadaResultatImportAction(row.id, nou);
      if (res.ok) {
        setCurrent(nou);
        setEditing(false);
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

  const isNeg = current < 0;

  return (
    <td className={`${styles.importCell} ${styles.right}`}>
      {editing ? (
        <span className={styles.editWrap}>
          <input
            ref={inputRef}
            className={styles.editInput}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKey}
            onBlur={save}
            disabled={isPending}
            aria-label="Edita import"
          />
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
          {error && <span className={styles.editError}>{error}</span>}
        </span>
      ) : (
        <span className={styles.importWrap}>
          <span className={isNeg ? styles.neg : undefined}>{fmt(current)} €</span>
          {canEdit && (
            <button
              type="button"
              className={styles.editTrigger}
              onClick={startEdit}
              aria-label="Edita valor"
            >
              <Pencil size={12} />
            </button>
          )}
        </span>
      )}
    </td>
  );
}

export function DadesEditables({
  dades,
  canEdit,
  total,
  shown,
}: {
  dades: DadaRow[];
  canEdit: boolean;
  total: number;
  shown: number;
}) {
  return (
    <>
      {total > shown && (
        <p className={styles.noRows}>
          Mostrant les primeres {shown} de {total} dades.
        </p>
      )}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Concepte</th>
            <th>Centre / LN</th>
            <th className={styles.right}>Import</th>
          </tr>
        </thead>
        <tbody>
          {dades.map((row) => (
            <tr key={row.id} className={row.esSubtotal ? styles.subtotal : undefined}>
              <td>
                <span className={styles.nomCompte}>{row.descripcio}</span>
                {row.esSubtotal && <span className={styles.subtotalLabel}>subtotal</span>}
              </td>
              <td className={styles.dim}>{row.dimNom}</td>
              <CellEditable row={row} canEdit={canEdit && !row.esSubtotal} />
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
