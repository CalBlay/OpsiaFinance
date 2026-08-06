"use client";

import { DadesPageShell } from "@/components/dades/DadesPageShell";
import { ExportInformeButton } from "@/components/export/ExportInformeButton";
import { traspassResumToExportInforme } from "@/lib/export/dades";
import { MESOS_LLARGS } from "@/lib/periodes";
import type { ResumTraspassPersonal } from "@/lib/traspass-personal/resum";
import { pivotResumLn } from "@/lib/traspass-personal/resum-pivot";
import { formatNum } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export function ResumTraspassPanel({ resum }: { resum: ResumTraspassPersonal }) {
  const router = useRouter();
  const pivotLn = pivotResumLn(resum.perLn);
  const informe = resum.buit ? null : traspassResumToExportInforme(resum);

  return (
    <DadesPageShell
      backHref="/dades/traspass-personal"
      backLabel="Traspassos personal"
      title="Resum traspassos de personal"
      description={
        <>
          Només traspassos <strong>confirmats</strong>. Volum anual traspassat:{" "}
          {formatNum(resum.volumTraspassAny, 2)} € (suma de moviments origen→destí).
        </>
      }
      actions={
        <>
          <ExportInformeButton informe={informe} />
          <label className={styles.anySelect}>
            Any{" "}
            <select
              value={resum.any}
              onChange={(e) => router.push(`/dades/traspass-personal/resum?any=${e.target.value}`)}
            >
              {(resum.anysDisponibles.length ? resum.anysDisponibles : [resum.any]).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </>
      }
    >
      {resum.buit ? (
        <p className={styles.muted}>
          No hi ha traspassos confirmats per {resum.any}. Confirma imports mensuals a{" "}
          <Link href="/dades/traspass-personal">Traspassos personal</Link>.
        </p>
      ) : (
        <>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Entre centres · per mes</h2>
            <p className={styles.helpText}>
              Totals agregats per parell origen → destí i mes (node 13 — sous i salaris).
            </p>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Origen</th>
                    <th>LN origen</th>
                    <th>Destí</th>
                    <th>LN destí</th>
                    <th className={styles.num}>Minuts</th>
                    <th className={styles.num}>Hores</th>
                    <th className={styles.num}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {resum.perCentre.map((r, i) => (
                    <tr key={`${r.mes}-${r.origenCodi}-${r.destiCodi}-${i}`}>
                      <td>{MESOS_LLARGS[r.mes - 1] ?? r.periodNom}</td>
                      <td>
                        {r.origenCodi} · {r.origenNom}
                      </td>
                      <td>
                        {r.origenLnCodi} · {r.origenLnNom}
                      </td>
                      <td>
                        {r.destiCodi} · {r.destiNom}
                      </td>
                      <td>
                        {r.destiLnCodi} · {r.destiLnNom}
                      </td>
                      <td className={styles.num}>{formatNum(r.minuts, 2)}</td>
                      <td className={styles.num}>{formatNum(r.hores, 2)}</td>
                      <td className={styles.num}>{formatNum(r.import_, 2)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Per línia de negoci · per mes</h2>
            <p className={styles.helpText}>
              Sortides = cost que surt de la LN; entrades = cost que entra. El net reflecteix
              traspassos nets entre línies.
            </p>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Línia de negoci</th>
                    <th>Mes</th>
                    <th className={styles.num}>Sortides</th>
                    <th className={styles.num}>Entrades</th>
                    <th className={styles.num}>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {resum.perLn.map((r) => (
                    <tr key={`${r.lnId}-${r.mes}`}>
                      <td>
                        {r.lnCodi} · {r.lnNom}
                      </td>
                      <td>{MESOS_LLARGS[r.mes - 1]}</td>
                      <td className={styles.num}>{formatNum(r.sortides, 2)} €</td>
                      <td className={styles.num}>{formatNum(r.entrades, 2)} €</td>
                      <td className={styles.num}>{formatNum(r.net, 2)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Línies de negoci · resum anual</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Línia de negoci</th>
                    <th className={styles.num}>Sortides any</th>
                    <th className={styles.num}>Entrades any</th>
                    <th className={styles.num}>Net any</th>
                  </tr>
                </thead>
                <tbody>
                  {pivotLn.map((ln) => (
                    <tr key={ln.lnId}>
                      <td>
                        {ln.lnCodi} · {ln.lnNom}
                      </td>
                      <td className={styles.num}>{formatNum(ln.totalSortides, 2)} €</td>
                      <td className={styles.num}>{formatNum(ln.totalEntrades, 2)} €</td>
                      <td className={styles.num}>{formatNum(ln.totalNet, 2)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </DadesPageShell>
  );
}
