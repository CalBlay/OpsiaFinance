"use client";

import { Button } from "@/components/ui/Button";
import { Check, Pencil, Plus, Sparkles, Trash2, Upload, X } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
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

type DeptOpt = { id: string; codi: string; nom: string };
type CentreOpt = { id: string; codi: string; nom: string; departaments: DeptOpt[] };
type LnOpt = { id: string; codi: string; nom: string; centres: CentreOpt[] };

type Mapeig = {
  id: string;
  codi: string;
  text: string | null;
  departamentSalarial: "SALA" | "CUINA" | null;
  centre: {
    id: string;
    codi: string;
    nom: string;
    liniaNegociId: string;
    liniaNegoci: { id: string; codi: string; nom: string };
  };
  departament: { id: string; codi: string; nom: string } | null;
};

type DestForm = {
  codi: string;
  text: string;
  lnId: string;
  centreId: string;
  departamentId: string;
};

function etiquetaLn(ln: { codi: string; nom: string }) {
  return `${ln.codi} · ${ln.nom}`;
}

function etiquetaCentre(c: { codi: string; nom: string }) {
  return `${c.codi} · ${c.nom}`;
}

function etiquetaDept(d: { codi: string; nom: string }) {
  return `${d.codi} · ${d.nom}`;
}

function DestSelectors({
  arbre,
  value,
  onChange,
  disabled,
  ids,
}: {
  arbre: LnOpt[];
  value: Pick<DestForm, "lnId" | "centreId" | "departamentId">;
  onChange: (next: Pick<DestForm, "lnId" | "centreId" | "departamentId">) => void;
  disabled?: boolean;
  ids: { ln: string; centre: string; dept: string };
}) {
  const ln = arbre.find((l) => l.id === value.lnId) ?? null;
  const centres = ln?.centres ?? [];
  const centre = centres.find((c) => c.id === value.centreId) ?? null;
  const depts = centre?.departaments ?? [];

  return (
    <>
      <select
        id={ids.ln}
        className={styles.select}
        value={value.lnId}
        disabled={disabled}
        onChange={(e) => onChange({ lnId: e.target.value, centreId: "", departamentId: "" })}
      >
        <option value="">Línia…</option>
        {arbre.map((l) => (
          <option key={l.id} value={l.id}>
            {etiquetaLn(l)}
          </option>
        ))}
      </select>
      <select
        id={ids.centre}
        className={styles.select}
        value={value.centreId}
        disabled={disabled || !value.lnId}
        onChange={(e) => onChange({ ...value, centreId: e.target.value, departamentId: "" })}
      >
        <option value="">{value.lnId ? "Centre…" : "Tria LN…"}</option>
        {centres.map((c) => (
          <option key={c.id} value={c.id}>
            {etiquetaCentre(c)}
          </option>
        ))}
      </select>
      <select
        id={ids.dept}
        className={styles.select}
        value={value.departamentId}
        disabled={disabled || !value.centreId}
        onChange={(e) => onChange({ ...value, departamentId: e.target.value })}
      >
        <option value="">
          {!value.centreId
            ? "Tria centre…"
            : depts.length
              ? "Tot el centre (opcional)"
              : "Sense departaments"}
        </option>
        {depts.map((d) => (
          <option key={d.id} value={d.id}>
            {etiquetaDept(d)}
          </option>
        ))}
      </select>
    </>
  );
}

