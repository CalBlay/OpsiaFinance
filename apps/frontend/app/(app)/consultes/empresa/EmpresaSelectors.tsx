"use client";

import { PeriodRangSelectors } from "@/components/consultes/PeriodRangSelectors";
import styles from "@/components/consultes/report.module.css";
import type { VistaCompte } from "@/lib/consultes";
import { GRUP_EMPRESA_LABELS, type GrupEmpresa } from "@/lib/grups-empresa";
import { type RangMesos, rangToQuery } from "@/lib/periodes";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export function EmpresaSelectors({
  anys,
  any,
  rang,
  vista,
  grup,
}: {
  anys: number[];
  any: number;
  rang: RangMesos;
  vista: VistaCompte;
  grup: GrupEmpresa;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const groupSelectId = "empresa-group";
  const yearSelectId = "empresa-year";
  const viewSelectId = "empresa-view";

  // Estat local: el select no torna enrere mentre la pàgina recarrega
  const [localGrup, setLocalGrup] = useState(grup);
  const [localAny, setLocalAny] = useState(any);
  const [localRang, setLocalRang] = useState(rang);
  const [localVista, setLocalVista] = useState(vista);

  useEffect(() => {
    setLocalGrup(grup);
    setLocalAny(any);
    setLocalRang(rang);
    setLocalVista(vista);
  }, [grup, any, rang, vista]);

  const go = (
    nextAny: number,
    nextRang: RangMesos,
    nextVista: VistaCompte,
    nextGrup: GrupEmpresa
  ) => {
    const vistaEfectiva = nextGrup === "fdlc" ? "directe" : nextVista;
    setLocalAny(nextAny);
    setLocalRang(nextRang);
    setLocalVista(vistaEfectiva);
    setLocalGrup(nextGrup);
    startTransition(() => {
      router.replace(
        `/consultes/empresa?grup=${nextGrup}&any=${nextAny}${rangToQuery(nextRang)}&vista=${vistaEfectiva}`,
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
        <label className={styles.fieldLabel} htmlFor={groupSelectId}>
          Empresa
        </label>
        <select
          id={groupSelectId}
          className={styles.select}
          style={{ minWidth: 120 }}
          value={localGrup}
          disabled={isPending}
          onChange={(e) => go(localAny, localRang, localVista, e.target.value as GrupEmpresa)}
        >
          {(Object.entries(GRUP_EMPRESA_LABELS) as [GrupEmpresa, string][]).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
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
          onChange={(e) => go(Number(e.target.value), localRang, localVista, localGrup)}
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
        onChange={(next) => go(localAny, next, localVista, localGrup)}
      />
      {localGrup === "calblay" && (
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
            onChange={(e) => go(localAny, localRang, e.target.value as VistaCompte, localGrup)}
          >
            <option value="directe">Directe</option>
            <option value="gestio">Gestió</option>
          </select>
          {isPending && <span className={styles.filterPending}>Actualitzant…</span>}
        </div>
      )}
    </div>
  );
}
