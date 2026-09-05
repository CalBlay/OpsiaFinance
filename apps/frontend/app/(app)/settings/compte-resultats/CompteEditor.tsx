"use client";

import { esSubtotalPresentacio } from "@/lib/compte-subtotals";
import {
  NATURA_CONCEPTE_LABELS,
  NATURA_CONCEPTE_VALUES,
  type NaturaConcepte,
  PCT_VARIABLE_MIXTE_DEFECTE,
} from "@/lib/natura-concepte";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, ChevronUp, Eye, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import {
  createConcepteAction,
  deleteConcepteAction,
  moveConcepteAction,
  toggleConcepteAction,
  updateConcepteAction,
  updateNaturaAction,
} from "./actions";
import styles from "./page.module.css";

type Result = { ok: boolean; missatge: string };

export interface ConcepteDTO {
  id: string;
  node: number;
  descripcio: string;
  esSubtotal: boolean;
  isActive: boolean;
  natura: NaturaConcepte | null;
  pctVariable: number | null;
}

export function CompteEditor({ concepts, canEdit }: { concepts: ConcepteDTO[]; canEdit: boolean }) {
  const [feedback, setFeedback] = useState<Result | null>(null);
  const [adding, setAdding] = useState(false);

  const notify = (r: Result) => {
    setFeedback(r);
    if (r.ok && r.missatge) setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <>
      {feedback && (
        <div className={cn(styles.feedback, feedback.ok ? styles.feedbackOk : styles.feedbackErr)}>
          {feedback.missatge}
        </div>
      )}

      <div className={styles.list}>
        <div className={styles.rowHead}>
          <span className={styles.colNode}>Node</span>
          <span className={styles.colDesc}>Descripció</span>
          <span className={styles.colNatura}>Natura</span>
          <span className={styles.colTipus}>Tipus</span>
          {canEdit && <span className={styles.colActions} />}
        </div>

        {concepts.map((c, i) => (
          <ConcepteRow
            key={c.id}
            concepte={c}
            canEdit={canEdit}
            isFirst={i === 0}
            isLast={i === concepts.length - 1}
            notify={notify}
          />
        ))}

        {canEdit &&
          (adding ? (
            <AddConcepte
              onCancel={() => setAdding(false)}
              notify={notify}
              onDone={() => setAdding(false)}
            />
          ) : (
            <div className={styles.addRow}>
              <button type="button" className={styles.addTrigger} onClick={() => setAdding(true)}>
                <Plus size={14} /> Afegir concepte
              </button>
            </div>
          ))}
      </div>
    </>
  );
}

function NaturaSelect({
  value,
  disabled,
  onChange,
}: {
  value: NaturaConcepte | null;
  disabled?: boolean;
  onChange: (v: NaturaConcepte | null) => void;
}) {
  return (
    <select
      className={styles.naturaSelect}
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === "" ? null : (e.target.value as NaturaConcepte))}
      aria-label="Natura del concepte"
    >
      <option value="">—</option>
      {NATURA_CONCEPTE_VALUES.map((v) => (
        <option key={v} value={v}>
          {NATURA_CONCEPTE_LABELS[v]}
        </option>
      ))}
    </select>
  );
}