export function CostPersonalCentreSettingsPanel({
  mapeigs,
  arbre,
  canEdit,
  initialFeedback = null,
}: {
  mapeigs: Mapeig[];
  arbre: LnOpt[];
  canEdit: boolean;
  initialFeedback?: { ok: boolean; missatge: string } | null;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; missatge: string } | null>(
    initialFeedback
  );
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<DestForm>({
    codi: "",
    text: "",
    lnId: "",
    centreId: "",
    departamentId: "",
  });
  const [newRow, setNewRow] = useState<DestForm>({
    codi: "",
    text: "",
    lnId: "",
    centreId: "",
    departamentId: "",
  });
  const [substituirTot, setSubstituirTot] = useState(false);
  const [substituirAuto, setSubstituirAuto] = useState(false);
  const [autoNom, setAutoNom] = useState<string | null>(null);
  const [importNom, setImportNom] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const autoRef = useRef<HTMLInputElement>(null);

  const nDepts = useMemo(
    () => arbre.reduce((a, l) => a + l.centres.reduce((b, c) => b + c.departaments.length, 0), 0),
    [arbre]
  );

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
            Hi ha <strong>{mapeigs.length}</strong> mapeigs. L&apos;arbre de Dimensions té{" "}
            <strong>{nDepts}</strong> departaments disponibles per enllaçar.
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
            El servidor llegeix <code>Cost_Personal_*.xlsx</code> i el creua amb els{" "}
            <strong>centres</strong> (i, si pot, departaments) de Dimensions. Els codis de 8 dígits
            cal revisar-los a la taula: LN → centre → departament.
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
            (opcional). Per departaments de l&apos;arbre, usa la taula de sota.
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
        <h2 className={styles.cardTitle}>Mapeig codi → LN · centre · departament</h2>
        <p className={styles.helpText}>
          Tria la línia, després el centre i (si cal) el departament de l&apos;arbre. El departament
          és opcional: si el deixes buit, el cost s&apos;agrega al centre sencer.
        </p>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Codi</th>
              <th>Text</th>
              <th>Línia</th>
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
                      value={editForm.codi}
                      onChange={(e) => setEditForm({ ...editForm, codi: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.input}
                      value={editForm.text}
                      onChange={(e) => setEditForm({ ...editForm, text: e.target.value })}
                    />
                  </td>
                  <td colSpan={3}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                      <DestSelectors
                        arbre={arbre}
                        value={editForm}
                        onChange={(next) => setEditForm({ ...editForm, ...next })}
                        disabled={pending}
                        ids={{
                          ln: `edit-ln-${row.id}`,
                          centre: `edit-centre-${row.id}`,
                          dept: `edit-dept-${row.id}`,
                        }}
                      />
                    </div>
                  </td>
                  <td className={styles.rowActions}>
                    <button
                      type="button"
                      title="Desar"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          notify(
                            await updateMapeigCostPersonalAction({
                              id: row.id,
                              codi: editForm.codi,
                              text: editForm.text,
                              liniaNegociId: editForm.lnId,
                              centreId: editForm.centreId,
                              departamentId: editForm.departamentId || null,
                            })
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
                  <td>{etiquetaLn(row.centre.liniaNegoci)}</td>
                  <td>{etiquetaCentre(row.centre)}</td>
                  <td>{row.departament ? etiquetaDept(row.departament) : "— (tot el centre)"}</td>
                  {canEdit && (
                    <td className={styles.rowActions}>
                      <button
                        type="button"
                        title="Editar"
                        onClick={() => {
                          setEditId(row.id);
                          setEditForm({
                            codi: row.codi,
                            text: row.text ?? "",
                            lnId: row.centre.liniaNegociId,
                            centreId: row.centre.id,
                            departamentId: row.departament?.id ?? "",
                          });
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
                    placeholder="04043005"
                    value={newRow.codi}
                    onChange={(e) => setNewRow({ ...newRow, codi: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className={styles.input}
                    placeholder="ASSEMBLATGE…"
                    value={newRow.text}
                    onChange={(e) => setNewRow({ ...newRow, text: e.target.value })}
                  />
                </td>
                <td colSpan={3}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                    <DestSelectors
                      arbre={arbre}
                      value={newRow}
                      onChange={(next) => setNewRow({ ...newRow, ...next })}
                      disabled={pending}
                      ids={{ ln: "new-ln", centre: "new-centre", dept: "new-dept" }}
                    />
                  </div>
                </td>
                <td>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await createMapeigCostPersonalAction({
                          codi: newRow.codi,
                          text: newRow.text,
                          liniaNegociId: newRow.lnId,
                          centreId: newRow.centreId,
                          departamentId: newRow.departamentId || null,
                        });
                        notify(r);
                        if (r.ok) {
                          setNewRow({
                            codi: "",
                            text: "",
                            lnId: "",
                            centreId: "",
                            departamentId: "",
                          });
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
            Encara no hi ha mapeigs. Usa «Generar mapeig automàtic» per als centres, o afegeix files
            amb LN → centre → departament.
          </p>
        )}
      </section>
    </div>
  );
}
