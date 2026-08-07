"use client";

import { Button } from "@/components/ui/Button";
import { Check, Pencil, Plus, Sparkles, Trash2, Upload, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import styles from "../traspass-personal/page.module.css";
import {
  createMapeigCostPersonalAction,
  deleteMapeigCostPersonalAction,
  esborrarTotMapeigCostPersonalAction,
  generarMapeigAutoDesDePayrollAction,
  generarMapeigDesDeFitxerLocalAction,
  importarMapeigCostPersonalExcelAction,
  updateMapeigCostPersonalAction,
} from "./actions";

type CentreOpt = { id: string; codi: string; nom: string };
type Dept = "SALA" | "CUINA" | "";
type Mapeig = {
  id: string;
  codi: string;
  text: string | null;
  departamentSalarial: "SALA" | "CUINA" | null;
  centre: CentreOpt;
};

function labelDept(d: "SALA" | "CUINA" | null) {
  if (d === "CUINA") return "Cuina";
  if (d === "SALA") return "Sala";
  return "—";
}

export function CostPersonalCentreSettingsPanel({
  mapeigs,
  centres,
  canEdit,
  initialFeedback = null,
}: {
  mapeigs: Mapeig[];
  centres: CentreOpt[];
  canEdit: boolean;
  initialFeedback?: { ok: boolean; missatge: string } | null;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; missatge: string } | null>(
    initialFeedback
  );
  const [editId, setEditId] = useState<string | null>(null);
  const [editCodi, setEditCodi] = useState("");
  const [editText, setEditText] = useState("");
  const [editCentreId, setEditCentreId] = useState("");
  const [editDept, setEditDept] = useState<Dept>("");
  const [newRow, setNewRow] = useState<{
    codi: string;
    text: string;
    centreId: string;
    departament: Dept;
  }>({ codi: "", text: "", centreId: "", departament: "" });
  const [substituirTot, setSubstituirTot] = useState(false);
  const [substituirAuto, setSubstituirAuto] = useState(false);
  const [autoNom, setAutoNom] = useState<string | null>(null);
  const [importNom, setImportNom] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const autoRef = useRef<HTMLInputElement>(null);

  const notify = (r: { ok: boolean; missatge: string }) => {
    setFeedback(r);
    if (r.ok) setTimeout(() => setFeedback(null), 10000);
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
      const r = await importarMapeigCostPersonalExcelAction(fd);
      notify(r);
      if (r.ok) {
        if (importRef.current) importRef.current.value = "";
        setImportNom(null);
      }
    });
  };

  const generarAuto = () => {
    const file = autoRef.current?.files?.[0];
    if (!file) {
      notify({ ok: false, missatge: "Selecciona el llistat de costos (payroll)." });
      return;
    }
    const fd = new FormData();
    fd.set("fitxer", file);
    fd.set("substituirTot", String(substituirAuto));
    startTransition(async () => {
      const r = await generarMapeigAutoDesDePayrollAction(fd);
      notify(r);
      if (r.ok) {
        if (autoRef.current) autoRef.current.value = "";
        setAutoNom(null);
      }
    });
  };

  return (
    <div className={styles.stack}>
      {feedback && (
        <p className={feedback.ok ? styles.feedbackOk : styles.feedbackErr}>{feedback.missatge}</p>
      )}

      {canEdit && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Esborrar mapeig</h2>
          <p className={styles.helpText}>
            Hi ha <strong>{mapeigs.length}</strong> mapeigs. Esborra&apos;ls tots per tornar a
            configurar-los manualment.
          </p>
          <div className={styles.fileRow}>
            <Button
              size="sm"
              disabled={pending || mapeigs.length === 0}
              onClick={() => {
                if (
                  !confirm(
                    mapeigs.length
                      ? `Segur que vols esborrar els ${mapeigs.length} mapeigs?`
                      : "No hi ha mapeigs."
                  )
                ) {
                  return;
                }
                startTransition(async () => {
                  notify(await esborrarTotMapeigCostPersonalAction());
                });
              }}
            >
              <Trash2 size={14} /> Esborrar tot el mapeig ({mapeigs.length})
            </Button>
          </div>
        </section>
      )}

      {canEdit && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Generar mapeig automàtic</h2>
          <p className={styles.helpText}>
            El servidor llegeix <code>Cost_Personal_*.xlsx</code> de l&apos;arrel del projecte i el
            creua amb els centres de Dimensions (només codis/textos, sense imports). També pots
            pujar un altre Excel.
          </p>
          <div className={styles.fileRow}>
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  notify(await generarMapeigDesDeFitxerLocalAction(true));
                })
              }
            >
              <Sparkles size={14} /> Regenerar des del fitxer del projecte
            </Button>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={substituirAuto}
                onChange={(e) => setSubstituirAuto(e.target.checked)}
              />
              Substituir tot (en pujar)
            </label>
          </div>
          <div className={styles.fileRow}>
            <input
              ref={autoRef}
              type="file"
              accept=".xlsx,.xls"
              className={styles.fileInputHidden}
              onChange={(e) => setAutoNom(e.target.files?.[0]?.name ?? null)}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => autoRef.current?.click()}
            >
              <Upload size={14} /> Triar un altre Excel…
            </Button>
            <span className={styles.fileName}>{autoNom ?? "Cap fitxer seleccionat"}</span>
            <Button size="sm" disabled={pending || !autoNom} onClick={generarAuto}>
              <Sparkles size={14} /> Generar del fitxer triat
            </Button>
          </div>
        </section>
      )}

      {canEdit && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Importar mapeig des d&apos;Excel (manual)</h2>
          <p className={styles.helpText}>
            Format: A = codi payroll, B = codi centre Opsia, C = text (opcional), D = SALA|CUINA
            (opcional, restaurants).
          </p>
          <div className={styles.fileRow}>
            <input
              ref={importRef}
              type="file"
              accept=".xlsx,.xls"
              className={styles.fileInputHidden}
              onChange={(e) => setImportNom(e.target.files?.[0]?.name ?? null)}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => importRef.current?.click()}
            >
              <Upload size={14} /> Triar fitxer Excel…
            </Button>
            <span className={styles.fileName}>{importNom ?? "Cap fitxer seleccionat"}</span>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={substituirTot}
                onChange={(e) => setSubstituirTot(e.target.checked)}
              />
              Substituir tot
            </label>
            <Button size="sm" disabled={pending || !importNom} onClick={importarExcel}>
              <Upload size={14} /> Importar
            </Button>
          </div>
        </section>
      )}

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Mapeig codi → centre</h2>
        <p className={styles.helpText}>
          Cada codi del llistat de costos (payroll) es resol contra aquesta taula. El departament
          Sala/Cuina només cal als restaurants (sincronitza cost salarial).
        </p>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Codi</th>
              <th>Text</th>
              <th>Centre</th>
              <th>Dept.</th>
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
                      value={editCodi}
                      onChange={(e) => setEditCodi(e.target.value)}
                    />
                  </td>
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
                      <option value="">—</option>
                      <option value="SALA">Sala</option>
                      <option value="CUINA">Cuina</option>
                    </select>
                  </td>
                  <td className={styles.rowActions}>
                    <button
                      type="button"
                      title="Desar"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          notify(
                            await updateMapeigCostPersonalAction(
                              row.id,
                              editCodi,
                              editCentreId,
                              editText,
                              editDept
                            )
                          );
                          setEditId(null);
                        })
                      }
                    >
                      <Check size={16} />
                    </button>
                    <button type="button" title="Cancel·lar" onClick={() => setEditId(null)}>
                      <X size={16} />
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={row.id}>
                  <td>
                    <code>{row.codi}</code>
                  </td>
                  <td>{row.text ?? "—"}</td>
                  <td>
                    {row.centre.codi} · {row.centre.nom}
                  </td>
                  <td>{labelDept(row.departamentSalarial)}</td>
                  {canEdit && (
                    <td className={styles.rowActions}>
                      <button
                        type="button"
                        title="Editar"
                        onClick={() => {
                          setEditId(row.id);
                          setEditCodi(row.codi);
                          setEditText(row.text ?? "");
                          setEditCentreId(row.centre.id);
                          setEditDept(row.departamentSalarial ?? "");
                        }}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        title="Eliminar"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            if (!confirm(`Eliminar mapeig ${row.codi}?`)) return;
                            notify(await deleteMapeigCostPersonalAction(row.id));
                          })
                        }
                      >
                        <Trash2 size={15} />
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
                    placeholder="02001"
                    value={newRow.codi}
                    onChange={(e) => setNewRow({ ...newRow, codi: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className={styles.input}
                    placeholder="ADMINISTRACIO…"
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
                    <option value="">Centre…</option>
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
                    <option value="">—</option>
                    <option value="SALA">Sala</option>
                    <option value="CUINA">Cuina</option>
                  </select>
                </td>
                <td>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await createMapeigCostPersonalAction(
                          newRow.codi,
                          newRow.centreId,
                          newRow.text,
                          newRow.departament
                        );
                        notify(r);
                        if (r.ok) {
                          setNewRow({ codi: "", text: "", centreId: "", departament: "" });
                        }
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
        {!mapeigs.length && (
          <p className={styles.muted} style={{ marginTop: "0.75rem" }}>
            Encara no hi ha mapeigs. Usa «Generar mapeig automàtic» amb el fitxer payroll, o afegeix
            files manualment.
          </p>
        )}
      </section>
    </div>
  );
}
