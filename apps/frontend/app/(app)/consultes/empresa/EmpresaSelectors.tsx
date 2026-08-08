"use client";

import { ConsultaToolbar } from "@/components/consultes/ConsultaToolbar";
import { ConsultaVistaSelect } from "@/components/consultes/ConsultaVistaSelect";
import { PeriodRangSelectors } from "@/components/consultes/PeriodRangSelectors";
import { FILTRE } from "@/components/consultes/consulta-filtres";
import styles from "@/components/consultes/report.module.css";
import { type GrupEmpresa, grupPermetVistaGestio } from "@/lib/grups-empresa";
import { type RangMesos, rangToQuery } from "@/lib/periodes";
import type { VistaCompte } from "@/lib/vista-compte";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export function EmpresaSelectors({
  anys,
  any,
  rang,
  vista,
  grup,
  onVistaLocal,
}: {
  anys: number[];
  any: number;
  rang: RangMesos;
  vista: VistaCompte;
  grup: GrupEmpresa;
  onVistaLocal?: (vista: VistaCompte) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const yearSelectId = "empresa-year";
  const viewSelectId = "empresa-view";
  const mostraVistaGestio = grupPermetVistaGestio(grup);

  const [localAny, setLocalAny] = useState(any);
  const [localRang, setLocalRang] = useState(rang);
  const [localVista, setLocalVista] = useState(vista);

  useEffect(() => {
    setLocalAny(any);
    setLocalRang(rang);
    setLocalVista(vista);
  }, [any, rang, vista]);

  const goServer = (nextAny: number, nextRang: RangMesos, nextVista: VistaCompte) => {
    const vistaEfectiva = mostraVistaGestio ? nextVista : "directe";
    setLocalAny(nextAny);
    setLocalRang(nextRang);
    setLocalVista(vistaEfectiva);
    startTransition(() => {
      router.replace(
        `/consultes/empresa?any=${nextAny}${rangToQuery(nextRang)}&vista=${vistaEfectiva}`,
        { scroll: false }
      );
    });
  };

  const goVista = (nextVista: VistaCompte) => {
    const vistaEfectiva = mostraVistaGestio ? nextVista : "directe";
    setLocalVista(vistaEfectiva);
    if (onVistaLocal) {
      onVistaLocal(vistaEfectiva);
      return;
    }
    goServer(localAny, localRang, vistaEfectiva);
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
              onChange={(e) => goServer(Number(e.target.value), localRang, localVista)}
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
            onChange={(next) => goServer(localAny, next, localVista)}
          />
        </>
      }
      vista={
        mostraVistaGestio ? (
          <ConsultaVistaSelect
            id={viewSelectId}
            value={localVista}
            disabled={isPending && !onVistaLocal}
            pendingHint={isPending && !onVistaLocal}
            onChange={goVista}
          />
        ) : null
      }
    />
  );
}
