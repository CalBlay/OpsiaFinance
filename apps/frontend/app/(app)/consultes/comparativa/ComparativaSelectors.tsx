"use client";

import { ConsultaToolbar } from "@/components/consultes/ConsultaToolbar";
import { ConsultaVistaSelect } from "@/components/consultes/ConsultaVistaSelect";
import { FILTRE } from "@/components/consultes/consulta-filtres";
import styles from "@/components/consultes/report.module.css";
import { etiquetaCentre, etiquetaLiniaNegoci } from "@/lib/consultes-etiquetes";
import { type GrupEmpresa, grupPermetVistaGestio } from "@/lib/grups-empresa";
import { MESOS_CURTS, MESOS_LLARGS } from "@/lib/periodes";
import type { VistaCompte } from "@/lib/vista-compte";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

interface CentreOpt {
  id: string;
  codi: string;
  nom: string;
}
interface LnOpt {
  id: string;
  codi: string;
  nom: string;
  centres: CentreOpt[];
}

export function ComparativaSelectors({
  arbre,
  scope,
  id,
  granularitat,
  mes,
  mesosSeleccionats,
  vista,
  grup,
  nomesEmpresa = false,
}: {
  arbre: LnOpt[];
  scope: "empresa" | "linia" | "centre";
  id: string | null;
  granularitat: "anual" | "mensual" | "mes";
  mes: number;
  mesosSeleccionats: number[];
  vista: VistaCompte;
  grup: GrupEmpresa;
  nomesEmpresa?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mesosOpen, setMesosOpen] = useState(false);
  const mesosRef = useRef<HTMLDivElement>(null);
  const scopeSelectId = "comparativa-scope";
  const lineSelectId = "comparativa-line";
  const centreSelectId = "comparativa-centre";
  const granularitySelectId = "comparativa-granularity";
  const monthSelectId = "comparativa-month";
  const monthsButtonId = "comparativa-months";
  const viewSelectId = "comparativa-view";
  const mostraVistaGestio = grupPermetVistaGestio(grup);

  const [localVista, setLocalVista] = useState(vista);

  useEffect(() => {
    setLocalVista(vista);
  }, [vista]);

  const buildUrl = (
    overrides: Partial<{
      scope: string;
      id: string;
      g: string;
      mes: number;
      mesos: number[];
      vista: VistaCompte;
    }>
  ) => {
    const p = new URLSearchParams();
    const s = overrides.scope ?? scope;
    p.set("scope", s);
    const idVal = overrides.id !== undefined ? overrides.id : id;
    if (s !== "empresa" && idVal) p.set("id", idVal);
    const g = overrides.g ?? granularitat;
    p.set("g", g);
    if (g === "mes") p.set("mes", String(overrides.mes ?? mes));
    if (g === "mensual") {
      const mesos = overrides.mesos ?? mesosSeleccionats;
      if (mesos.length) p.set("mesos", mesos.join(","));
    }
    const vistaEfectiva = mostraVistaGestio ? (overrides.vista ?? localVista) : "directe";
    if (vistaEfectiva !== "directe") p.set("vista", vistaEfectiva);
    return `/consultes/comparativa?${p.toString()}`;
  };

  const go = (url: string) => {
    startTransition(() => {
      router.push(url);
    });
  };

  const goScope = (nextScope: string, nextId: string) => {
    if (nextScope === "empresa") {
      go(buildUrl({ scope: "empresa", id: "" }));
      return;
    }
    if (!nextId) {
      go(buildUrl({ scope: nextScope, id: "" }));
      return;
    }
    go(buildUrl({ scope: nextScope, id: nextId }));
  };

  const goVista = (nextVista: VistaCompte) => {
    const vistaEfectiva = mostraVistaGestio ? nextVista : "directe";
    setLocalVista(vistaEfectiva);
    go(buildUrl({ vista: vistaEfectiva }));
  };

  const toggleMes = (num: number) => {
    const next = mesosSeleccionats.includes(num)
      ? mesosSeleccionats.filter((m) => m !== num)
      : [...mesosSeleccionats, num].sort((a, b) => a - b);
    if (next.length === 0) return;
    go(buildUrl({ mesos: next }));
  };

  const mesosLabel =
    mesosSeleccionats.length === 12
      ? "Tots els mesos"
      : mesosSeleccionats.length === 1
        ? MESOS_LLARGS[mesosSeleccionats[0] - 1]
        : `${mesosSeleccionats.length} mesos seleccionats`;

  useEffect(() => {
    if (!mesosOpen) return;
    function handleClick(e: MouseEvent) {
      if (mesosRef.current && !mesosRef.current.contains(e.target as Node)) setMesosOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [mesosOpen]);

  return (
    <ConsultaToolbar
      pending={isPending}
      dates={
        <>
          {granularitat === "mes" ? (
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={monthSelectId}>
                {FILTRE.mes}
              </label>
              <select
                id={monthSelectId}
                className={styles.select}
                style={{ minWidth: 140 }}
                value={mes}
                disabled={isPending}
                onChange={(e) => go(buildUrl({ mes: Number(e.target.value) }))}
              >
                {MESOS_LLARGS.map((m, i) => (
                  <option key={`${i + 1}-${m}`} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {granularitat === "mensual" ? (
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={monthsButtonId}>
                {FILTRE.mesosComparar}
              </label>
              <div className={styles.multiSelect} ref={mesosRef}>
                <button
                  id={monthsButtonId}
                  type="button"
                  className={styles.multiTrigger}
                  disabled={isPending}
                  onClick={() => setMesosOpen((v) => !v)}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                    }}
                  >
                    <span>{mesosLabel}</span>
                    <ChevronDown size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
                  </span>
                </button>
                {mesosOpen && (
                  <div className={styles.multiPanel}>
                    <div className={styles.multiActions}>
                      <button
                        type="button"
                        className={styles.multiActionBtnPrimary}
                        onClick={() => {
                          setMesosOpen(false);
                          go(buildUrl({ mesos: Array.from({ length: 12 }, (_, i) => i + 1) }));
                        }}
                      >
                        Seleccionar tot
                      </button>
                      <button
                        type="button"
                        className={styles.multiActionBtn}
                        onClick={() => {
                          const ara = new Date().getMonth() + 1;
                          setMesosOpen(false);
                          go(buildUrl({ mesos: Array.from({ length: ara }, (_, i) => i + 1) }));
                        }}
                      >
                        Gen–{MESOS_CURTS[new Date().getMonth()]}
                      </button>
                    </div>
                    {MESOS_LLARGS.map((nom, i) => {
                      const num = i + 1;
                      return (
                        <label key={num} className={styles.multiOption}>
                          <input
                            type="checkbox"
                            checked={mesosSeleccionats.includes(num)}
                            onChange={() => toggleMes(num)}
                          />
                          <span>{nom}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </>
      }
      camps={
        <>
          {!nomesEmpresa ? (
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={scopeSelectId}>
                {FILTRE.ambit}
              </label>
              <select
                id={scopeSelectId}
                className={styles.select}
                value={scope}
                disabled={isPending}
                onChange={(e) => goScope(e.target.value, "")}
              >
                <option value="centre">{FILTRE.centre}</option>
                <option value="empresa">Empresa</option>
                <option value="linia">{FILTRE.linia}</option>
              </select>
            </div>
          ) : null}
          {!nomesEmpresa && scope === "linia" ? (
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={lineSelectId}>
                {FILTRE.linia}
              </label>
              <select
                id={lineSelectId}
                className={styles.select}
                value={id ?? ""}
                disabled={isPending}
                onChange={(e) => goScope("linia", e.target.value)}
              >
                <option value="">Selecciona…</option>
                {arbre.map((ln) => (
                  <option key={ln.id} value={ln.id}>
                    {etiquetaLiniaNegoci(ln)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {!nomesEmpresa && scope === "centre" ? (
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={centreSelectId}>
                {FILTRE.centre}
              </label>
              <select
                id={centreSelectId}
                className={styles.select}
                value={id ?? ""}
                disabled={isPending}
                onChange={(e) => goScope("centre", e.target.value)}
              >
                <option value="">Selecciona…</option>
                {arbre.map((ln) => (
                  <optgroup key={ln.id} label={etiquetaLiniaNegoci(ln)}>
                    {ln.centres.map((c) => (
                      <option key={c.id} value={c.id}>
                        {etiquetaCentre(c)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          ) : null}
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={granularitySelectId}>
              {FILTRE.granularitat}
            </label>
            <select
              id={granularitySelectId}
              className={styles.select}
              value={granularitat}
              disabled={isPending}
              onChange={(e) => go(buildUrl({ g: e.target.value }))}
            >
              <option value="anual">Anual</option>
              <option value="mensual">Període</option>
              <option value="mes">Un mes</option>
            </select>
          </div>
        </>
      }
      vista={
        mostraVistaGestio ? (
          <ConsultaVistaSelect
            id={viewSelectId}
            value={localVista}
            disabled={isPending}
            pendingHint={isPending}
            onChange={goVista}
            opcions={["sap", "directe", "traspassos", "gestio"]}
          />
        ) : null
      }
    />
  );
}
