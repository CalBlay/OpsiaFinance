"use client";

import { DadesBadge, DadesEmpty, DadesPanel } from "@/components/dades/DadesPanel";
import type {
  ComparativaForaCentreMes,
  FilComparativaForaCentre,
} from "@/lib/cost-salarial/comparativa-fora-centre";
import { MESOS_LLARGS } from "@/lib/periodes";
import { formatNum } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import styles from "./ComparativaForaCentre.module.css";
import pageStyles from "./page.module.css";

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

function deptLabel(d: "SALA" | "CUINA" | "SENSE"): string {
  if (d === "CUINA") return "Cuina";
  if (d === "SALA") return "Sala";
  return "—";
}

function estatLabel(estat: ComparativaForaCentreMes["estatTraspass"]): string {
  if (estat === "CONFIRMAT") return "Traspass confirmat";
  if (estat === "BORRADOR") return "Traspass en esborrany";
  return "Sense traspass";
}

export function ComparativaForaCentrePanel({
  data,
  anys,
  filtreAny,
  filtreMes,
}: {
  data: ComparativaForaCentreMes | null;
  anys: number[];
  filtreAny: number;
  filtreMes: number | null;
}) {
  const router = useRouter();
  const [nomesDiff, setNomesDiff] = useState(true);
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
    router.push(`/dades/cost-salarial?${p}`);
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
        <label
          className={styles.muted}
          style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
        >
          <input
            type="checkbox"
            checked={nomesDiff}
            onChange={(e) => setNomesDiff(e.target.checked)}
          />
          Només amb diferència
        </label>
      )}
    </div>
  );

  if (filtreMes == null) {
    return (
      <DadesPanel
        title="Comparativa Fora centre · Excel vs Traspass"
        meta="Valor Excel cost salarial vs imports dels traspassos d'hores"
      >
        {filters}
        <DadesEmpty text="Selecciona un mes per comparar Fora centre Excel amb els traspassos." />
      </DadesPanel>
    );
  }

  if (!data) {
    return (
      <DadesPanel title="Comparativa Fora centre · Excel vs Traspass">
        {filters}
        <DadesEmpty text="Sense període per aquest mes." />
      </DadesPanel>
    );
  }

  const files: FilComparativaForaCentre[] = nomesDiff
    ? data.files.filter((f) => Math.abs(f.delta) > 0.5)
    : data.files;

  const t = data.totals;

  return (
    <DadesPanel
      title="Comparativa Fora centre · Excel vs Traspass"
      meta={`${data.periodNom} · ${estatLabel(data.estatTraspass)} · ${data.resum.filesAmbDiferencia} amb diferència · ${data.resum.centres} centres`}
    >
      {filters}

      <p className={styles.hint}>
        <strong>Excel</strong> = camp Fora centre del cost salarial restaurants.{" "}
        <strong>Traspass</strong> = suma d&apos;imports amb destí = restaurant (Sala/Cuina) de
        l&apos;execució d&apos;hores
        {data.estatTraspass === "CONFIRMAT"
          ? " (confirmat: substitueix l'Excel a la consulta)"
          : data.estatTraspass === "BORRADOR"
            ? " (esborrany: encara no substitueix)"
            : ""}
        . Δ = Traspass − Excel (≥ 0,50 € en vermell).
      </p>

      <div style={{ marginBottom: "0.75rem" }}>
        <DadesBadge>{estatLabel(data.estatTraspass)}</DadesBadge>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={`${styles.left} ${styles.stickyCentre}`}>Centre</th>
              <th className={styles.left}>Dept</th>
              <th>Excel Fora centre</th>
              <th>Traspass</th>
              <th>Δ (T − Excel)</th>
            </tr>
          </thead>
          <tbody>
            <tr className={styles.totalRow}>
              <td className={styles.stickyCentre}>
                TOTAL {data.periodNom}
                <div className={styles.muted} style={{ fontSize: "0.72rem", fontWeight: 500 }}>
                  {data.resum.filesAmbExcel} amb Excel · {data.resum.filesAmbTraspass} amb traspass
                </div>
              </td>
              <td>—</td>
              <td className={styles.right}>
                <Num v={t.excel} />
              </td>
              <td className={styles.right}>
                <Num v={t.traspass} />
              </td>
              <td className={styles.right}>
                <Num v={t.delta} emphasize />
              </td>
            </tr>

            {!files.length ? (
              <tr>
                <td colSpan={5} style={{ padding: "1rem" }}>
                  <DadesEmpty
                    text={
                      nomesDiff
                        ? "Cap fila amb diferència significativa (≥ 0,50 €)."
                        : "Sense dades de Fora centre ni traspassos amb destí restaurant."
                    }
                  />
                </td>
              </tr>
            ) : (
              files.map((f) => (
                <tr key={`${f.centreId}|${f.departament}`}>
                  <td className={`${styles.centre} ${styles.stickyCentre}`}>
                    <strong>{f.centreCodi}</strong>
                    <span className={styles.muted}> · {f.centreNom}</span>
                  </td>
                  <td>
                    <DadesBadge>{deptLabel(f.departament)}</DadesBadge>
                  </td>
                  <td className={styles.right}>
                    <Num v={f.excel} />
                  </td>
                  <td className={styles.right}>
                    <Num v={f.traspass} />
                  </td>
                  <td className={styles.right}>
                    <Num v={f.delta} emphasize />
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
