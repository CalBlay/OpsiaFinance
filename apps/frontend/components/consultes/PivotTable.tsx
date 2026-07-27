import { formatNum } from "@/lib/utils";
import { cn } from "@/lib/utils";
import styles from "./PivotTable.module.css";

export interface PivotColumn {
  key: string;
  label: string;
  sublabel?: string;
}

export interface PivotRow {
  node: number;
  descripcio: string;
  esSubtotal: boolean;
  valors: number[];
  total: number;
}

function Cell({ value }: { value: number }) {
  if (value === 0) return <span className={styles.zero}>–</span>;
  return <span className={value < 0 ? styles.neg : styles.pos}>{formatNum(value)}</span>;
}

export function PivotTable({
  columns,
  rows,
  totalLabel = "Total",
  showTotal = true,
  firstColLabel = "Concepte",
}: {
  columns: PivotColumn[];
  rows: PivotRow[];
  totalLabel?: string;
  showTotal?: boolean;
  firstColLabel?: string;
}) {
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
              {r.valors.map((v, i) => (
                <td key={i} className={cn(styles.td, styles.right)}>
                  <Cell value={v} />
                </td>
              ))}
              {showTotal && (
                <td className={cn(styles.td, styles.right, styles.totalCol)}>
                  <Cell value={r.total} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
