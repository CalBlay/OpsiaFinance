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

type DeptOpt = { id: string; codi: string; nom: string };
type CentreOpt = { id: string; codi: string; nom: string; departaments: DeptOpt[] };
type LnOpt = { id: string; codi: string; nom: string; centres: CentreOpt[] };

type Mapeig = {
  id: string;
  text: string;
  departament: "SALA" | "CUINA";
  centre: {
    id: string;
    codi: string;
    nom: string;
    liniaNegociId: string;
    liniaNegoci: { id: string; codi: string; nom: string };
  };
  departamentArbre: { id: string; codi: string; nom: string } | null;
};

type DestForm = {
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

export function TraspassPersonalSettingsPanel({
  tarifaHora,
  mapeigs,
  arbre,
  canEdit,
}: {
  tarifaHora: number;
  mapeigs: Mapeig[];
  arbre: LnOpt[];
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; missatge: string } | null>(null);
  const [tarifaTxt, setTarifaTxt] = useState(Number(tarifaHora).toFixed(2).replace(".", ","));
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<DestForm>({
    text: "",
    lnId: "",
    centreId: "",
    departamentId: "",
  });
  const [newRow, setNewRow] = useState<DestForm>({
    text: "",
    lnId: "",
    centreId: "",
    departamentId: "",
  });
  const [substituirTot, setSubstituirTot] = useState(false);
  const [importNom, setImportNom] = useState<string | null>(null);
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
      if (r.ok) {
        if (importRef.current) importRef.current.value = "";
        setImportNom(null);
      }
    });
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
          <h2 className={styles.cardTitle}>Importar mapeig des d&apos;Excel (manual)</h2>
          <p className={styles.helpText}>
            Format: A = text, B = codi centre Opsia, C = nom (opcional), D = SALA|CUINA o codi
            departament (opcional). Per LN → centre → departament de l&apos;arbre, usa la taula de
            sota.
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
        <h2 className={styles.cardTitle}>Mapeig text → LN · centre · departament</h2>
        <p className={styles.helpText}>
          Tria la línia, després el centre i (si cal) el departament de l&apos;arbre. Coincideix el
          text sencer o la part abans de la coma (p. ex. mapeig «Orígens cuina» resol «Orígens
          cuina, Responsable…»). El departament és opcional: si el deixes buit, s&apos;agrega al
          centre sencer.
        </p>
        <table className={styles.table}>
          <thead>
            <tr>
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
                          const r = await updateMapeigAction({
                            id: row.id,
                            text: editForm.text,
                            liniaNegociId: editForm.lnId,
                            centreId: editForm.centreId,
                            departamentId: editForm.departamentId || null,
                          });
                          notify(r);
                          if (r.ok) setEditId(null);
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
                  <td>{row.text}</td>
                  <td>{etiquetaLn(row.centre.liniaNegoci)}</td>
                  <td>{etiquetaCentre(row.centre)}</td>
                  <td>
                    {row.departamentArbre
                      ? etiquetaDept(row.departamentArbre)
                      : "— (tot el centre)"}
                  </td>
                  {canEdit && (
                    <td className={styles.rowActions}>
                      <button
                        type="button"
                        title="Editar"
                        onClick={() => {
                          setEditId(row.id);
                          setEditForm({
                            text: row.text,
                            lnId: row.centre.liniaNegociId,
                            centreId: row.centre.id,
                            departamentId: row.departamentArbre?.id ?? "",
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
                            if (!confirm(`Eliminar mapeig «${row.text}»?`)) return;
                            notify(await deleteMapeigAction(row.id));
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
                    placeholder="Nou text…"
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
                    disabled={pending || !newRow.text || !newRow.centreId}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await createMapeigAction({
                          text: newRow.text,
                          liniaNegociId: newRow.lnId,
                          centreId: newRow.centreId,
                          departamentId: newRow.departamentId || null,
                        });
                        notify(r);
                        if (r.ok) {
                          setNewRow({ text: "", lnId: "", centreId: "", departamentId: "" });
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
            Encara no hi ha mapeigs. Afegeix files amb LN → centre → departament, o importa un
            Excel.
          </p>
        )}
      </section>

      {feedback && (
        <p className={feedback.ok ? styles.feedbackOk : styles.feedbackErr}>{feedback.missatge}</p>
      )}
    </div>
  );
}
