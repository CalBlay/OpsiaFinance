"use client";

import { ConsultaToolbar } from "@/components/consultes/ConsultaToolbar";
import { ConsultaVistaSelect } from "@/components/consultes/ConsultaVistaSelect";
import {
  AMBIT_OPCIONS_RESTAURANTS,
  FILTRE,
  MES_TOT_ANY,
} from "@/components/consultes/consulta-filtres";
import styles from "@/components/consultes/report.module.css";
import { etiquetaCentre } from "@/lib/consultes-etiquetes";
import type { CompteCostSalarial } from "@/lib/cost-salarial/compte";
import { MESOS_LLARGS } from "@/lib/periodes";
import { useRouter } from "next/navigation";

interface CentreOpt {
  id: string;
  codi: string;
  nom: string;
  etiqueta: string;
}

type AmbitCost = "comparativa" | "restaurant" | "sala-cuina";

export function CostSalarialSelectors({
  centres,
  anys,
  any,
  mes,
  centreId,
  ambit,
  vista,
}: {
  centres: CentreOpt[];
  anys: number[];
  any: number;
  mes: number | null;
  centreId: string | null;
  ambit: AmbitCost;
  vista: CompteCostSalarial;
}) {
  const router = useRouter();

  const go = (
    nextAny: number,
    nextMes: number | null,
    nextCentre: string | null,
    nextAmbit: AmbitCost,
    nextVista: CompteCostSalarial
  ) => {
    const params = new URLSearchParams();
    params.set("any", String(nextAny));
    params.set("vista", nextVista);
    params.set("ambit", nextAmbit);
    if (nextMes != null) params.set("mes", String(nextMes));
    if (nextCentre) params.set("centre", nextCentre);
    router.push(`/consultes/cost-salarial?${params}`);
  };

  return (
    <ConsultaToolbar
      dates={
        <>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="cost-any">
              {FILTRE.any}
            </label>
            <select
              id="cost-any"
              className={styles.select}
              style={{ minWidth: 100 }}
              value={any}
              onChange={(e) => go(Number(e.target.value), mes, centreId, ambit, vista)}
            >
              {anys.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="cost-mes">
              {FILTRE.mes}
            </label>
            <select
              id="cost-mes"
              className={styles.select}
              style={{ minWidth: 130 }}
              value={mes ?? ""}
              onChange={(e) =>
                go(any, e.target.value ? Number(e.target.value) : null, centreId, ambit, vista)
              }
            >
              <option value="">{MES_TOT_ANY}</option>
              {MESOS_LLARGS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </>
      }
      camps={
        <>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="cost-ambit">
              {FILTRE.ambit}
            </label>
            <select
              id="cost-ambit"
              className={styles.select}
              value={ambit}
              onChange={(e) => {
                const a = e.target.value as AmbitCost;
                go(any, mes, a === "comparativa" ? null : centreId, a, vista);
              }}
            >
              <option value="comparativa">{AMBIT_OPCIONS_RESTAURANTS.comparativa}</option>
              <option value="restaurant">{AMBIT_OPCIONS_RESTAURANTS.restaurant}</option>
              <option value="sala-cuina">{AMBIT_OPCIONS_RESTAURANTS.salaCuina}</option>
            </select>
          </div>
          {(ambit === "restaurant" || ambit === "sala-cuina") && (
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="cost-restaurant">
                {FILTRE.restaurant}
              </label>
              <select
                id="cost-restaurant"
                className={styles.select}
                value={centreId ?? ""}
                onChange={(e) => go(any, mes, e.target.value || null, ambit, vista)}
              >
                <option value="">Selecciona…</option>
                {centres.map((c) => (
                  <option key={c.id} value={c.id}>
                    {etiquetaCentre(c)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      }
      vista={
        <ConsultaVistaSelect
          id="cost-vista"
          value={vista}
          opcions={["directe", "gestio"]}
          onChange={(v) => go(any, mes, centreId, ambit, v)}
        />
      }
    />
  );
}
