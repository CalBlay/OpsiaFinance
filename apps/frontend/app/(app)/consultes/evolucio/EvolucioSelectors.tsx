"use client";

import styles from "@/components/consultes/report.module.css";
import type { VistaCompte } from "@/lib/consultes";
import { etiquetaLiniaNegoci } from "@/lib/consultes-etiquetes";
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
}: {
  linies: LnOpt[];
  anys: number[];
  scope: "empresa" | "linia";
  lnId: string | null;
  any: number;
  vista: VistaCompte;
  /** FDLC: només àmbit empresa. */
  nomesEmpresa?: boolean;
  mostraVistaGestio?: boolean;
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

  const go = (nextScope: string, nextLn: string, nextAny: number, nextVista: VistaCompte) => {
    setLocalScope(nextScope as "empresa" | "linia");
    setLocalLn(nextLn);
    setLocalAny(nextAny);
    setLocalVista(nextVista);

    if (nextScope === "linia" && !nextLn) {
      startTransition(() => {
        router.replace(`/consultes/evolucio?scope=linia&any=${nextAny}&vista=${nextVista}`, {
          scroll: false,
        });
      });
      return;
    }
    const lnPart = nextScope === "linia" ? `&ln=${nextLn}` : "";
    startTransition(() => {
      router.replace(
        `/consultes/evolucio?scope=${nextScope}${lnPart}&any=${nextAny}&vista=${nextVista}`,
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
      {!nomesEmpresa && (
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={scopeSelectId}>
            Àmbit
          </label>
          <select
            id={scopeSelectId}
            className={styles.select}
            value={localScope}
            disabled={isPending}
            onChange={(e) => go(e.target.value, localLn, localAny, localVista)}
          >
            <option value="empresa">Empresa</option>
            <option value="linia">Una línia de negoci</option>
          </select>
        </div>
      )}

      {!nomesEmpresa && localScope === "linia" && (
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={lineSelectId}>
            Línia de negoci
          </label>
          <select
            id={lineSelectId}
            className={styles.select}
            value={localLn}
            disabled={isPending}
            onChange={(e) => go("linia", e.target.value, localAny, localVista)}
          >
            <option value="">Selecciona…</option>
            {linies.map((ln) => (
              <option key={ln.id} value={ln.id}>
                {etiquetaLiniaNegoci(ln)}
              </option>
            ))}
          </select>
        </div>
      )}

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
          onChange={(e) => go(localScope, localLn, Number(e.target.value), localVista)}
        >
          {anys.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {mostraVistaGestio && (
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
            onChange={(e) => go(localScope, localLn, localAny, e.target.value as VistaCompte)}
          >
            <option value="directe">Directe (SAP)</option>
            <option value="gestio">Gestió (tractat)</option>
          </select>
          {isPending && <span className={styles.filterPending}>Actualitzant…</span>}
        </div>
      )}
    </div>
  );
}
