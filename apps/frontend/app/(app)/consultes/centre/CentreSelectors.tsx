"use client";

import { ConsultaToolbar } from "@/components/consultes/ConsultaToolbar";
import { ConsultaVistaSelect } from "@/components/consultes/ConsultaVistaSelect";
import { FILTRE } from "@/components/consultes/consulta-filtres";
import styles from "@/components/consultes/report.module.css";
import { etiquetaCentre, etiquetaLiniaNegoci } from "@/lib/consultes-etiquetes";
import type { VistaCompte } from "@/lib/vista-compte";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

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
  vistesCarregades,
  onVistaLocal,
}: {
  arbre: LnOpt[];
  anys: number[];
  lnId: string | null;
  centreId: string | null;
  any: number;
  vista: VistaCompte;
  vistesCarregades?: VistaCompte[];
  onVistaLocal?: (vista: VistaCompte) => boolean | undefined;
}) {
  const router = useRouter();
  const lnSelectId = "centre-select-ln";
  const centreSelectId = "centre-select-centre";
  const anySelectId = "centre-select-any";
  const vistaSelectId = "centre-select-vista";

  const lnSeleccionada = arbre.find((ln) => ln.id === lnId) ?? null;
  const centres = lnSeleccionada?.centres ?? [];

  useEffect(() => {
    if (!lnId || !centreId || onVistaLocal) return;
    for (const other of ["sap", "directe", "traspassos", "gestio"] as VistaCompte[]) {
      if (other === vista) continue;
      const params = new URLSearchParams();
      params.set("any", String(any));
      params.set("vista", other);
      params.set("ln", lnId);
      params.set("centre", centreId);
      router.prefetch(`/consultes/centre?${params}`);
    }
  }, [router, lnId, centreId, any, vista, onVistaLocal]);

  const go = (
    nextLn: string | null,
    nextCentre: string | null,
    nextAny: number,
    nextVista: VistaCompte
  ) => {
    const params = new URLSearchParams();
    params.set("any", String(nextAny));
    if (nextVista !== "directe") params.set("vista", nextVista);
    if (nextLn) params.set("ln", nextLn);
    if (nextCentre) params.set("centre", nextCentre);
    router.push(`/consultes/centre?${params}`);
  };

  const goVista = (nextVista: VistaCompte) => {
    if (vistesCarregades?.includes(nextVista) && onVistaLocal) {
      const ok = onVistaLocal(nextVista);
      if (ok !== false) return;
    }
    go(lnId, centreId, any, nextVista);
  };

  return (
    <ConsultaToolbar
      dates={
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={anySelectId}>
            {FILTRE.any}
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
      }
      camps={
        <>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={lnSelectId}>
              {FILTRE.linia}
            </label>
            <select
              id={lnSelectId}
              className={styles.select}
              value={lnId ?? ""}
              onChange={(e) => go(e.target.value || null, null, any, vista)}
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
            <label className={styles.fieldLabel} htmlFor={centreSelectId}>
              {FILTRE.centre}
            </label>
            <select
              id={centreSelectId}
              className={styles.select}
              value={centreId ?? ""}
              disabled={!lnId}
              onChange={(e) => go(lnId, e.target.value || null, any, vista)}
            >
              <option value="">{lnId ? "Tots (resum costos)" : "Tria línia…"}</option>
              {centres.map((c) => (
                <option key={c.id} value={c.id}>
                  {etiquetaCentre(c)}
                </option>
              ))}
            </select>
          </div>
        </>
      }
      vista={<ConsultaVistaSelect id={vistaSelectId} value={vista} onChange={goVista} />}
    />
  );
}