function PctMixteEditor({
  pctVariable,
  disabled,
  onCommit,
}: {
  pctVariable: number;
  disabled?: boolean;
  onCommit: (pct: number) => void;
}) {
  const [txt, setTxt] = useState(String(pctVariable));
  const pctFix = 100 - pctVariable;

  return (
    <div className={styles.mixteBox}>
      <label className={styles.mixteLabel} title="Percentatge variable">
        <input
          className={styles.pctInput}
          type="number"
          min={0}
          max={100}
          step={1}
          disabled={disabled}
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          onBlur={() => {
            const n = Number.parseInt(txt, 10);
            const pct = Number.isNaN(n)
              ? PCT_VARIABLE_MIXTE_DEFECTE
              : Math.min(100, Math.max(0, n));
            setTxt(String(pct));
            if (pct !== pctVariable) onCommit(pct);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          aria-label="Percentatge variable"
        />
        <span>% var</span>
      </label>
      <span className={styles.mixteFixHint}>{pctFix}% fix</span>
    </div>
  );
}

function NaturaBadge({
  value,
  pctVariable,
}: {
  value: NaturaConcepte | null;
  pctVariable: number | null;
}) {
  if (!value) return <span className={styles.tagNaturaEmpty}>—</span>;
  const cls =
    value === "INGRES"
      ? styles.naturaIngres
      : value === "VARIABLE"
        ? styles.naturaVariable
        : value === "FIX"
          ? styles.naturaFix
          : value === "MIXTE"
            ? styles.naturaMixte
            : styles.naturaAlie;
  const extra = value === "MIXTE" && pctVariable != null ? ` · ${pctVariable}% var` : "";
  return (
    <span className={cn(styles.tagNatura, cls)}>
      {NATURA_CONCEPTE_LABELS[value]}
      {extra}
    </span>
  );
}

function ConcepteRow({
  concepte,
  canEdit,
  isFirst,
  isLast,
  notify,
}: {
  concepte: ConcepteDTO;
  canEdit: boolean;
  isFirst: boolean;
  isLast: boolean;
  notify: (r: Result) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(concepte.descripcio);
  const [esSubtotal, setEsSubtotal] = useState(concepte.esSubtotal);
  const [natura, setNatura] = useState<NaturaConcepte | null>(concepte.natura);
  const [pctVariable, setPctVariable] = useState(
    concepte.pctVariable ?? PCT_VARIABLE_MIXTE_DEFECTE
  );
  const [isPending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const r = await updateConcepteAction(
        concepte.id,
        desc,
        esSubtotal,
        natura,
        natura === "MIXTE" ? pctVariable : null
      );
      notify(r);
      if (r.ok) setEditing(false);
    });

  const run = (fn: () => Promise<Result>) => startTransition(async () => notify(await fn()));

  const onNaturaQuick = (v: NaturaConcepte | null) => {
    setNatura(v);
    const pct = v === "MIXTE" ? pctVariable || PCT_VARIABLE_MIXTE_DEFECTE : null;
    if (v === "MIXTE") setPctVariable(pct ?? PCT_VARIABLE_MIXTE_DEFECTE);
    startTransition(async () => {
      notify(await updateNaturaAction(concepte.id, v, pct));
    });
  };

  const onPctQuick = (pct: number) => {
    setPctVariable(pct);
    startTransition(async () => {
      notify(await updateNaturaAction(concepte.id, "MIXTE", pct));
    });
  };

  const mostrarSubtotal = esSubtotalPresentacio(concepte.node, concepte.esSubtotal);

  return (
    <div
      className={cn(
        styles.row,
        mostrarSubtotal && styles.rowSubtotal,
        !concepte.isActive && styles.rowInactive
      )}
    >
      <span className={styles.colNode}>{concepte.node}</span>

      {editing ? (
        <div className={styles.colDesc}>
          <div className={styles.editRow}>
            <input
              className={styles.editInput}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setEditing(false);
              }}
            />
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={esSubtotal}
                onChange={(e) => {
                  setEsSubtotal(e.target.checked);
                  if (e.target.checked) setNatura(null);
                }}
              />
              subtotal
            </label>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={save}
              disabled={isPending}
              title="Desa"
            >
              <Check size={15} className="text-green-700" />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setEditing(false)}
              disabled={isPending}
              title="Cancel·la"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      ) : (
        <span className={cn(styles.colDesc, styles.desc)}>{concepte.descripcio}</span>
      )}

      <span className={styles.colNatura}>
        {mostrarSubtotal ? (
          <span className={styles.tagNaturaEmpty}>—</span>
        ) : canEdit && !editing ? (
          <div className={styles.naturaCell}>
            <NaturaSelect value={natura} disabled={isPending} onChange={onNaturaQuick} />
            {natura === "MIXTE" && (
              <PctMixteEditor
                pctVariable={pctVariable}
                disabled={isPending}
                onCommit={onPctQuick}
              />
            )}
          </div>
        ) : editing ? (
          <div className={styles.naturaCell}>
            <NaturaSelect
              value={natura}
              disabled={esSubtotal || isPending}
              onChange={(v) => {
                setNatura(v);
                if (v === "MIXTE" && !pctVariable) setPctVariable(PCT_VARIABLE_MIXTE_DEFECTE);
              }}
            />
            {natura === "MIXTE" && !esSubtotal && (
              <PctMixteEditor
                pctVariable={pctVariable}
                disabled={isPending}
                onCommit={setPctVariable}
              />
            )}
          </div>
        ) : (
          <NaturaBadge value={concepte.natura} pctVariable={concepte.pctVariable} />
        )}
      </span>

      {!editing && (
        <span className={styles.colTipus}>
          <span className={mostrarSubtotal ? styles.tagSubtotal : styles.tagDetall}>
            {mostrarSubtotal ? "Subtotal" : "Detall"}
          </span>
          {!concepte.isActive && <span className={styles.tagInactiu}>inactiu</span>}
        </span>
      )}

      {canEdit && !editing && (
        <span className={styles.colActions}>
          <button
            type="button"
            className={styles.iconBtn}
            title="Puja"
            disabled={isFirst || isPending}
            onClick={() => run(() => moveConcepteAction(concepte.id, "up"))}
          >
            <ChevronUp size={15} />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            title="Baixa"
            disabled={isLast || isPending}
            onClick={() => run(() => moveConcepteAction(concepte.id, "down"))}
          >
            <ChevronDown size={15} />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            title="Edita"
            onClick={() => setEditing(true)}
            disabled={isPending}
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            title={concepte.isActive ? "Desactiva" : "Activa"}
            onClick={() => run(() => toggleConcepteAction(concepte.id, !concepte.isActive))}
            disabled={isPending}
          >
            {concepte.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button
            type="button"
            className={cn(styles.iconBtn, styles.iconDanger)}
            title="Elimina"
            onClick={() => {
              if (confirm(`Eliminar "${concepte.descripcio}"?`))
                run(() => deleteConcepteAction(concepte.id));
            }}
            disabled={isPending}
          >
            <Trash2 size={13} />
          </button>
        </span>
      )}
    </div>
  );
}

