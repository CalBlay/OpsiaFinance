"use client";

import { Button } from "@/components/ui/Button";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import styles from "../traspass-personal/page.module.css";
import {
  createMapeigBalancEsdevenimentsAction,
  deleteMapeigBalancEsdevenimentsAction,
  updateMapeigBalancEsdevenimentsAction,
} from "./actions";

type CentreOpt = { id: string; codi: string; nom: string };
type LnOpt = { id: string; codi: string; nom: string; centres: CentreOpt[] };

type Mapeig = {
  id: string;
  text: string;
  centre: {
    id: string;
    codi: string;
    nom: string;
    liniaNegociId: string;
    liniaNegoci: { id: string; codi: string; nom: string };
  };
};

type DestForm = {
  text: string;
  lnId: string;
  centreId: string;
};

function etiquetaLn(ln: { codi: string; nom: string }) {
  return `${ln.codi} · ${ln.nom}`;
}

function etiquetaCentre(c: { codi: string; nom: string }) {
  return `${c.codi} · ${c.nom}`;
}

function DestSelectors({
  arbre,
  value,
  onChange,
  disabled,
  ids,
}: {
  arbre: LnOpt[];
  value: Pick<DestForm, "lnId" | "centreId">;
  onChange: (next: Pick<DestForm, "lnId" | "centreId">) => void;
  disabled?: boolean;
  ids: { ln: string; centre: string };
}) {
  const ln = arbre.find((l) => l.id === value.lnId) ?? null;
  const centres = ln?.centres ?? [];

  return (
    <>
      <select
        id={ids.ln}
        className={styles.select}
        value={value.lnId}
        disabled={disabled}
        onChange={(e) => onChange({ lnId: e.target.value, centreId: "" })}
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
        onChange={(e) => onChange({ ...value, centreId: e.target.value })}
      >
        <option value="">{value.lnId ? "Centre…" : "Tria LN…"}</option>
        {centres.map((c) => (
          <option key={c.id} value={c.id}>
            {etiquetaCentre(c)}
          </option>
        ))}
      </select>
    </>
  );
}

export function BalancEsdevenimentsSettingsPanel({
  mapeigs,
  arbre,
  canEdit,
}: {
  mapeigs: Mapeig[];
  arbre: LnOpt[];
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; missatge: string } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<DestForm>({ text: "", lnId: "", centreId: "" });
  const [newRow, setNewRow] = useState<DestForm>({ text: "", lnId: "", centreId: "" });

  const notify = (r: { ok: boolean; missatge: string }) => {
    setFeedback(r);
    if (r.ok) setTimeout(() => setFeedback(null), 6000);
  };

  return (
    <div className={styles.stack}>
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Mapeig text A2 → centre</h2>
        <p className={styles.helpText}>
          El balanç porta a la fila 2 el nom del centre (p.ex. <code>ESPAIS</code>). Mapega&apos;l
          al centre Opsia on volen entrar els ajustos «Regularització» (p.ex. Events empresa). Tots
          els imports del fitxer van a aquest centre.
        </p>

        {feedback ? (
          <output className={feedback.ok ? styles.muted : undefined}>{feedback.missatge}</output>
        ) : null}

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Text (A2)</th>
              <th>Línia</th>
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
                      value={editForm.text}
                      onChange={(e) => setEditForm({ ...editForm, text: e.target.value })}
                    />
                  </td>
                  <td colSpan={2}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                      <DestSelectors
                        arbre={arbre}
                        value={editForm}
                        onChange={(next) => setEditForm({ ...editForm, ...next })}
                        disabled={pending}
                        ids={{ ln: `edit-ln-${row.id}`, centre: `edit-centre-${row.id}` }}
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
                          const r = await updateMapeigBalancEsdevenimentsAction({
                            id: row.id,
                            text: editForm.text,
                            liniaNegociId: editForm.lnId,
                            centreId: editForm.centreId,
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
                          });
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        title="Eliminar"
                        disabled={pending}
                        onClick={() => {
                          if (!window.confirm(`Eliminar mapeig «${row.text}»?`)) return;
                          startTransition(async () => {
                            notify(await deleteMapeigBalancEsdevenimentsAction(row.id));
                          });
                        }}
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
                    placeholder="ESPAIS"
                    value={newRow.text}
                    onChange={(e) => setNewRow({ ...newRow, text: e.target.value })}
                  />
                </td>
                <td colSpan={2}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                    <DestSelectors
                      arbre={arbre}
                      value={newRow}
                      onChange={(next) => setNewRow({ ...newRow, ...next })}
                      disabled={pending}
                      ids={{ ln: "new-ln", centre: "new-centre" }}
                    />
                  </div>
                </td>
                <td className={styles.rowActions}>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await createMapeigBalancEsdevenimentsAction({
                          text: newRow.text,
                          liniaNegociId: newRow.lnId,
                          centreId: newRow.centreId,
                        });
                        notify(r);
                        if (r.ok) setNewRow({ text: "", lnId: "", centreId: "" });
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
        {mapeigs.length === 0 && !canEdit && (
          <p className={styles.muted}>Encara no hi ha cap mapeig.</p>
        )}
      </section>
    </div>
  );
}
