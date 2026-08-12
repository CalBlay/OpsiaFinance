"use client";

import { cn, formatNum } from "@/lib/utils";
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
  centreId?: string;
  liniaNegociId?: string;
  any: number;
  mes: number;
  concepteResultatId: string;
  valorActual: number;
  valorObjectiu: number;
  motiu: string;
}) => Promise<{ ok: boolean; missatge: string }>;

export interface PivotEditConfig {
  onSave: PivotEditSave;
}

/** Accepta un import o una operació (p.ex. `122052,81 + 1000` o `=-26120,8-22184,61`). */
export function parseImportInput(s: string): number | null {
  const src = s
    .trim()
    .replace(/^=/, "")
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

export type PivotCellClickHandler = (info: {
  concepteId: string;
  concepteNom: string;
  node: number;
  colIndex: number;
  colKey: string;
  colLabel: string;
  value: number;
}) => void;

export function PivotTable({
  columns,
  rows,
  totalLabel = "Total",
  showTotal = true,
  firstColLabel = "Concepte",
  onCellClick,
}: {
  columns: PivotColumn[];
  rows: PivotRow[];
  totalLabel?: string;
  showTotal?: boolean;
  firstColLabel?: string;
  /** @deprecated L'edició es fa al modal de detall. */
  canEdit?: boolean;
  /** @deprecated L'edició es fa al modal de detall. */
  editConfig?: PivotEditConfig;
  onCellClick?: PivotCellClickHandler;
}) {
  const clickable = !!onCellClick;

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
                const col = columns[i];
                const columnKey = col?.key ?? `${r.node}-${i}`;
                const canClick = clickable && !r.esSubtotal && !!r.concepteId;
                return (
                  <td
                    key={columnKey}
                    className={cn(styles.td, styles.right, canClick && styles.clickableTd)}
                    role={canClick ? "button" : undefined}
                    tabIndex={canClick ? 0 : undefined}
                    onClick={
                      canClick && col
                        ? () => {
                            const concepteId = r.concepteId;
                            if (!concepteId) return;
                            onCellClick({
                              concepteId,
                              concepteNom: r.descripcio,
                              node: r.node,
                              colIndex: i,
                              colKey: col.key,
                              colLabel: col.sublabel ? `${col.label} · ${col.sublabel}` : col.label,
                              value: v,
                            });
                          }
                        : undefined
                    }
                    onKeyDown={
                      canClick && col
                        ? (e) => {
                            if (e.key !== "Enter" && e.key !== " ") return;
                            e.preventDefault();
                            const concepteId = r.concepteId;
                            if (!concepteId) return;
                            onCellClick({
                              concepteId,
                              concepteNom: r.descripcio,
                              node: r.node,
                              colIndex: i,
                              colKey: col.key,
                              colLabel: col.sublabel ? `${col.label} · ${col.sublabel}` : col.label,
                              value: v,
                            });
                          }
                        : undefined
                    }
                  >
                    <CellDisplay value={v} />
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
