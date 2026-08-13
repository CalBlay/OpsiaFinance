"use client";

import { ConsultaToolbar } from "@/components/consultes/ConsultaToolbar";
import { ConsultaVistaSelect } from "@/components/consultes/ConsultaVistaSelect";
import { FILTRE, MES_TOT_ANY } from "@/components/consultes/consulta-filtres";
import styles from "@/components/consultes/report.module.css";
import { etiquetaCentre, etiquetaLiniaNegoci } from "@/lib/consultes-etiquetes";
import { MESOS_LLARGS } from "@/lib/periodes";
import { VISTA_COMPTE_BINARIA } from "@/lib/vista-compte";
import { useRouter } from "next/navigation";

type VistaCostPersonal = (typeof VISTA_COMPTE_BINARIA)[number];

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
  vista: VistaCostPersonal;
}) {
  const router = useRouter();
  const lnSeleccionada = arbre.find((ln) => ln.id === lnId) ?? null;
  const centres = lnSeleccionada?.centres ?? [];

  const go = (
    nextLn: string | null,
    nextCentre: string | null,
    nextAny: number,
    nextMes: number | null,
    nextVista: VistaCostPersonal
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
    <ConsultaToolbar
      dates={
        <>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="cp-any">
              {FILTRE.any}
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
              {FILTRE.mes}
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
            <label className={styles.fieldLabel} htmlFor="cp-ln">
              {FILTRE.linia}
            </label>
            <select
              id="cp-ln"
              className={styles.select}
              value={lnId ?? ""}
              onChange={(e) => go(e.target.value || null, null, any, mes, vista)}
            >
              <option value="">Totes</option>
              {arbre.map((ln) => (
                <option key={ln.id} value={ln.id}>
                  {etiquetaLiniaNegoci(ln)}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="cp-centre">
              {FILTRE.centre}
            </label>
            <select
              id="cp-centre"
              className={styles.select}
              value={centreId ?? ""}
              disabled={!lnId}
              onChange={(e) => go(lnId, e.target.value || null, any, mes, vista)}
            >
              <option value="">{lnId ? "Tots" : "Tria línia…"}</option>
              {centres.map((c) => (
                <option key={c.id} value={c.id}>
                  {etiquetaCentre(c)}
                </option>
              ))}
            </select>
          </div>
        </>
      }
      vista={
        <ConsultaVistaSelect
          id="cp-vista"
          value={vista}
          opcions={VISTA_COMPTE_BINARIA}
          onChange={(v) => go(lnId, centreId, any, mes, v)}
        />
      }
    />
  );
}
