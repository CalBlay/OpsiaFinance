"use client";

import { DadesBadge, DadesEmpty, DadesPanel } from "@/components/dades/DadesPanel";
import type {
  ComparativaPersonalMes,
  FilComparativaPersonal,
  FilComparativaPersonalLn,
  ImportsSousSs,
} from "@/lib/cost-personal-centre/comparativa";
import { MESOS_LLARGS } from "@/lib/periodes";
import { formatNum } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import pageStyles from "../cost-salarial/page.module.css";
import styles from "./ComparativaPersonal.module.css";

function Num({
  v,
  emphasize,
  decimals = 0,
}: {
  v: number;
  emphasize?: boolean;
  decimals?: number;
}) {
  if (Math.abs(v) < 0.005) return <span className={styles.muted}>—</span>;
  const cls = emphasize ? (Math.abs(v) > 0.5 ? styles.diff : styles.ok) : styles.num;
  return <span className={cls}>{formatNum(v, decimals)}</span>;
}

function Pair({ imp }: { imp: ImportsSousSs }) {
  return (
    <>
      <td className={styles.right}>
        <Num v={imp.sous} />
      </td>
      <td className={styles.right}>
        <Num v={imp.ss} />
      </td>
    </>
  );
}

type Nivell = "ln" | "centre";

