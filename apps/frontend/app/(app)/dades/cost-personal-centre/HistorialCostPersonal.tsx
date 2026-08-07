"use client";

import { DadesFilterBar, coincideixCerca } from "@/components/dades/DadesFilterBar";
import {
  DadesBadge,
  DadesEmpty,
  DadesIconBtn,
  DadesPanel,
  dadesUi as ui,
} from "@/components/dades/DadesPanel";
import histStyles from "@/components/dades/HistorialCarregues.module.css";
import type { CarregaFitxerLlistaItem } from "@/lib/carrega-fitxer";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, FileSpreadsheet, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState, useTransition } from "react";

type Result = { ok: boolean; missatge: string };

type PeriodeGrup = {
  key: string;
  label: string;
  any: number;
  mes: number;
  nomina: CarregaFitxerLlistaItem | null;
  millores: CarregaFitxerLlistaItem | null;
  /** Fitxers antics (sense registres actius) del mateix període. */
  historics: CarregaFitxerLlistaItem[];
  fitxers: CarregaFitxerLlistaItem[];
};

function haystack(item: CarregaFitxerLlistaItem): string {
  return [item.nomFitxer, item.tipusLabel, item.periodLabel, item.resum, item.notes, item.usuari]
    .filter(Boolean)
    .join(" ");
}

function esMillores(item: CarregaFitxerLlistaItem): boolean {
  return item.tipus === "COST_PERSONAL_MILLORES";
}

/** Agrupa per període; per cada tipus queda la càrrega activa (amb registres) més recent. */
function agruparPerPeriodes(items: CarregaFitxerLlistaItem[]): PeriodeGrup[] {
  const map = new Map<
    string,
    {
      label: string;
      any: number;
      mes: number;
      candidats: CarregaFitxerLlistaItem[];
    }
  >();

  for (const item of items) {
    const any = item.periodAny;
    const mes = item.periodMes;
    if (any == null || mes == null) continue;
    const key = `${any}-${String(mes).padStart(2, "0")}`;
    const prev = map.get(key);
    if (prev) {
      prev.candidats.push(item);
    } else {
      map.set(key, {
        label: item.periodLabel ?? key,
        any,
        mes,
        candidats: [item],
      });
    }
  }

  const grups: PeriodeGrup[] = [];
  for (const [key, g] of map) {
    const ordenats = [...g.candidats].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const actius = ordenats.filter((c) => c.registres > 0);
    const pick = (millores: boolean) => {
      const fromActius = actius.find((c) => esMillores(c) === millores);
      if (fromActius) return fromActius;
      // Si no hi ha activa d’aquest tipus, mostra la darrera històrica
      return ordenats.find((c) => esMillores(c) === millores) ?? null;
    };
    const nomina = pick(false);
    const millores = pick(true);
    const usats = new Set([nomina?.id, millores?.id].filter(Boolean));
    const historics = ordenats.filter((c) => !usats.has(c.id));
    const fitxers = [nomina, millores, ...historics].filter(
      (x): x is CarregaFitxerLlistaItem => !!x
    );
    grups.push({
      key,
      label: g.label,
      any: g.any,
      mes: g.mes,
      nomina,
      millores,
      historics,
      fitxers,
    });
  }

  return grups.sort((a, b) => b.any - a.any || b.mes - a.mes);
}

