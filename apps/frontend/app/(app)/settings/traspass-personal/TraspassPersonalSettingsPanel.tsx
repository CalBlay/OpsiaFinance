"use client";

import { Button } from "@/components/ui/Button";
import { Check, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import {
  createMapeigAction,
  deleteMapeigAction,
  importarMapeigExcelAction,
  updateMapeigAction,
  updateTarifaHoraAction,
} from "./actions";
import styles from "./page.module.css";

type CentreOpt = { id: string; codi: string; nom: string };
type Mapeig = { id: string; text: string; centre: CentreOpt };

export function TraspassPersonalSettingsPanel({
  tarifaHora,
  mapeigs,
  centres,
  canEdit,
}: {
  tarifaHora: number;
  mapeigs: Mapeig[];
  centres: CentreOpt[];
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; missatge: string } | null>(null);
  const [tarifaTxt, setTarifaTxt] = useState(String(tarifaHora));
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editCentreId, setEditCentreId] = useState("");
  const [newRow, setNewRow] = useState({ text: "", centreId: "" });
  const [substituirTot, setSubstituirTot] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const notify = (r: { ok: boolean; missatge: string }) => {
    setFeedback(r);
    if (r.ok) setTimeout(() => setFeedback(null), 6000);
  };

  const importarExcel = () => {
    const file = importRef.current?.files?.[0];
    if (!file) {
      notify({ ok: false, missatge: "Selecciona un fitxer Excel." });
      return;
    }
    const fd = new FormData();
    fd.set("fitxer", file);
    fd.set("substituirTot", String(substituirTot));
    startTransition(async () => {
      const r = await importarMapeigExcelAction(fd);
      notify(r);
      if (r.ok && importRef.current) importRef.current.value = "";
    });
  };

  const startEdit = (row: Mapeig) => {
    setEditId(row.id);
    setEditText(row.text);
    setEditCentreId(row.centre.id);
  };

  return (
    <div className={styles.stack}>
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Tarifa hora</h2>
        <p className={styles.helpText}>
          Cost per hora per calcular els traspassos quan l&apos;excel no porta cost directe.
        </p>
        <div className={styles.inlineForm}>
          <input
            className={styles.input}
            value={tarifaTxt}
            disabled={!canEdit || pending}
            onChange={(e) => setTarifaTxt(e.target.value)}
          />
          <span className={styles.muted}>€/h</span>
          {canEdit && (
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const v = Number(tarifaTxt.replace(",", "."));
                  notify(await updateTarifaHoraAction(v));
                })
              }
            >
              Desar
            </Button>
          )}
        </div>
      </section>

      {canEdit && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Importar mapeig des d&apos;Excel</h2>
          <p className={styles.helpText}>
            Format: columna A = text (Organizaciones o Proyecto), B = codi centre (CCR00009…), C =
            nom centre (opcional). El mateix mapeig serveix per origen i destí.
          </p>
          <div className={styles.inlineForm}>
            <input ref={importRef} type="file" accept=".xlsx,.xls" className={styles.fileInput} />
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={substituirTot}
                onChange={(e) => setSubstituirTot(e.target.checked)}
              />
              Substituir tot
            </label>
            <Button size="sm" disabled={pending} onClick={importarExcel}>
              <Upload size={14} /> Importar
            </Button>
          </div>
        </section>
      )}

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Mapeig text → centre</h2>
        <p className={styles.helpText}>
          Cada text de l&apos;excel d&apos;hores (tant «Organizaciones» com «Proyecto») es resol
          contra aquesta taula.
        </p>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Text</th>
              <th>Centre</th>
              {canEdit && <th />}
            </tr>
          </thead>
          <tbody>
            {mapeigs.map((row) =>
              editId === row.id ? (
                <tr key={row.id}>
                  <td>
                    <input
                      className={styles.input}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      className={styles.select}
                      value={editCentreId}
                      onChange={(e) => setEditCentreId(e.target.value)}
                    >
                      {centres.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.codi} · {c.nom}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={styles.rowActions}>
                    <button
                      type="button"
                      onClick={() =>
                        startTransition(async () => {
                          const r = await updateMapeigAction(row.id, editText, editCentreId);
                          notify(r);
                          if (r.ok) setEditId(null);
                        })
                      }
                      disabled={pending}
                    >
                      <Check size={16} />
                    </button>
                    <button type="button" onClick={() => setEditId(null)} disabled={pending}>
                      <X size={16} />
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={row.id}>
                  <td>{row.text}</td>
                  <td>
                    {row.centre.codi} · {row.centre.nom}
                  </td>
                  {canEdit && (
                    <td className={styles.rowActions}>
                      <button type="button" onClick={() => startEdit(row)} disabled={pending}>
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          startTransition(async () => notify(await deleteMapeigAction(row.id)))
                        }
                        disabled={pending}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              )
            )}
            {canEdit && (
              <tr>
                <td>
                  <input
                    className={styles.input}
                    placeholder="Nou text…"
                    value={newRow.text}
                    onChange={(e) => setNewRow({ ...newRow, text: e.target.value })}
                  />
                </td>
                <td>
                  <select
                    className={styles.select}
                    value={newRow.centreId}
                    onChange={(e) => setNewRow({ ...newRow, centreId: e.target.value })}
                  >
                    <option value="">Selecciona centre…</option>
                    {centres.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.codi} · {c.nom}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <Button
                    size="sm"
                    disabled={pending || !newRow.text || !newRow.centreId}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await createMapeigAction(newRow.text, newRow.centreId);
                        notify(r);
                        if (r.ok) setNewRow({ text: "", centreId: "" });
                      })
                    }
                  >
                    <Plus size={14} /> Afegir
                  </Button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {feedback && (
        <p className={feedback.ok ? styles.feedbackOk : styles.feedbackErr}>{feedback.missatge}</p>
      )}
    </div>
  );
}
