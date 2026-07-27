"use client";

import { Check, Pencil, X as XIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import styles from "./LiniaNegociEditor.module.css";
import { updateLiniaNegociImportAction } from "./linia-negoci-actions";

export type LnOption = { id: string; codi: string; nom: string };

interface LiniaNegociEditorProps {
  importId: string;
  liniaNegociId: string | null;
  liniaLabel: string | null;
  linies: LnOption[];
  canEdit: boolean;
}

export function LiniaNegociEditor({
  importId,
  liniaNegociId,
  liniaLabel,
  linies,
  canEdit,
}: LiniaNegociEditorProps) {
  const [currentId, setCurrentId] = useState(liniaNegociId);
  const [editing, setEditing] = useState(!liniaNegociId && canEdit);
  const [selected, setSelected] = useState(liniaNegociId ?? "");
  const [label, setLabel] = useState(liniaLabel);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setCurrentId(liniaNegociId);
    setLabel(liniaLabel);
    if (!liniaNegociId && canEdit) setEditing(true);
  }, [liniaNegociId, liniaLabel, canEdit]);

  function startEdit() {
    setSelected(currentId ?? "");
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setSelected(currentId ?? "");
    setError(null);
    setEditing(false);
  }

  function save() {
    if (!selected) {
      setError("Selecciona una línia de negoci.");
      return;
    }
    if (selected === currentId) {
      setEditing(false);
      return;
    }

    startTransition(async () => {
      const res = await updateLiniaNegociImportAction(importId, selected);
      if (res.ok) {
        const ln = linies.find((l) => l.id === selected);
        setCurrentId(selected);
        setLabel(ln ? `${ln.codi} · ${ln.nom}` : null);
        setEditing(false);
        setError(null);
      } else {
        setError(res.missatge);
      }
    });
  }

  if (!canEdit) {
    return (
      <span className={styles.value}>
        {label ?? <em className={styles.noData}>Sense assignar</em>}
      </span>
    );
  }

  if (editing) {
    return (
      <div className={styles.editWrap}>
        <select
          className={styles.select}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={isPending}
        >
          <option value="">Selecciona una LN…</option>
          {linies.map((ln) => (
            <option key={ln.id} value={ln.id}>
              {ln.codi} · {ln.nom}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.editBtn}
          onClick={save}
          disabled={isPending}
          aria-label="Guardar"
        >
          <Check size={14} />
        </button>
        {currentId && (
          <button
            type="button"
            className={styles.editBtnCancel}
            onClick={cancel}
            disabled={isPending}
            aria-label="Cancel·lar"
          >
            <XIcon size={14} />
          </button>
        )}
        {error && <span className={styles.error}>{error}</span>}
      </div>
    );
  }

  return (
    <span className={styles.wrap}>
      <span className={styles.value}>
        {label ?? <em className={styles.noData}>Sense assignar</em>}
      </span>
      <button
        type="button"
        className={styles.editTrigger}
        onClick={startEdit}
        aria-label="Editar línia de negoci"
      >
        <Pencil size={13} />
      </button>
    </span>
  );
}
