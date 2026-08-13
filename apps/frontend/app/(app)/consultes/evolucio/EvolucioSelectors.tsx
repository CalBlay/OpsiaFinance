"use client";

import { ConsultaToolbar } from "@/components/consultes/ConsultaToolbar";
import { ConsultaVistaSelect } from "@/components/consultes/ConsultaVistaSelect";
import { FILTRE } from "@/components/consultes/consulta-filtres";
import styles from "@/components/consultes/report.module.css";
import { etiquetaLiniaNegoci } from "@/lib/consultes-etiquetes";
import {
  VISTA_COMPTE_CADENA,
  VISTA_COMPTE_SENSE_GESTIO,
  type VistaCompte,
} from "@/lib/vista-compte";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

interface LnOpt {
  id: string;
  codi: string;
  nom: string;
}

export function EvolucioSelectors({
  linies,
  anys,
  scope,
  lnId,
  any,
  vista,
  nomesEmpresa = false,
  mostraVistaGestio = true,
  onVistaLocal,
}: {
  linies: LnOpt[];
  anys: number[];
  scope: "empresa" | "linia";
  lnId: string | null;
  any: number;
  vista: VistaCompte;
  nomesEmpresa?: boolean;
  mostraVistaGestio?: boolean;
  onVistaLocal?: (vista: VistaCompte) => boolean | undefined;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const scopeSelectId = "evolucio-scope";
  const lineSelectId = "evolucio-line";
  const yearSelectId = "evolucio-year";
  const viewSelectId = "evolucio-view";

  const [localScope, setLocalScope] = useState(scope);
  const [localLn, setLocalLn] = useState(lnId ?? "");
  const [localAny, setLocalAny] = useState(any);
  const [localVista, setLocalVista] = useState(vista);

  useEffect(() => {
    setLocalScope(scope);
    setLocalLn(lnId ?? "");
    setLocalAny(any);
    setLocalVista(vista);
  }, [scope, lnId, any, vista]);

  const goServer = (nextScope: string, nextLn: string, nextAny: number, nextVista: VistaCompte) => {
    setLocalScope(nextScope as "empresa" | "linia");
    setLocalLn(nextLn);
    setLocalAny(nextAny);
    setLocalVista(nextVista);

    const vistaQ = nextVista === "directe" ? "" : `&vista=${nextVista}`;
    if (nextScope === "linia" && !nextLn) {
      startTransition(() => {
        router.replace(`/consultes/evolucio?scope=linia&any=${nextAny}${vistaQ}`, {
          scroll: false,
        });
      });
      return;
    }
    const lnPart = nextScope === "linia" ? `&ln=${nextLn}` : "";
    startTransition(() => {
      router.replace(`/consultes/evolucio?scope=${nextScope}${lnPart}&any=${nextAny}${vistaQ}`, {
        scroll: false,
      });
    });
  };

  const goVista = (nextVista: VistaCompte) => {
    setLocalVista(nextVista);
    if (onVistaLocal) {
      const ok = onVistaLocal(nextVista);
      if (ok !== false) return;
    }
    goServer(localScope, localLn, localAny, nextVista);
  };

  return (
    <ConsultaToolbar
      pending={isPending}
      dates={
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
            onChange={(e) => goServer(localScope, localLn, Number(e.target.value), localVista)}
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
        !nomesEmpresa ? (
          <>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={scopeSelectId}>
                {FILTRE.ambit}
              </label>
              <select
                id={scopeSelectId}
                className={styles.select}
                value={localScope}
                disabled={isPending}
                onChange={(e) => goServer(e.target.value, localLn, localAny, localVista)}
              >
                <option value="empresa">Empresa</option>
                <option value="linia">Línia</option>
              </select>
            </div>
            {localScope === "linia" ? (
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor={lineSelectId}>
                  {FILTRE.linia}
                </label>
                <select
                  id={lineSelectId}
                  className={styles.select}
                  value={localLn}
                  disabled={isPending}
                  onChange={(e) => goServer("linia", e.target.value, localAny, localVista)}
                >
                  <option value="">Selecciona…</option>
                  {linies.map((ln) => (
                    <option key={ln.id} value={ln.id}>
                      {etiquetaLiniaNegoci(ln)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </>
        ) : null
      }
      vista={
        <ConsultaVistaSelect
          id={viewSelectId}
          value={localVista}
          opcions={mostraVistaGestio ? VISTA_COMPTE_CADENA : VISTA_COMPTE_SENSE_GESTIO}
          disabled={isPending && !onVistaLocal}
          pendingHint={isPending && !onVistaLocal}
          onChange={goVista}
        />
      }
    />
  );
}
