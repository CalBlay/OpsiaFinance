"use client";

import { ConsultaToolbar } from "@/components/consultes/ConsultaToolbar";
import { ConsultaVistaSelect } from "@/components/consultes/ConsultaVistaSelect";
import { PeriodRangSelectors } from "@/components/consultes/PeriodRangSelectors";
import { FILTRE } from "@/components/consultes/consulta-filtres";
import styles from "@/components/consultes/report.module.css";
import { type GrupEmpresa, grupPermetVistaGestio } from "@/lib/grups-empresa";
import { type RangMesos, rangToQuery } from "@/lib/periodes";
import {
  VISTA_COMPTE_CADENA,
  VISTA_COMPTE_SENSE_GESTIO,
  type VistaCompte,
  parseVistaCompte,
} from "@/lib/vista-compte";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export function EmpresaSelectors({
  anys,
  any,
  rang,
  vista,
  grup,
  vistesCarregades,
  onVistaLocal,
}: {
  anys: number[];
  any: number;
  rang: RangMesos;
  vista: VistaCompte;
  grup: GrupEmpresa;
  vistesCarregades?: VistaCompte[];
  onVistaLocal?: (vista: VistaCompte) => boolean | undefined;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const yearSelectId = "empresa-year";
  const viewSelectId = "empresa-view";
  const mostraCapesGestio = grupPermetVistaGestio(grup);
  const opcions = mostraCapesGestio ? VISTA_COMPTE_CADENA : VISTA_COMPTE_SENSE_GESTIO;

  const [localAny, setLocalAny] = useState(any);
  const [localRang, setLocalRang] = useState(rang);
  const [localVista, setLocalVista] = useState(vista);

  useEffect(() => {
    setLocalAny(any);
    setLocalRang(rang);
    setLocalVista(vista);
  }, [any, rang, vista]);

  const goServer = (nextAny: number, nextRang: RangMesos, nextVista: VistaCompte) => {
    const vistaEfectiva = parseVistaCompte(nextVista, { permetCapesGestio: mostraCapesGestio });
    setLocalAny(nextAny);
    setLocalRang(nextRang);
    setLocalVista(vistaEfectiva);
    startTransition(() => {
      const q =
        vistaEfectiva === "directe"
          ? `/consultes/empresa?any=${nextAny}${rangToQuery(nextRang)}`
          : `/consultes/empresa?any=${nextAny}${rangToQuery(nextRang)}&vista=${vistaEfectiva}`;
      router.replace(q, { scroll: false });
    });
  };

  const goVista = (nextVista: VistaCompte) => {
    const vistaEfectiva = parseVistaCompte(nextVista, { permetCapesGestio: mostraCapesGestio });
    setLocalVista(vistaEfectiva);
    if (vistesCarregades?.includes(vistaEfectiva) && onVistaLocal) {
      const ok = onVistaLocal(vistaEfectiva);
      if (ok !== false) return;
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
        <ConsultaVistaSelect
          id={viewSelectId}
          value={localVista}
          opcions={opcions}
          disabled={isPending && !onVistaLocal}
          pendingHint={isPending && !onVistaLocal}
          onChange={goVista}
        />
      }
    />
  );
}
