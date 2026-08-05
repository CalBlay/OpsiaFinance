"use client";

import { PeriodRangSelectors } from "@/components/consultes/PeriodRangSelectors";
import styles from "@/components/consultes/report.module.css";
import type { VistaCompte } from "@/lib/consultes";
import { etiquetaLiniaNegoci } from "@/lib/consultes-etiquetes";
import { type RangMesos, rangToQuery } from "@/lib/periodes";
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
    <div
      className={styles.selectors}
      data-pending={isPending ? "true" : undefined}
      aria-busy={isPending}
    >
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={lineSelectId}>
          Línia de negoci
        </label>
        <select
          id={lineSelectId}
          className={styles.select}
          value={localLn}
          disabled={isPending}
          onChange={(e) => go(e.target.value, localAny, localRang, localVista)}
        >
          <option value="" disabled>
            Selecciona una línia…
          </option>
          {linies.map((ln) => (
            <option key={ln.id} value={ln.id}>
              {etiquetaLiniaNegoci(ln)}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={yearSelectId}>
          Any
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

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={viewSelectId}>
          Vista
        </label>
        <select
          id={viewSelectId}
          className={styles.select}
          style={{ minWidth: 160 }}
          value={localVista}
          disabled={isPending}
          onChange={(e) => go(localLn, localAny, localRang, e.target.value as VistaCompte)}
        >
          <option value="directe">Directe (SAP)</option>
          <option value="gestio">Gestió (tractat)</option>
        </select>
        {isPending && <span className={styles.filterPending}>Actualitzant…</span>}
      </div>
    </div>
  );
}
