"use client";

import { ConsultaHeader } from "@/components/consultes/ConsultaHeader";
import styles from "@/components/consultes/report.module.css";
import type { GrupEmpresa } from "@/lib/grups-empresa";
import { grupPermetVistaGestio } from "@/lib/grups-empresa";
import type { RangMesos } from "@/lib/periodes";
import { etiquetaRangMesosLlarga } from "@/lib/periodes";
import type { VistaCompte } from "@/lib/vista-compte";
import { etiquetaVistaCompte } from "@/lib/vista-compte";
import { replaceVistaQuery } from "@/lib/vista-url";
import { useEffect, useState } from "react";
import { LiniaResumPresentacio } from "./LiniaResumPresentacio";
import { LiniaSelectors } from "./LiniaSelectors";
import { carregarLiniaResumCapaAction } from "./actions";
import type { LiniaResumCapa } from "./linia-resum-data";

interface LnOpt {
  id: string;
  codi: string;
  nom: string;
}

export function LiniaResumBoard({
  linies,
  anys,
  anyActual,
  rang,
  grup,
  vistaInicial,
  capesInicials,
  potPrecarregarVistes = false,
}: {
  linies: LnOpt[];
  anys: number[];
  anyActual: number;
  rang: RangMesos;
  grup: GrupEmpresa;
  vistaInicial: VistaCompte;
  capesInicials: Partial<Record<VistaCompte, LiniaResumCapa>>;
  potPrecarregarVistes?: boolean;
}) {
  const [vista, setVista] = useState(vistaInicial);
  const [capes, setCapes] = useState(capesInicials);

  useEffect(() => {
    setVista(vistaInicial);
  }, [vistaInicial]);

  useEffect(() => {
    setCapes(capesInicials);
  }, [capesInicials]);

  useEffect(() => {
    if (!potPrecarregarVistes) return;
    const pending = (["sap", "ajustos", "directe", "traspassos", "gestio"] as VistaCompte[]).filter(
      (v) => !capes[v]
    );
    if (!pending.length) return;
    let cancelled = false;
    void Promise.all(
      pending.map(async (v) => {
        const data = await carregarLiniaResumCapaAction({ any: anyActual, rang, vista: v });
        if (!cancelled && data) {
          setCapes((prev) => (prev[v] ? prev : { ...prev, [v]: data }));
        }
      })
    );
    return () => {
      cancelled = true;
    };
  }, [potPrecarregarVistes, capes, anyActual, rang]);

  const data = capes[vista] ?? null;
  const vistesCarregades = (Object.keys(capes) as VistaCompte[]).filter((k) => !!capes[k]);
  const periodeLlarga = etiquetaRangMesosLlarga(rang, anyActual);
  const vistaLabel = etiquetaVistaCompte(vista);

  const onVistaLocal = (next: VistaCompte) => {
    setVista(next);
    replaceVistaQuery(next);
    if (capes[next]) return true;
    void carregarLiniaResumCapaAction({ any: anyActual, rang, vista: next }).then((capa) => {
      if (capa) setCapes((prev) => (prev[next] ? prev : { ...prev, [next]: capa }));
    });
    return true;
  };

  return (
    <div className={styles.page}>
      <ConsultaHeader
        title="Compte d'explotació · per línia de negoci"
        subtitle={
          data
            ? `Resum de totes les línies · ${periodeLlarga} · ${vistaLabel}`
            : `Resum de totes les línies · ${periodeLlarga} · Carregant…`
        }
        actions={
          <LiniaSelectors
            linies={linies}
            anys={anys}
            lnId={null}
            any={anyActual}
            rang={rang}
            vista={vista}
            vistesCarregades={vistesCarregades}
            onVistaLocal={onVistaLocal}
            mostraCapesGestio={grupPermetVistaGestio(grup)}
          />
        }
      />

      {!data ? (
        <div className={styles.prompt}>
          <h3>Carregant vista…</h3>
        </div>
      ) : data.buit ? (
        <div className={styles.prompt}>
          <h3>Sense dades</h3>
          <p>No hi ha dades de línies per aquest període.</p>
        </div>
      ) : (
        <div key={vista}>
          <LiniaResumPresentacio
            periode={periodeLlarga}
            vistaLabel={vistaLabel}
            kpis={data.kpis}
            mensual={data.mensual}
            perLn={data.perLn}
            files={data.files}
          />
        </div>
      )}
    </div>
  );
}
