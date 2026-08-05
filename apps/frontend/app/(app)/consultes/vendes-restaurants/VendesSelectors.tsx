"use client";

import styles from "@/components/consultes/report.module.css";
import { etiquetaCentre } from "@/lib/consultes-etiquetes";
import { MESOS_LLARGS } from "@/lib/periodes";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

interface CentreOpt {
  id: string;
  codi: string;
  nom: string;
  etiqueta: string;
}

export function VendesSelectors({
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
  /** 0 = tot l'any */
  mes: number;
  centreId: string | null;
  vista: "comparativa" | "restaurant";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const navega = (next: {
    any?: number;
    mes?: number;
    centre?: string | null;
    vista?: "comparativa" | "restaurant";
  }) => {
    const params = new URLSearchParams();
    params.set("any", String(next.any ?? any));
    params.set("mes", String(next.mes ?? mes));
    const v = next.vista ?? vista;
    if (v === "restaurant") {
      params.set("vista", "restaurant");
      const c = next.centre !== undefined ? next.centre : centreId;
      if (c) params.set("centre", c);
    }
    // Canviar filtres torna al quadre (sense detall)
    startTransition(() => {
      router.push(`/consultes/vendes-restaurants?${params}`);
    });
  };

  return (
    <div className={styles.selectors} data-pending={pending ? "true" : undefined}>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="vendes-vista">
          Vista
        </label>
        <select
          id="vendes-vista"
          className={styles.select}
          value={vista}
          onChange={(e) => {
            const v = e.target.value as "comparativa" | "restaurant";
            if (v === "restaurant") {
              navega({ vista: "restaurant", centre: centreId ?? centres[0]?.id ?? null });
            } else {
              navega({ vista: "comparativa", centre: null });
            }
          }}
        >
          <option value="comparativa">Tota la línia (LN)</option>
          <option value="restaurant">Detall restaurant</option>
        </select>
      </div>

      {vista === "restaurant" && (
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="vendes-restaurant">
            Restaurant
          </label>
          <select
            id="vendes-restaurant"
            className={styles.select}
            value={centreId ?? ""}
            onChange={(e) => navega({ vista: "restaurant", centre: e.target.value })}
          >
            {centres.map((c) => (
              <option key={c.id} value={c.id}>
                {etiquetaCentre(c)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="vendes-any">
          Any
        </label>
        <select
          id="vendes-any"
          className={styles.select}
          value={any}
          onChange={(e) => navega({ any: Number(e.target.value) })}
        >
          {anys.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="vendes-periode">
          Període
        </label>
        <select
          id="vendes-periode"
          className={styles.select}
          value={mes}
          onChange={(e) => navega({ mes: Number(e.target.value) })}
        >
          <option value={0}>Tot l&apos;any</option>
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
