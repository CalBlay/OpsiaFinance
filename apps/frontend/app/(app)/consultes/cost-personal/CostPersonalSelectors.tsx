"use client";

import styles from "@/components/consultes/report.module.css";
import { etiquetaCentre, etiquetaLiniaNegoci } from "@/lib/consultes-etiquetes";
import { MESOS_LLARGS } from "@/lib/periodes";
import { useRouter } from "next/navigation";

interface LnOpt {
  id: string;
  codi: string;
  nom: string;
  centres: { id: string; codi: string; nom: string }[];
}

export function CostPersonalSelectors({
  arbre,
  anys,
  lnId,
  centreId,
  any,
  mes,
  vista,
}: {
  arbre: LnOpt[];
  anys: number[];
  lnId: string | null;
  centreId: string | null;
  any: number;
  mes: number | null;
  vista: "directe" | "gestio";
}) {
  const router = useRouter();
  const lnSeleccionada = arbre.find((ln) => ln.id === lnId) ?? null;
  const centres = lnSeleccionada?.centres ?? [];

  const go = (
    nextLn: string | null,
    nextCentre: string | null,
    nextAny: number,
    nextMes: number | null,
    nextVista: "directe" | "gestio"
  ) => {
    const params = new URLSearchParams();
    params.set("any", String(nextAny));
    params.set("vista", nextVista);
    if (nextMes != null) params.set("mes", String(nextMes));
    if (nextLn) params.set("ln", nextLn);
    if (nextCentre) params.set("centre", nextCentre);
    router.push(`/consultes/cost-personal?${params}`);
  };

  return (
    <div className={styles.selectors}>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="cp-ln">
          Línia de negoci
        </label>
        <select
          id="cp-ln"
          className={styles.select}
          value={lnId ?? ""}
          onChange={(e) => go(e.target.value || null, null, any, mes, vista)}
        >
          <option value="">Totes les línies</option>
          {arbre.map((ln) => (
            <option key={ln.id} value={ln.id}>
              {etiquetaLiniaNegoci(ln)}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="cp-centre">
          Centre
        </label>
        <select
          id="cp-centre"
          className={styles.select}
          value={centreId ?? ""}
          disabled={!lnId}
          onChange={(e) => go(lnId, e.target.value || null, any, mes, vista)}
        >
          <option value="">
            {lnId ? "Tots els centres de la línia" : "Primer tria una línia…"}
          </option>
          {centres.map((c) => (
            <option key={c.id} value={c.id}>
              {etiquetaCentre(c)}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="cp-any">
          Any
        </label>
        <select
          id="cp-any"
          className={styles.select}
          style={{ minWidth: 100 }}
          value={any}
          onChange={(e) => go(lnId, centreId, Number(e.target.value), mes, vista)}
        >
          {anys.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="cp-mes">
          Mes
        </label>
        <select
          id="cp-mes"
          className={styles.select}
          style={{ minWidth: 130 }}
          value={mes ?? ""}
          onChange={(e) =>
            go(lnId, centreId, any, e.target.value ? Number(e.target.value) : null, vista)
          }
        >
          <option value="">Tot l&apos;any</option>
          {MESOS_LLARGS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="cp-vista">
          Vista
        </label>
        <select
          id="cp-vista"
          className={styles.select}
          value={vista}
          onChange={(e) =>
            go(lnId, centreId, any, mes, e.target.value === "gestio" ? "gestio" : "directe")
          }
        >
          <option value="directe">Directe (SAP)</option>
          <option value="gestio">Gestió (tractat)</option>
        </select>
      </div>
    </div>
  );
}
