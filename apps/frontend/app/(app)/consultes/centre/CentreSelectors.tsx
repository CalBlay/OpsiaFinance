"use client";

import styles from "@/components/consultes/report.module.css";
import { etiquetaCentre, etiquetaLiniaNegoci } from "@/lib/consultes-etiquetes";
import { useRouter } from "next/navigation";

interface LnOpt {
  id: string;
  codi: string;
  nom: string;
  centres: { id: string; codi: string; nom: string }[];
}

export function CentreSelectors({
  arbre,
  anys,
  lnId,
  centreId,
  any,
  vista,
}: {
  arbre: LnOpt[];
  anys: number[];
  lnId: string | null;
  centreId: string | null;
  any: number;
  vista: "directe" | "gestio";
}) {
  const router = useRouter();
  const lnSelectId = "centre-select-ln";
  const centreSelectId = "centre-select-centre";
  const anySelectId = "centre-select-any";
  const vistaSelectId = "centre-select-vista";

  const lnSeleccionada = arbre.find((ln) => ln.id === lnId) ?? null;
  const centres = lnSeleccionada?.centres ?? [];

  const go = (
    nextLn: string | null,
    nextCentre: string | null,
    nextAny: number,
    nextVista: "directe" | "gestio"
  ) => {
    const params = new URLSearchParams();
    params.set("any", String(nextAny));
    params.set("vista", nextVista);
    if (nextLn) params.set("ln", nextLn);
    if (nextCentre) params.set("centre", nextCentre);
    router.push(`/consultes/centre?${params}`);
  };

  return (
    <div className={styles.selectors}>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={lnSelectId}>
          Línia de negoci
        </label>
        <select
          id={lnSelectId}
          className={styles.select}
          value={lnId ?? ""}
          onChange={(e) => go(e.target.value || null, null, any, vista)}
        >
          <option value="">Selecciona una línia…</option>
          {arbre.map((ln) => (
            <option key={ln.id} value={ln.id}>
              {etiquetaLiniaNegoci(ln)}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={centreSelectId}>
          Centre
        </label>
        <select
          id={centreSelectId}
          className={styles.select}
          value={centreId ?? ""}
          disabled={!lnId}
          onChange={(e) => go(lnId, e.target.value || null, any, vista)}
        >
          <option value="" disabled>
            {lnId ? "Selecciona un centre…" : "Primer tria una línia…"}
          </option>
          {centres.map((c) => (
            <option key={c.id} value={c.id}>
              {etiquetaCentre(c)}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={anySelectId}>
          Any
        </label>
        <select
          id={anySelectId}
          className={styles.select}
          style={{ minWidth: 100 }}
          value={any}
          onChange={(e) => go(lnId, centreId, Number(e.target.value), vista)}
        >
          {anys.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={vistaSelectId}>
          Vista
        </label>
        <select
          id={vistaSelectId}
          className={styles.select}
          value={vista}
          onChange={(e) =>
            go(lnId, centreId, any, e.target.value === "gestio" ? "gestio" : "directe")
          }
        >
          <option value="directe">Directe (SAP)</option>
          <option value="gestio">Gestió (tractat)</option>
        </select>
      </div>
    </div>
  );
}
