"use client";

import { ConsultaToolbar } from "@/components/consultes/ConsultaToolbar";
import { ConsultaVistaSelect } from "@/components/consultes/ConsultaVistaSelect";
import { PeriodRangSelectors } from "@/components/consultes/PeriodRangSelectors";
import { FILTRE } from "@/components/consultes/consulta-filtres";
import styles from "@/components/consultes/report.module.css";
import { etiquetaLiniaNegoci } from "@/lib/consultes-etiquetes";
import { type RangMesos, rangToQuery } from "@/lib/periodes";
import type { VistaCompte } from "@/lib/vista-compte";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

interface LnOpt {
  id: string;
  codi: string;
  nom: string;
}

export function LiniaSelectors({
  linies,
  anys,
  lnId,
  any,
  rang,
  vista,
}: {
  linies: LnOpt[];
  anys: number[];
  lnId: string | null;
  any: number;
  rang: RangMesos;
  vista: VistaCompte;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const lineSelectId = "linia-line";
  const yearSelectId = "linia-year";
  const viewSelectId = "linia-view";

  const [localLn, setLocalLn] = useState(lnId ?? "");
  const [localAny, setLocalAny] = useState(any);
  const [localRang, setLocalRang] = useState(rang);
  const [localVista, setLocalVista] = useState(vista);

  useEffect(() => {
    setLocalLn(lnId ?? "");
    setLocalAny(any);
    setLocalRang(rang);
    setLocalVista(vista);
  }, [lnId, any, rang, vista]);

  useEffect(() => {
    if (!lnId) return;
    const other: VistaCompte = vista === "gestio" ? "directe" : "gestio";
    router.prefetch(`/consultes/linia?ln=${lnId}&any=${any}${rangToQuery(rang)}&vista=${other}`);
  }, [router, lnId, any, rang, vista]);

  const go = (nextLn: string, nextAny: number, nextRang: RangMesos, nextVista: VistaCompte) => {
    if (!nextLn) return;
    setLocalLn(nextLn);
    setLocalAny(nextAny);
    setLocalRang(nextRang);
    setLocalVista(nextVista);
    startTransition(() => {
      router.replace(
        `/consultes/linia?ln=${nextLn}&any=${nextAny}${rangToQuery(nextRang)}&vista=${nextVista}`,
        { scroll: false }
      );
    });
  };

  return (
    <ConsultaToolbar
      pending={isPending}
      dates={
        <>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={yearSelectId}>
              {FILTRE.any}
            </label>
            <select
              id={yearSelectId}
              className={styles.select}
              style={{ minWidth: 100 }}
              value={localAny}
              disabled={isPending}
              onChange={(e) => go(localLn, Number(e.target.value), localRang, localVista)}
            >
              {anys.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <PeriodRangSelectors
            rang={localRang}
            anyActual={localAny}
            disabled={isPending}
            onChange={(next) => go(localLn, localAny, next, localVista)}
          />
        </>
      }
      camps={
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={lineSelectId}>
            {FILTRE.linia}
          </label>
          <select
            id={lineSelectId}
            className={styles.select}
            value={localLn}
            disabled={isPending}
            onChange={(e) => go(e.target.value, localAny, localRang, localVista)}
          >
            <option value="" disabled>
              Selecciona…
            </option>
            {linies.map((ln) => (
              <option key={ln.id} value={ln.id}>
                {etiquetaLiniaNegoci(ln)}
              </option>
            ))}
          </select>
        </div>
      }
      vista={
        <ConsultaVistaSelect
          id={viewSelectId}
          value={localVista}
          disabled={isPending}
          pendingHint={isPending}
          onChange={(v) => go(localLn, localAny, localRang, v)}
        />
      }
    />
  );
}
