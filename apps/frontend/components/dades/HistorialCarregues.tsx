"use client";

import { DadesFilterBar, coincideixCerca } from "@/components/dades/DadesFilterBar";
import { DadesEmpty, DadesIconBtn, DadesPanel, dadesUi as ui } from "@/components/dades/DadesPanel";
import type { CarregaFitxerLlistaItem } from "@/lib/carrega-fitxer";
import { cn } from "@/lib/utils";
import { FileSpreadsheet, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import styles from "./HistorialCarregues.module.css";

type Result = { ok: boolean; missatge: string };

function haystackCarrega(item: CarregaFitxerLlistaItem): string {
  return [
    item.nomFitxer,
    item.tipusLabel,
    item.tipus,
    item.periodLabel,
    item.resum,
    item.notes,
    item.usuari,
    item.createdAtLabel,
    String(item.registres),
  ]
    .filter(Boolean)
    .join(" ");
}

export function HistorialCarregues({
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
  const [filtreTipus, setFiltreTipus] = useState("");
  const [filtreAny, setFiltreAny] = useState("");

  const tipusOpts = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of items) map.set(i.tipus, i.tipusLabel);
    return [...map.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], "ca"))
      .map(([value, label]) => ({ value, label }));
  }, [items]);

  const anysOpts = useMemo(() => {
    const set = new Set<string>();
    for (const i of items) {
      const m = i.resum?.match(/\b(20\d{2})\b/g);
      if (m) for (const y of m) set.add(y);
      const p = i.periodLabel?.match(/\b(20\d{2})\b/);
      if (p) set.add(p[1]);
      const d = i.createdAt?.slice(0, 4);
      if (d && /^20\d{2}$/.test(d)) set.add(d);
    }
    return [...set].sort((a, b) => Number(b) - Number(a)).map((value) => ({ value, label: value }));
  }, [items]);

  const filtrats = useMemo(() => {
    return items.filter((item) => {
      if (filtreTipus && item.tipus !== filtreTipus) return false;
      if (filtreAny) {
        const blob = `${item.resum ?? ""} ${item.periodLabel ?? ""} ${item.createdAt ?? ""}`;
        if (!blob.includes(filtreAny)) return false;
      }
      return coincideixCerca(haystackCarrega(item), query);
    });
  }, [items, query, filtreTipus, filtreAny]);

  const teFiltres = !!(query.trim() || filtreTipus || filtreAny);

  if (!items.length) {
    return (
      <DadesPanel title="Historial de fitxers">
        <DadesEmpty text="Encara no hi ha cap fitxer carregat registrat." />
      </DadesPanel>
    );
  }

  return (
    <DadesPanel
      title="Historial de fitxers"
      meta={
        teFiltres
          ? `${filtrats.length} de ${items.length}`
          : `${items.length} càrrega${items.length !== 1 ? "s" : ""}`
      }
    >
      <DadesFilterBar
        query={query}
        onQueryChange={setQuery}
        placeholder="Cerca fitxer, període, usuari, resum…"
        filters={[
          ...(tipusOpts.length > 1
            ? [
                {
                  id: "tipus",
                  value: filtreTipus,
                  onChange: setFiltreTipus,
                  options: tipusOpts,
                  allLabel: "Tots els tipus",
                  "aria-label": "Filtra per tipus",
                },
              ]
            : []),
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
        <DadesEmpty text="Cap fitxer amb aquests criteris." />
      ) : (
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Fitxer</th>
                <th>Tipus</th>
                <th>Període</th>
                <th>Resum</th>
                <th>Registres</th>
                <th>Data</th>
                <th>Usuari</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {filtrats.map((item) => (
                <tr key={item.id} className={cn(pending && styles.dim)}>
                  <td>
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
                  <td>{item.tipusLabel}</td>
                  <td>{item.periodLabel ?? "—"}</td>
                  <td className={ui.ellipsis} title={item.resum ?? undefined}>
                    {item.resum ?? "—"}
                  </td>
                  <td className={ui.right}>{item.registres}</td>
                  <td className={ui.nowrap}>{item.createdAtLabel}</td>
                  <td>{item.usuari}</td>
                  {canEdit && (
                    <td className={ui.actions}>
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
                              `Eliminar «${item.nomFitxer}» i tots els registres vinculats (${item.registres})?`
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
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editId && (
        <div className={styles.notesEditor}>
          <div className={styles.notesEditorHeader}>
            <strong>Notes del fitxer</strong>
            <DadesIconBtn label="Tancar" onClick={() => setEditId(null)}>
              <X size={14} />
            </DadesIconBtn>
          </div>
          <textarea
            className={styles.textarea}
            rows={3}
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="Notes opcionals…"
          />
          <div className={styles.notesEditorActions}>
            <button
              type="button"
              className={styles.primaryBtn}
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
