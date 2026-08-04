"use client";

import styles from "@/components/consultes/report.module.css";
import { MESOS_LLARGS } from "@/lib/periodes";
import { useRouter } from "next/navigation";

interface CentreOpt {
  id: string;
  codi: string;
  nom: string;
  etiqueta: string;
}

export function CostSalarialSelectors({
  centres,
  anys,
  any,
  mes,
  centreId,
  vista,
}: {
  centres: CentreOpt[];
  anys: number[];
  any: number;
  mes: number | null;
  centreId: string | null;
  vista: "comparativa" | "restaurant" | "sala-cuina";
}) {
  const router = useRouter();

  const go = (
    nextAny: number,
    nextMes: number | null,
    nextCentre: string | null,
    nextVista: "comparativa" | "restaurant" | "sala-cuina"
  ) => {
    const params = new URLSearchParams();
    params.set("any", String(nextAny));
    params.set("vista", nextVista);
    if (nextMes != null) params.set("mes", String(nextMes));
    if (nextCentre) params.set("centre", nextCentre);
    router.push(`/consultes/cost-salarial?${params}`);
  };

  return (
    <div className={styles.selectors}>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="cost-vista">
          Vista
        </label>
        <select
          id="cost-vista"
          className={styles.select}
          value={vista}
          onChange={(e) => {
            const v = e.target.value as "comparativa" | "restaurant" | "sala-cuina";
            go(any, mes, v === "comparativa" ? null : centreId, v);
          }}
        >
          <option value="comparativa">Comparativa restaurants</option>
          <option value="restaurant">Detall restaurant</option>
          <option value="sala-cuina">Sala vs Cuina</option>
        </select>
      </div>

      {(vista === "restaurant" || vista === "sala-cuina") && (
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="cost-restaurant">
            Restaurant
          </label>
          <select
            id="cost-restaurant"
            className={styles.select}
            value={centreId ?? ""}
            onChange={(e) => go(any, mes, e.target.value || null, vista)}
          >
            <option value="">Tots / selecciona…</option>
            {centres.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codi} · {c.etiqueta || c.nom}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="cost-any">
          Any
        </label>
        <select
          id="cost-any"
          className={styles.select}
          style={{ minWidth: 100 }}
          value={any}
          onChange={(e) => go(Number(e.target.value), mes, centreId, vista)}
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
          Mes
        </label>
        <select
          id="cost-mes"
          className={styles.select}
          style={{ minWidth: 130 }}
          value={mes ?? ""}
          onChange={(e) => go(any, e.target.value ? Number(e.target.value) : null, centreId, vista)}
        >
          <option value="">Acumulat any</option>
          {MESOS_LLARGS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