function AddConcepte({
  onCancel,
  onDone,
  notify,
}: {
  onCancel: () => void;
  onDone: () => void;
  notify: (r: Result) => void;
}) {
  const [node, setNode] = useState("");
  const [desc, setDesc] = useState("");
  const [esSubtotal, setEsSubtotal] = useState(false);
  const [natura, setNatura] = useState<NaturaConcepte | null>(null);
  const [pctVariable, setPctVariable] = useState(PCT_VARIABLE_MIXTE_DEFECTE);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    const n = Number.parseInt(node, 10);
    if (Number.isNaN(n) || !desc.trim()) return;
    startTransition(async () => {
      const r = await createConcepteAction(
        n,
        desc,
        esSubtotal,
        natura,
        natura === "MIXTE" ? pctVariable : null
      );
      notify(r);
      if (r.ok) onDone();
    });
  };

  return (
    <div className={cn(styles.row, styles.rowAdd)}>
      <input
        className={cn(styles.editInput, styles.nodeInput)}
        placeholder="Node"
        value={node}
        onChange={(e) => setNode(e.target.value)}
      />
      <div className={styles.editRow} style={{ flex: 1 }}>
        <input
          className={styles.editInput}
          placeholder="Descripció del concepte"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") onCancel();
          }}
        />
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={esSubtotal}
            onChange={(e) => {
              setEsSubtotal(e.target.checked);
              if (e.target.checked) setNatura(null);
            }}
          />
          subtotal
        </label>
        {!esSubtotal && (
          <>
            <NaturaSelect
              value={natura}
              disabled={isPending}
              onChange={(v) => {
                setNatura(v);
                if (v === "MIXTE") setPctVariable(PCT_VARIABLE_MIXTE_DEFECTE);
              }}
            />
            {natura === "MIXTE" && (
              <PctMixteEditor
                pctVariable={pctVariable}
                disabled={isPending}
                onCommit={setPctVariable}
              />
            )}
          </>
        )}
        <button
          type="button"
          className={styles.iconBtn}
          onClick={save}
          disabled={isPending}
          title="Afegeix"
        >
          <Check size={15} className="text-green-700" />
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={onCancel}
          disabled={isPending}
          title="Cancel·la"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
