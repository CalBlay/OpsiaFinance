import type { RrhhComparativa, RrhhInforme } from "@/lib/rrhh/consultes";
import { cn, formatNum } from "@/lib/utils";
import styles from "./rrhh.module.css";

export function RrhhKpis({
  persones,
  hores,
  esMitjana,
}: {
  persones: number;
  hores: number;
  esMitjana: boolean;
}) {
  return (
    <div className={styles.kpis}>
      <div className={styles.kpi}>
        <span className={styles.kpiLabel}>{esMitjana ? "Mitjana persones" : "Persones"}</span>
        <span className={styles.kpiValue}>{formatNum(persones, esMitjana ? 1 : 0)}</span>
      </div>
      <div className={styles.kpi}>
        <span className={styles.kpiLabel}>
          {esMitjana ? "Mitjana h/setmana" : "Hores / setmana"}
        </span>
        <span className={styles.kpiValue}>{formatNum(hores, 1)}</span>
      </div>
    </div>
  );
}

export function RrhhTaulaInforme({
  informe,
  esMitjana,
}: {
  informe: RrhhInforme;
  esMitjana: boolean;
}) {
  if (informe.buit) {
    return (
      <p className={styles.empty}>
        Sense dades de jornada per aquest període. Importa l&apos;Excel a Dades → Jornada.
      </p>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Àmbit</th>
            <th className={styles.num}>{esMitjana ? "Pers./mes" : "Persones"}</th>
            <th className={styles.num}>Hores / setmana</th>
            <th className={styles.num}>h / persona</th>
          </tr>
        </thead>
        <tbody>
          {informe.files.map((f) => (
            <tr key={f.key}>
              <td>
                <div className={styles.cellMain}>{f.label}</div>
                {f.sublabel ? <div className={styles.cellSub}>{f.sublabel}</div> : null}
              </td>
              <td className={styles.num}>{formatNum(f.nombrePersones, esMitjana ? 1 : 0)}</td>
              <td className={styles.num}>{formatNum(f.horesSetmanals, 1)}</td>
              <td className={styles.num}>
                {f.horesPerPersona != null ? formatNum(f.horesPerPersona, 1) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td className={styles.num}>
              {formatNum(informe.totals.nombrePersones, esMitjana ? 1 : 0)}
            </td>
            <td className={styles.num}>{formatNum(informe.totals.horesSetmanals, 1)}</td>
            <td className={styles.num}>
              {informe.totals.nombrePersones > 0
                ? formatNum(informe.totals.horesSetmanals / informe.totals.nombrePersones, 1)
                : "—"}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function deltaClass(v: number): string {
  if (v > 0) return styles.deltaPos;
  if (v < 0) return styles.deltaNeg;
  return "";
}

export function RrhhTaulaComparativa({ data }: { data: RrhhComparativa }) {
  if (data.buit) {
    return (
      <p className={styles.empty}>
        Sense dades per comparar. Revisa els períodes o importa jornada a Dades.
      </p>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Àmbit</th>
            <th className={styles.num} colSpan={2}>
              Persones
            </th>
            <th className={styles.num}>Δ</th>
            <th className={styles.num} colSpan={2}>
              Hores / setmana
            </th>
            <th className={styles.num}>Δ</th>
          </tr>
          <tr className={styles.subHead}>
            <th />
            <th className={styles.num}>{data.labelA}</th>
            <th className={styles.num}>{data.labelB}</th>
            <th />
            <th className={styles.num}>{data.labelA}</th>
            <th className={styles.num}>{data.labelB}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data.files.map((f) => (
            <tr key={f.key}>
              <td>
                <div className={styles.cellMain}>{f.label}</div>
                {f.sublabel ? <div className={styles.cellSub}>{f.sublabel}</div> : null}
              </td>
              <td className={styles.num}>{formatNum(f.personesA, 1)}</td>
              <td className={styles.num}>{formatNum(f.personesB, 1)}</td>
              <td className={cn(styles.num, deltaClass(f.deltaPersones))}>
                {formatNum(f.deltaPersones, 1)}
              </td>
              <td className={styles.num}>{formatNum(f.horesA, 1)}</td>
              <td className={styles.num}>{formatNum(f.horesB, 1)}</td>
              <td className={cn(styles.num, deltaClass(f.deltaHores))}>
                {formatNum(f.deltaHores, 1)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td className={styles.num}>{formatNum(data.totalsA.nombrePersones, 1)}</td>
            <td className={styles.num}>{formatNum(data.totalsB.nombrePersones, 1)}</td>
            <td
              className={cn(
                styles.num,
                deltaClass(data.totalsB.nombrePersones - data.totalsA.nombrePersones)
              )}
            >
              {formatNum(data.totalsB.nombrePersones - data.totalsA.nombrePersones, 1)}
            </td>
            <td className={styles.num}>{formatNum(data.totalsA.horesSetmanals, 1)}</td>
            <td className={styles.num}>{formatNum(data.totalsB.horesSetmanals, 1)}</td>
            <td
              className={cn(
                styles.num,
                deltaClass(data.totalsB.horesSetmanals - data.totalsA.horesSetmanals)
              )}
            >
              {formatNum(data.totalsB.horesSetmanals - data.totalsA.horesSetmanals, 1)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