export function ComparativaPersonalPanel({
  data,
  anys,
  filtreAny,
  filtreMes,
}: {
  data: ComparativaPersonalMes | null;
  anys: number[];
  filtreAny: number;
  filtreMes: number | null;
}) {
  const router = useRouter();
  const [nomesDiff, setNomesDiff] = useState(true);
  const [nivell, setNivell] = useState<Nivell>("ln");
  const ara = new Date();

  const anysOpts = useMemo(() => {
    const s = new Set(anys);
    s.add(ara.getFullYear());
    return [...s].sort((a, b) => b - a);
  }, [anys, ara]);

  const pushFiltre = (any: number, mes: number | null) => {
    const p = new URLSearchParams();
    p.set("vista", "comparativa");
    p.set("any", String(any));
    if (mes) p.set("mes", String(mes));
    router.push(`/dades/cost-personal-centre?${p}`);
  };

  const filters = (
    <div className={styles.filters}>
      <select
        className={pageStyles.input}
        value={filtreAny}
        onChange={(e) => pushFiltre(Number(e.target.value), filtreMes)}
      >
        {anysOpts.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      <select
        className={pageStyles.input}
        value={filtreMes ?? ""}
        onChange={(e) => pushFiltre(filtreAny, e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">Tria un mes…</option>
        {MESOS_LLARGS.map((m, i) => (
          <option key={m} value={i + 1}>
            {m}
          </option>
        ))}
      </select>
      {filtreMes != null && (
        <>
          <select
            className={pageStyles.input}
            value={nivell}
            onChange={(e) => setNivell(e.target.value as Nivell)}
          >
            <option value="ln">Per línia de negoci</option>
            <option value="centre">Per centre</option>
          </select>
          <label
            className={styles.muted}
            style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
          >
            <input
              type="checkbox"
              checked={nomesDiff}
              onChange={(e) => setNomesDiff(e.target.checked)}
            />
            Només amb diferència (sous o SS)
          </label>
        </>
      )}
    </div>
  );

  if (filtreMes == null) {
    return (
      <DadesPanel
        title="Comparativa SAP · Nòmina · Millores"
        meta="Sous + SS · SAP directe (sense ajustos) vs Nòmina + Millores"
      >
        {filters}
        <DadesEmpty text="Selecciona un mes per comparar per LN i centre." />
      </DadesPanel>
    );
  }

  if (!data) {
    return (
      <DadesPanel title="Comparativa SAP · Nòmina · Millores">
        {filters}
        <DadesEmpty text="Sense dades per aquest període." />
      </DadesPanel>
    );
  }

  const filesCentre: FilComparativaPersonal[] = nomesDiff
    ? data.files.filter(
        (f) => Math.abs(f.deltaPayrollSap.sous) > 0.5 || Math.abs(f.deltaPayrollSap.ss) > 0.5
      )
    : data.files;

  const filesLn: FilComparativaPersonalLn[] = nomesDiff
    ? data.perLn.filter(
        (f) => Math.abs(f.deltaPayrollSap.sous) > 0.5 || Math.abs(f.deltaPayrollSap.ss) > 0.5
      )
    : data.perLn;

  const t = data.totals;

  return (
    <DadesPanel
      title="Comparativa SAP · Nòmina · Millores"
      meta={`${data.periodNom} · ${data.resum.centresAmbDiferencia} amb diferència (sous o SS) · ${data.resum.centresAmbPayroll} amb payroll · ${data.resum.centresNomesSap} només SAP`}
    >
      {filters}

      <p className={styles.hint}>
        Només <strong>SAP directe</strong> (importació, sense ajustos) vs{" "}
        <strong>Nòmina + Millores</strong>. Es mostra la diferència de <strong>sous</strong> i de{" "}
        <strong>SS</strong> per separat: (N+M) − SAP. Les Δ en vermell indiquen desquadrament (≥
        0,50 €).
      </p>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <colgroup>
            <col style={{ width: "14rem" }} />
            <col style={{ width: "4.2rem" }} />
            <col span={2} />
            <col span={2} />
            <col span={2} />
            <col span={2} />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2} className={`${styles.centre} ${styles.stickyCentre}`}>
                {nivell === "ln" ? "Línia de negoci" : "Centre"}
              </th>
              <th rowSpan={2} className={styles.origen}>
                {nivell === "ln" ? "Centres" : "Nòmina"}
              </th>
              <th colSpan={2} className={`${styles.group} ${styles.groupFirst}`}>
                SAP directe
              </th>
              <th colSpan={2} className={styles.group}>
                Nòmina
              </th>
              <th colSpan={2} className={styles.group}>
                Millores
              </th>
              <th colSpan={2} className={`${styles.group} ${styles.groupFirst}`}>
                (N+M) − SAP
              </th>
            </tr>
            <tr>
              <th className={`${styles.sub} ${styles.groupFirst}`}>Sous</th>
              <th className={styles.sub}>SS</th>
              <th className={`${styles.sub} ${styles.groupFirst}`}>Sous</th>
              <th className={styles.sub}>SS</th>
              <th className={`${styles.sub} ${styles.groupFirst}`}>Sous</th>
              <th className={styles.sub}>SS</th>
              <th className={`${styles.sub} ${styles.groupFirst}`}>Δ Sous</th>
              <th className={styles.sub}>Δ SS</th>
            </tr>
          </thead>
          <tbody>
            <tr className={styles.totalRow}>
              <td className={styles.stickyCentre}>
                TOTAL {data.periodNom}
                <div className={styles.muted} style={{ fontSize: "0.72rem", fontWeight: 500 }}>
                  N+M sous {formatNum(t.payroll.sous, 0)} · SS {formatNum(t.payroll.ss, 0)}
                </div>
              </td>
              <td>—</td>
              <Pair imp={t.sap} />
              <Pair imp={t.nomina} />
              <Pair imp={t.millores} />
              <td className={styles.right}>
                <Num v={t.deltaPayrollSap.sous} emphasize />
              </td>
              <td className={styles.right}>
                <Num v={t.deltaPayrollSap.ss} emphasize />
              </td>
            </tr>

            {nivell === "ln" ? (
              !filesLn.length ? (
                <tr>
                  <td colSpan={10} style={{ padding: "1rem" }}>
                    <DadesEmpty
                      text={
                        nomesDiff
                          ? "Cap LN amb diferència significativa (sous o SS ≥ 0,50 €)."
                          : "Cap LN amb dades."
                      }
                    />
                  </td>
                </tr>
              ) : (
                filesLn.map((f) => (
                  <tr key={f.liniaCodi}>
                    <td className={styles.stickyCentre}>
                      <strong>{f.liniaCodi}</strong>
                    </td>
                    <td>
                      <DadesBadge>{f.centres}</DadesBadge>
                    </td>
                    <Pair imp={f.sap} />
                    <Pair imp={f.nomina} />
                    <Pair imp={f.millores} />
                    <td className={styles.right}>
                      <Num v={f.deltaPayrollSap.sous} emphasize />
                    </td>
                    <td className={styles.right}>
                      <Num v={f.deltaPayrollSap.ss} emphasize />
                    </td>
                  </tr>
                ))
              )
            ) : !filesCentre.length ? (
              <tr>
                <td colSpan={10} style={{ padding: "1rem" }}>
                  <DadesEmpty
                    text={
                      nomesDiff
                        ? "Cap centre amb diferència significativa (sous o SS ≥ 0,50 €)."
                        : "Cap centre amb dades."
                    }
                  />
                </td>
              </tr>
            ) : (
              filesCentre.map((f) => (
                <tr key={f.centreId}>
                  <td className={styles.stickyCentre}>
                    <strong>{f.centreCodi}</strong>
                    <span className={styles.muted}> · {f.centreNom}</span>
                    {f.liniaCodi && (
                      <div className={styles.muted} style={{ fontSize: "0.72rem" }}>
                        {f.liniaCodi}
                      </div>
                    )}
                  </td>
                  <td>
                    <DadesBadge>{f.tePayroll ? "N+M" : "SAP"}</DadesBadge>
                  </td>
                  <Pair imp={f.sap} />
                  <Pair imp={f.nomina} />
                  <Pair imp={f.millores} />
                  <td className={styles.right}>
                    <Num v={f.deltaPayrollSap.sous} emphasize />
                  </td>
                  <td className={styles.right}>
                    <Num v={f.deltaPayrollSap.ss} emphasize />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </DadesPanel>
  );
}
