"use client";

import { DadesFilterBar, coincideixCerca } from "@/components/dades/DadesFilterBar";
import { DadesEmpty, DadesPanel, dadesUi as ui } from "@/components/dades/DadesPanel";
import { FloatingAddButton } from "@/components/ui/FloatingAddButton";
import type { DespesesEttResumCentre } from "@/lib/despeses-ett/service";
import { MESOS_LLARGS } from "@/lib/periodes";
import { cn, formatNum } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import styles from "../cost-salarial/page.module.css";
import { deleteAjustosEttAction, uploadDespesesEttAction } from "./actions";

type Result = { ok: boolean; missatge: string; errors?: string[]; avisos?: string[] };

export function DespesesEttPanel({
  resums,
  anys,
  filtreAny,
  filtreMes,
  canEdit,
}: {
  resums: DespesesEttResumCentre[];
  anys: number[];
  filtreAny: number;
  filtreMes: number | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Result | null>(null);
  const [query, setQuery] = useState("");

  const notify = (r: Result) => {
    setFeedback(r);
    router.refresh();
    if (r.ok) setTimeout(() => setFeedback(null), 12000);
  };

  const aplicarFiltre = (nextAny: string, nextMes: string) => {
    const p = new URLSearchParams();
    if (nextAny) p.set("any", nextAny);
    if (nextMes) p.set("mes", nextMes);
    router.push(`/dades/despeses-ett?${p}`);
  };

  const filtrats = useMemo(() => {
    return resums.filter((r) =>
      coincideixCerca([r.centreCodi, r.centreNom, r.periodNom].join(" "), query)
    );
  }, [resums, query]);

  const pujar = (list: FileList | null) => {
    if (!list?.length) return;
    const fd = new FormData();
    for (const f of Array.from(list)) fd.append("fitxers", f);
    startTransition(async () => {
      const r = await uploadDespesesEttAction(fd);
      notify(r);
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  const esborrarPeriode = (any: number, mes: number, label: string) => {
    if (!confirm(`Eliminar tots els ajustos ETT de ${label}? Aquesta acció no es pot desfer.`)) {
      return;
    }
    startTransition(async () => {
      const r = await deleteAjustosEttAction({ any, mes });
      notify(r);
    });
  };

  const periodesUnics = useMemo(() => {
    const map = new Map<string, { any: number; mes: number; label: string }>();
    for (const r of filtrats) {
      const key = `${r.periodAny}-${r.periodMes}`;
      if (!map.has(key)) {
        map.set(key, { any: r.periodAny, mes: r.periodMes, label: r.periodNom });
      }
    }
    return [...map.values()];
  }, [filtrats]);

  return (
    <>
      {feedback && (
        <div className={cn(styles.feedback, feedback.ok ? styles.feedbackOk : styles.feedbackErr)}>
          <div>{feedback.missatge}</div>
          {feedback.avisos && feedback.avisos.length > 0 && (
            <ul className={styles.errorList}>
              {feedback.avisos.slice(0, 6).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {feedback.errors && feedback.errors.length > 0 && (
            <ul className={styles.errorList}>
              {feedback.errors.slice(0, 8).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {canEdit && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            multiple
            hidden
            disabled={pending}
            onChange={(e) => pujar(e.target.files)}
          />
          <FloatingAddButton
            label="Pujar Excel ETT (629006)"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
          />
        </>
      )}

      <div className={styles.toolbar}>
        <DadesFilterBar
          className={styles.filterBar}
          query={query}
          onQueryChange={setQuery}
          placeholder="Cerca centre o període…"
          onClear={() => {
            setQuery("");
            aplicarFiltre("", "");
          }}
          filters={[
            {
              id: "any",
              value: filtreAny ? String(filtreAny) : "",
              onChange: (v) => aplicarFiltre(v, filtreMes ? String(filtreMes) : ""),
              options: anys.map((y) => ({ value: String(y), label: String(y) })),
              allLabel: "Tots els anys",
              "aria-label": "Filtra per any",
            },
            {
              id: "mes",
              value: filtreMes ? String(filtreMes) : "",
              onChange: (v) => aplicarFiltre(filtreAny ? String(filtreAny) : "", v),
              options: MESOS_LLARGS.map((m, i) => ({
                value: String(i + 1),
                label: m,
              })),
              allLabel: "Tots els mesos",
              "aria-label": "Filtra per mes",
            },
          ]}
          summary={query.trim() ? `${filtrats.length} de ${resums.length} centres` : undefined}
        />
      </div>

      <p className={ui.muted} style={{ marginBottom: "0.75rem" }}>
        Excel d&apos;apunts del compte <strong>629006</strong> (Gastos contratación E.T.T.). Per
        cada centre es crea un parell d&apos;ajustos amb motiu <strong>ETT</strong>: import en
        negatiu a <strong>CONTRACTES ETT</strong> i el mateix import restat d&apos;
        <strong>ALTRES DESPESES</strong>. La reimportació del mateix mes×centre substitueix els
        ajustos ETT previs. També es veuen a Dades → Ajustos.
      </p>

      {canEdit && periodesUnics.length > 0 && (
        <p className={ui.muted} style={{ marginBottom: "0.75rem" }}>
          Eliminar ajustos ETT:{" "}
          {periodesUnics.map((p, i) => (
            <span key={`${p.any}-${p.mes}`}>
              {i > 0 ? " · " : null}
              <button
                type="button"
                disabled={pending}
                onClick={() => esborrarPeriode(p.any, p.mes, p.label)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "var(--color-destructive)",
                  cursor: pending ? "default" : "pointer",
                  textDecoration: "underline",
                  font: "inherit",
                }}
              >
                {p.label}
              </button>
            </span>
          ))}
        </p>
      )}

      <DadesPanel title="Ajustos ETT per centre" meta={`${filtrats.length}`}>
        {filtrats.length === 0 ? (
          <DadesEmpty text="Encara no hi ha ajustos ETT. Puja l'Excel mensual amb el botó +." />
        ) : (
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Període</th>
                  <th>Centre</th>
                  <th className={ui.right}>Import</th>
                  <th className={ui.right}>→ ETT</th>
                  <th className={ui.right}>→ Altres despeses</th>
                </tr>
              </thead>
              <tbody>
                {filtrats.map((r) => (
                  <tr key={`${r.periodAny}-${r.periodMes}-${r.centreCodi}`}>
                    <td>{r.periodNom}</td>
                    <td>
                      {r.centreCodi}
                      <span className={ui.muted}> · {r.centreNom}</span>
                    </td>
                    <td className={ui.right}>{formatNum(r.importBrut)}</td>
                    <td className={ui.right}>{formatNum(r.importEtt)}</td>
                    <td className={ui.right}>{formatNum(r.importAltres)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DadesPanel>
    </>
  );
}