export function HistorialCostPersonal({
  items,
  canEdit,
  onDelete,
  onSaveNotes,
}: {
  items: CarregaFitxerLlistaItem[];
  canEdit: boolean;
  onDelete: (id: string) => Promise<Result>;
  onSaveNotes: (id: string, notes: string) => Promise<Result>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [query, setQuery] = useState("");
  const [filtreAny, setFiltreAny] = useState("");
  const [oberts, setOberts] = useState<Set<string>>(() => new Set());

  const grups = useMemo(() => agruparPerPeriodes(items), [items]);

  const anysOpts = useMemo(() => {
    const set = new Set(grups.map((g) => String(g.any)));
    return [...set].sort((a, b) => Number(b) - Number(a)).map((value) => ({ value, label: value }));
  }, [grups]);

  const filtrats = useMemo(() => {
    return grups.filter((g) => {
      if (filtreAny && String(g.any) !== filtreAny) return false;
      if (!query.trim()) return true;
      const blob = [g.label, ...g.fitxers.map(haystack)].join(" ");
      return coincideixCerca(blob, query);
    });
  }, [grups, filtreAny, query]);

  const teFiltres = !!(query.trim() || filtreAny);

  const toggle = (key: string) => {
    setOberts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (!items.length) {
    return (
      <DadesPanel title="Documents per període">
        <DadesEmpty text="Encara no hi ha cap fitxer carregat. Puja nòmina i/o millores amb el botó +." />
      </DadesPanel>
    );
  }

  return (
    <DadesPanel
      title="Documents per període"
      meta={
        teFiltres
          ? `${filtrats.length} de ${grups.length} mesos`
          : `${grups.length} mes${grups.length !== 1 ? "os" : ""}`
      }
    >
      <DadesFilterBar
        query={query}
        onQueryChange={setQuery}
        placeholder="Cerca període, fitxer, usuari…"
        filters={[
          ...(anysOpts.length > 0
            ? [
                {
                  id: "any",
                  value: filtreAny,
                  onChange: setFiltreAny,
                  options: anysOpts,
                  allLabel: "Tots els anys",
                  "aria-label": "Filtra per any",
                },
              ]
            : []),
        ]}
      />

      {feedback && <p className={ui.feedback}>{feedback}</p>}

      {filtrats.length === 0 ? (
        <DadesEmpty text="Cap període amb aquests criteris." />
      ) : (
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th style={{ width: "2rem" }} />
                <th>Període</th>
                <th>Nòmina</th>
                <th>Millores</th>
                <th>Registres</th>
                <th>Darrera càrrega</th>
              </tr>
            </thead>
            <tbody>
              {filtrats.map((g) => {
                const obert = oberts.has(g.key);
                const registres = (g.nomina?.registres ?? 0) + (g.millores?.registres ?? 0);
                const darrera = g.fitxers[0]?.createdAtLabel ?? "—";
                return (
                  <Fragment key={g.key}>
                    <tr className={cn(pending && histStyles.dim)}>
                      <td>
                        <DadesIconBtn
                          label={obert ? "Amaga detall" : "Mostra detall"}
                          onClick={() => toggle(g.key)}
                        >
                          {obert ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </DadesIconBtn>
                      </td>
                      <td>
                        <strong>{g.label}</strong>
                      </td>
                      <td>
                        {g.nomina ? (
                          <DadesBadge>{g.nomina.registres > 0 ? "Activa" : "Històric"}</DadesBadge>
                        ) : (
                          <span className={ui.muted}>—</span>
                        )}
                      </td>
                      <td>
                        {g.millores ? (
                          <DadesBadge>
                            {g.millores.registres > 0 ? "Activa" : "Històric"}
                          </DadesBadge>
                        ) : (
                          <span className={ui.muted}>—</span>
                        )}
                      </td>
                      <td className={ui.right}>{registres || "—"}</td>
                      <td className={ui.nowrap}>{darrera}</td>
                    </tr>
                    {obert &&
                      g.fitxers.map((item) => (
                        <tr key={item.id} className={cn(pending && histStyles.dim)}>
                          <td />
                          <td colSpan={2}>
                            <span className={ui.fileCell}>
                              <FileSpreadsheet size={14} strokeWidth={1.8} />
                              <span className={ui.fileName} title={item.nomFitxer}>
                                {item.nomFitxer}
                              </span>
                            </span>
                            {item.notes ? (
                              <span className={cn(ui.muted, ui.ellipsis)} title={item.notes}>
                                {item.notes}
                              </span>
                            ) : null}
                          </td>
                          <td>
                            <DadesBadge>{esMillores(item) ? "Millores" : "Nòmina"}</DadesBadge>
                            {item.registres === 0 ? (
                              <span className={ui.muted}> · substituït</span>
                            ) : null}
                          </td>
                          <td className={ui.right}>{item.registres}</td>
                          <td className={ui.actions}>
                            <span className={ui.nowrap}>{item.createdAtLabel}</span>
                            {canEdit && (
                              <>
                                {" "}
                                <DadesIconBtn
                                  label="Editar notes"
                                  disabled={pending}
                                  onClick={() => {
                                    setEditId(item.id);
                                    setNotesDraft(item.notes ?? "");
                                  }}
                                >
                                  <Pencil size={14} />
                                </DadesIconBtn>
                                <DadesIconBtn
                                  label="Eliminar fitxer i dades"
                                  danger
                                  disabled={pending}
                                  onClick={() => {
                                    if (
                                      !confirm(
                                        `Eliminar «${item.nomFitxer}»${
                                          item.registres
                                            ? ` i els ${item.registres} registres vinculats`
                                            : ""
                                        }?`
                                      )
                                    ) {
                                      return;
                                    }
                                    startTransition(async () => {
                                      const r = await onDelete(item.id);
                                      setFeedback(r.missatge);
                                      router.refresh();
                                    });
                                  }}
                                >
                                  <Trash2 size={14} />
                                </DadesIconBtn>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editId && (
        <div className={histStyles.notesEditor}>
          <div className={histStyles.notesEditorHeader}>
            <strong>Notes del fitxer</strong>
            <DadesIconBtn label="Tancar" onClick={() => setEditId(null)}>
              <X size={14} />
            </DadesIconBtn>
          </div>
          <textarea
            className={histStyles.textarea}
            rows={3}
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="Notes opcionals…"
          />
          <div className={histStyles.notesEditorActions}>
            <button
              type="button"
              className={histStyles.primaryBtn}
              disabled={pending}
              onClick={() => {
                const id = editId;
                startTransition(async () => {
                  const r = await onSaveNotes(id, notesDraft);
                  setFeedback(r.missatge);
                  setEditId(null);
                  router.refresh();
                });
              }}
            >
              Desar notes
            </button>
          </div>
        </div>
      )}
    </DadesPanel>
  );
}
