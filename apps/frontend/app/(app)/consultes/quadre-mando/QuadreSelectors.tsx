"use client";

import { ConsultaToolbar } from "@/components/consultes/ConsultaToolbar";
import { ConsultaVistaSelect } from "@/components/consultes/ConsultaVistaSelect";
import { FILTRE, MES_TOT_ANY } from "@/components/consultes/consulta-filtres";
import styles from "@/components/consultes/report.module.css";
import type { CompteCostSalarial } from "@/lib/cost-salarial/compte";
import { MESOS_LLARGS } from "@/lib/periodes";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function QuadreSelectors({
  anys,
  any,
  mes,
  vista,
}: {
  anys: number[];
  any: number;
  /** 0 = tot l'any */
  mes: number;
  vista: CompteCostSalarial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const navega = (nextAny: number, nextMes: number, nextVista: CompteCostSalarial) => {
    const params = new URLSearchParams();
    params.set("any", String(nextAny));
    params.set("mes", String(nextMes));
    params.set("vista", nextVista);
    startTransition(() => {
      router.push(`/consultes/quadre-mando?${params}`);
    });
  };

  return (
    <ConsultaToolbar
      pending={pending}
      dates={
        <>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="quadre-any">
              {FILTRE.any}
            </label>
            <select
              id="quadre-any"
              className={styles.select}
              value={any}
              onChange={(e) => navega(Number(e.target.value), mes, vista)}
            >
              {anys.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="quadre-mes">
              {FILTRE.mes}
            </label>
            <select
              id="quadre-mes"
              className={styles.select}
              value={mes}
              onChange={(e) => navega(any, Number(e.target.value), vista)}
            >
              <option value={0}>{MES_TOT_ANY}</option>
              {MESOS_LLARGS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </>
      }
      vista={
        <ConsultaVistaSelect
          id="quadre-vista"
          value={vista}
          opcions={["sap", "directe", "traspassos", "gestio"]}
          onChange={(v) => navega(any, mes, v)}
        />
      }
    />
  );
}
