"use client";

import styles from "@/components/consultes/report.module.css";
import { MESOS_CURTS, MESOS_LLARGS } from "@/lib/periodes";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
}: {
  arbre: LnOpt[];
  scope: "empresa" | "linia" | "centre";
  id: string | null;
  granularitat: "anual" | "mensual" | "mes";
  mes: number;
  mesosSeleccionats: number[];
}) {
  const router = useRouter();
  const [mesosOpen, setMesosOpen] = useState(false);
  const mesosRef = useRef<HTMLDivElement>(null);

  const buildUrl = (
    overrides: Partial<{
      scope: string;
      id: string;
      g: string;
      mes: number;
      mesos: number[];
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
    return `/consultes/comparativa?${p.toString()}`;
  };

  const goScope = (nextScope: string, nextId: string) => {
    if (nextScope === "empresa") {
      router.push(buildUrl({ scope: "empresa", id: "" }));
      return;
    }
    if (!nextId) {
      router.push(buildUrl({ scope: nextScope, id: "" }));
      return;
    }
    router.push(buildUrl({ scope: nextScope, id: nextId }));
  };

  const toggleMes = (num: number) => {
    const next = mesosSeleccionats.includes(num)
      ? mesosSeleccionats.filter((m) => m !== num)
      : [...mesosSeleccionats, num].sort((a, b) => a - b);
    if (next.length === 0) return;
    router.push(buildUrl({ mesos: next }));
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
    <div className={styles.selectors}>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Àmbit</label>
        <select
          className={styles.select}
          value={scope}
          onChange={(e) => goScope(e.target.value, "")}
        >
          <option value="empresa">Empresa</option>
          <option value="linia">Línia de negoci</option>
          <option value="centre">Centre</option>
        </select>
      </div>

      {scope === "linia" && (
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Línia de negoci</label>
          <select
            className={styles.select}
            value={id ?? ""}
            onChange={(e) => goScope("linia", e.target.value)}
          >
            <option value="">Selecciona…</option>
            {arbre.map((ln) => (
              <option key={ln.id} value={ln.id}>
                {ln.codi} · {ln.nom}
              </option>
            ))}
          </select>
        </div>
      )}

      {scope === "centre" && (
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Centre</label>
          <select
            className={styles.select}
            value={id ?? ""}
            onChange={(e) => goScope("centre", e.target.value)}
          >
            <option value="">Selecciona…</option>
            {arbre.map((ln) => (
              <optgroup key={ln.id} label={`${ln.codi} · ${ln.nom}`}>
                {ln.centres.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codi} · {c.nom}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Granularitat</label>
        <select
          className={styles.select}
          value={granularitat}
          onChange={(e) => router.push(buildUrl({ g: e.target.value }))}
        >
          <option value="anual">Anual (acumulat per any)</option>
          <option value="mensual">Període (comparació entre anys)</option>
          <option value="mes">Un mes (entre anys)</option>
        </select>
      </div>

      {granularitat === "mensual" && (
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Mesos a comparar</label>
          <div className={styles.multiSelect} ref={mesosRef}>
            <button
              type="button"
              className={styles.multiTrigger}
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
                    className={styles.multiActionBtn}
                    onClick={() =>
                      router.push(buildUrl({ mesos: Array.from({ length: 12 }, (_, i) => i + 1) }))
                    }
                  >
                    Tots
                  </button>
                  <button
                    type="button"
                    className={styles.multiActionBtn}
                    onClick={() => {
                      const ara = new Date().getMonth() + 1;
                      router.push(
                        buildUrl({ mesos: Array.from({ length: ara }, (_, i) => i + 1) })
                      );
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
      )}

      {granularitat === "mes" && (
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Mes</label>
          <select
            className={styles.select}
            style={{ minWidth: 140 }}
            value={mes}
            onChange={(e) => router.push(buildUrl({ mes: Number(e.target.value) }))}
          >
            {MESOS_LLARGS.map((m, i) => (
              <option key={i} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
