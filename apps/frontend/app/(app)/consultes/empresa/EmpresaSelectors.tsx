"use client";

import styles from "@/components/consultes/report.module.css";
import type { VistaCompte } from "@/lib/consultes";
import { GRUP_EMPRESA_LABELS, type GrupEmpresa } from "@/lib/grups-empresa";
import { MESOS_LLARGS } from "@/lib/periodes";
import { useRouter } from "next/navigation";

export function EmpresaSelectors({
  anys,
  any,
  mes,
  vista,
  grup,
}: {
  anys: number[];
  any: number;
  mes: number | null;
  vista: VistaCompte;
  grup: GrupEmpresa;
}) {
  const router = useRouter();
  const go = (
    nextAny: number,
    nextMes: number | null,
    nextVista: VistaCompte,
    nextGrup: GrupEmpresa
  ) => {
    const mesPart = nextMes ? `&mes=${nextMes}` : "";
    const vistaEfectiva = nextGrup === "fdlc" ? "directe" : nextVista;
    router.push(
      `/consultes/empresa?grup=${nextGrup}&any=${nextAny}${mesPart}&vista=${vistaEfectiva}`
    );
  };

  return (
    <div className={styles.selectors}>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Empresa</label>
        <select
          className={styles.select}
          style={{ minWidth: 120 }}
          value={grup}
          onChange={(e) => go(any, mes, vista, e.target.value as GrupEmpresa)}
        >
          {(Object.entries(GRUP_EMPRESA_LABELS) as [GrupEmpresa, string][]).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Any</label>
        <select
          className={styles.select}
          style={{ minWidth: 100 }}
          value={any}
          onChange={(e) => go(Number(e.target.value), mes, vista, grup)}
        >
          {anys.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>{grup === "fdlc" ? "Vista" : "Període"}</label>
        <select
          className={styles.select}
          style={{ minWidth: 140 }}
          value={mes ?? ""}
          onChange={(e) => go(any, e.target.value ? Number(e.target.value) : null, vista, grup)}
        >
          <option value="">{grup === "fdlc" ? "General (acumulat)" : "Acumulat anual"}</option>
          {MESOS_LLARGS.map((m, i) => (
            <option key={i} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </div>
      {grup === "calblay" && (
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Vista</label>
          <select
            className={styles.select}
            style={{ minWidth: 160 }}
            value={vista}
            onChange={(e) => go(any, mes, e.target.value as VistaCompte, grup)}
          >
            <option value="directe">Directe</option>
            <option value="gestio">Gestió</option>
          </select>
        </div>
      )}
    </div>
  );
}
