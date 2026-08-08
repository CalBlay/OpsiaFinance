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
type Dept = "SALA" | "CUINA";
type Mapeig = { id: string; text: string; departament: Dept; centre: CentreOpt };

function labelDept(d: Dept) {
  return d === "CUINA" ? "Cuina" : "Sala";
}

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
  const [tarifaTxt, setTarifaTxt] = useState(Number(tarifaHora).toFixed(2).replace(".", ","));
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editCentreId, setEditCentreId] = useState("");
  const [editDept, setEditDept] = useState<Dept>("SALA");
  const [newRow, setNewRow] = useState<{ text: string; centreId: string; departament: Dept }>({
    text: "",
    centreId: "",
    departament: "SALA",
  });
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
    setEditDept(row.departament);
  };

  return (
    <div className={styles.stack}>
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Tarifa hora</h2>
        <p className={styles.helpText}>
          Cost per hora (amb decimals, p. ex. 14,50) per calcular els traspassos quan l&apos;excel
          no porta cost directe. En desar podràs aplicar-la a tots els fitxers ja carregats o només
          als nous.
        </p>
        <div className={styles.inlineForm}>
          <input
            className={styles.input}
            inputMode="decimal"
            value={tarifaTxt}
            disabled={!canEdit || pending}
            onChange={(e) => setTarifaTxt(e.target.value)}
            aria-label="Tarifa hora amb decimals"
          />
          <span className={styles.muted}>€/h</span>
          {canEdit && (
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const v = Number(tarifaTxt.replace(/\s/g, "").replace(",", "."));
                  if (!Number.isFinite(v) || v <= 0) {
                    notify({
                      ok: false,
                      missatge: "Tarifa no vàlida (accepta decimals, p. ex. 14,5).",
                    });
                    return;
                  }
                  const tarifaFmt = v.toFixed(2).replace(".", ",");
                  if (!window.confirm(`Vols desar la tarifa ${tarifaFmt} €/h?`)) return;

                  const aplicarA = window.confirm(
                    `Vols aplicar ${tarifaFmt} €/h a TOTS els fitxers ja carregats?\n\nD'acord = sí, recalcular tots els moviments.\nCancel·lar = només als nous imports a partir d'ara.`
                  )
                    ? "tots"
                    : "nous";

                  const r = await updateTarifaHoraAction(v, aplicarA);
                  notify(r);
                  if (r.ok) setTarifaTxt(tarifaFmt);
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
            Format: A = text, B = codi centre, C = nom (opcional), D = SALA|CUINA (opcional; si
            falta s&apos;infereix del text). El mateix mapeig serveix per origen i destí.
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
        <h2 className={styles.cardTitle}>Mapeig text → centre + departament</h2>
        <p className={styles.helpText}>
          Coincideix el text sencer o la part abans de la coma (p. ex. mapeig «Orígens cuina» resol
          «Orígens cuina, Responsable…»). El departament ve del mapeig d&apos;origen.
        </p>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Text</th>
              <th>Centre</th>
              <th>Departament</th>
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
                  <td>
                    <select
                      className={styles.select}
                      value={editDept}
                      onChange={(e) => setEditDept(e.target.value as Dept)}
                    >
                      <option value="SALA">Sala</option>
                      <option value="CUINA">Cuina</option>
                    </select>
                  </td>
                  <td className={styles.rowActions}>
                    <button
                      type="button"
                      onClick={() =>
                        startTransition(async () => {
                          const r = await updateMapeigAction(
                            row.id,
                            editText,
                            editCentreId,
                            editDept
                          );
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
                  <td>{labelDept(row.departament)}</td>
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
                  <select
                    className={styles.select}
                    value={newRow.departament}
                    onChange={(e) => setNewRow({ ...newRow, departament: e.target.value as Dept })}
                  >
                    <option value="SALA">Sala</option>
                    <option value="CUINA">Cuina</option>
                  </select>
                </td>
                <td>
                  <Button
                    size="sm"
                    disabled={pending || !newRow.text || !newRow.centreId}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await createMapeigAction(
                          newRow.text,
                          newRow.centreId,
                          newRow.departament
                        );
                        notify(r);
                        if (r.ok) setNewRow({ text: "", centreId: "", departament: "SALA" });
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
