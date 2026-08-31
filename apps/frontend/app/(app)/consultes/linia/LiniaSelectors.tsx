"use client";

import { ConsultaToolbar } from "@/components/consultes/ConsultaToolbar";
import { ConsultaVistaSelect } from "@/components/consultes/ConsultaVistaSelect";
import { PeriodRangSelectors } from "@/components/consultes/PeriodRangSelectors";
import { FILTRE } from "@/components/consultes/consulta-filtres";
import styles from "@/components/consultes/report.module.css";
import { etiquetaLiniaNegoci } from "@/lib/consultes-etiquetes";
import { type RangMesos, rangToQuery } from "@/lib/periodes";
import {
  VISTA_COMPTE_CADENA,
  VISTA_COMPTE_SENSE_GESTIO,
  type VistaCompte,
  parseVistaCompte,
} from "@/lib/vista-compte";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

interface LnOpt {
  id: string;
  codi: string;
  nom: string;
}

function hrefLinia(ln: string, any: number, rang: RangMesos, vista: VistaCompte): string {
  const qs = new URLSearchParams();
  if (ln) qs.set("ln", ln);
  qs.set("any", String(any));
  if (vista !== "directe") qs.set("vista", vista);
  const rangQ = rangToQuery(rang);
  return `/consultes/linia?${qs.toString()}${rangQ}`;
}

export function LiniaSelectors({
  linies,
  anys,
  lnId,
  any,
  rang,
  vista,
  vistesCarregades,
  onVistaLocal,
  mostraCapesGestio = true,
}: {
  linies: LnOpt[];
  anys: number[];
  lnId: string | null;
  any: number;
  rang: RangMesos;
  vista: VistaCompte;
  vistesCarregades?: VistaCompte[];
  onVistaLocal?: (vista: VistaCompte) => boolean | undefined;
  mostraCapesGestio?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const lineSelectId = "linia-line";
  const yearSelectId = "linia-year";
  const viewSelectId = "linia-view";
  const opcions = mostraCapesGestio ? VISTA_COMPTE_CADENA : VISTA_COMPTE_SENSE_GESTIO;

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
    for (const other of opcions) {
      if (other === vista) continue;
      router.prefetch(hrefLinia(lnId, any, rang, other));
    }
  }, [router, lnId, any, rang, vista, opcions]);

  const goServer = (
    nextLn: string,
    nextAny: number,
    nextRang: RangMesos,
    nextVista: VistaCompte
  ) => {
    const vistaEfectiva = parseVistaCompte(nextVista, { permetCapesGestio: mostraCapesGestio });
    setLocalLn(nextLn);
    setLocalAny(nextAny);
    setLocalRang(nextRang);
    setLocalVista(vistaEfectiva);
    startTransition(() => {
      router.replace(hrefLinia(nextLn, nextAny, nextRang, vistaEfectiva), { scroll: false });
    });
  };

  const goVista = (nextVista: VistaCompte) => {
    const vistaEfectiva = parseVistaCompte(nextVista, { permetCapesGestio: mostraCapesGestio });
    setLocalVista(vistaEfectiva);
    if (vistesCarregades?.includes(vistaEfectiva) && onVistaLocal) {
      const ok = onVistaLocal(vistaEfectiva);
      if (ok !== false) return;
    }
    goServer(localLn, localAny, localRang, vistaEfectiva);
  };

  const vistaPending = isPending && !onVistaLocal;

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
              onChange={(e) => goServer(localLn, Number(e.target.value), localRang, localVista)}
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
            onChange={(next) => goServer(localLn, localAny, next, localVista)}
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
            onChange={(e) => goServer(e.target.value, localAny, localRang, localVista)}
          >
            <option value="">Totes (resum)</option>
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
          opcions={opcions}
          disabled={vistaPending}
          pendingHint={vistaPending}
          onChange={goVista}
        />
      }
    />
  );
}
