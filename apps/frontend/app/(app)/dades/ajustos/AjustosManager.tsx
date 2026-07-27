"use client";

import { MESOS_LLARGS } from "@/lib/periodes";
import { cn, formatNum } from "@/lib/utils";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import {
  type AjustInput,
  createAjustAction,
  deleteAjustAction,
  updateAjustAction,
} from "./actions";
import styles from "./page.module.css";

interface Concepte {
  id: string;
  node: number;
  descripcio: string;
}
interface CentreOpt {
  id: string;
  codi: string;
  nom: string;
}
interface LnOpt {
  id: string;
  codi: string;
  nom: string;
  centres: CentreOpt[];
}
interface AjustDTO {
  id: string;
  import_: number;
  motiu: string;
  createdAt: string;
  periodAny: number;
  periodMes: number;
  periodNom: string;
  concepteResultatId: string;
  centreId: string | null;
  liniaNegociId: string | null;
  concepte: string;
  centre: string | null;
  liniaNegoci: string | null;
  autor: string;
}
type Result = { ok: boolean; missatge: string };

const ARA = new Date();

export function AjustosManager({
  arbre,
  concepts,
  ajustos,
  canEdit,
}: {
  arbre: LnOpt[];
  concepts: Concepte[];
  ajustos: AjustDTO[];
  canEdit: boolean;
}) {
  const [obert, setObert] = useState(false);
  const [feedback, setFeedback] = useState<Result | null>(null);
  const [isPending, startTransition] = useTransition();

  // Camps del formulari
  const [any, setAny] = useState(ARA.getFullYear());
  const [mes, setMes] = useState(ARA.getMonth() + 1);
  const [ambit, setAmbit] = useState<"centre" | "linia">("centre");
  const [centreId, setCentreId] = useState("");
  const [lnId, setLnId] = useState("");
  const [concepteId, setConcepteId] = useState("");
  const [importTxt, setImportTxt] = useState("");
  const [motiu, setMotiu] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  const notify = (r: Result) => {
    setFeedback(r);
    if (r.ok) setTimeout(() => setFeedback(null), 4000);
  };

  const reset = () => {
    setAny(ARA.getFullYear());
    setMes(ARA.getMonth() + 1);
    setAmbit("centre");
    setCentreId("");
    setLnId("");
    setConcepteId("");
    setImportTxt("");
    setMotiu("");
    setEditId(null);
  };

  const tancar = () => {
    setObert(false);
    reset();
  };

  const desar = () => {
    const input: AjustInput = {
      any,
      mes,
      concepteResultatId: concepteId,
      centreId: ambit === "centre" ? centreId || null : null,
      liniaNegociId: ambit === "linia" ? lnId || null : null,
      import_: Number.parseFloat(importTxt.replace(",", ".")),
      motiu,
    };
    startTransition(async () => {
      const r = editId ? await updateAjustAction(editId, input) : await createAjustAction(input);
      notify(r);
      if (r.ok) tancar();
    });
  };

  const eliminar = (id: string) => {
    if (!confirm("Eliminar aquest ajust?")) return;
    startTransition(async () => notify(await deleteAjustAction(id)));
  };

  const editar = (a: AjustDTO) => {
    setEditId(a.id);
    setAny(a.periodAny);
    setMes(a.periodMes);
    setAmbit(a.centreId ? "centre" : "linia");
    setCentreId(a.centreId ?? "");
    setLnId(a.liniaNegociId ?? "");
    setConcepteId(a.concepteResultatId);
    setImportTxt(String(a.import_).replace(".", ","));
    setMotiu(a.motiu);
    setObert(true);
  };

  return (
    <>
      {feedback && (
        <div className={cn(styles.feedback, feedback.ok ? styles.feedbackOk : styles.feedbackErr)}>
          {feedback.missatge}
        </div>
      )}

      {canEdit && !obert && (
        <button
          className={styles.newBtn}
          onClick={() => {
            reset();
            setObert(true);
          }}
        >
          <Plus size={16} /> Nou ajust
        </button>
      )}

      {canEdit && obert && (
        <div className={styles.form}>
          <div className={styles.formTitle}>{editId ? "Editar ajust" : "Nou ajust"}</div>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Any</span>
              <input
                type="number"
                className={styles.input}
                value={any}
                onChange={(e) => setAny(Number(e.target.value))}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Mes</span>
              <select
                className={styles.input}
                value={mes}
                onChange={(e) => setMes(Number(e.target.value))}
              >
                {MESOS_LLARGS.map((m, i) => (
                  <option key={i} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Àmbit</span>
              <select
                className={styles.input}
                value={ambit}
                onChange={(e) => setAmbit(e.target.value as "centre" | "linia")}
              >
                <option value="centre">Centre</option>
                <option value="linia">Línia de negoci</option>
              </select>
            </label>

            {ambit === "centre" ? (
              <label className={cn(styles.field, styles.wide)}>
                <span className={styles.fieldLabel}>Centre</span>
                <select
                  className={styles.input}
                  value={centreId}
                  onChange={(e) => setCentreId(e.target.value)}
                >
                  <option value="">Selecciona…</option>
                  {arbre.map((ln) => (
                    <optgroup key={ln.id} label={`${ln.codi} · ${ln.nom}`}>
                      {ln.centres.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.codi} · {c.nom}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            ) : (
              <label className={cn(styles.field, styles.wide)}>
                <span className={styles.fieldLabel}>Línia de negoci</span>
                <select
                  className={styles.input}
                  value={lnId}
                  onChange={(e) => setLnId(e.target.value)}
                >
                  <option value="">Selecciona…</option>
                  {arbre.map((ln) => (
                    <option key={ln.id} value={ln.id}>
                      {ln.codi} · {ln.nom}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className={cn(styles.field, styles.wide)}>
              <span className={styles.fieldLabel}>Concepte</span>
              <select
                className={styles.input}
                value={concepteId}
                onChange={(e) => setConcepteId(e.target.value)}
              >
                <option value="">Selecciona…</option>
                {concepts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.descripcio}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Import (€)</span>
              <input
                className={styles.input}
                placeholder="0,00"
                value={importTxt}
                onChange={(e) => setImportTxt(e.target.value)}
              />
            </label>

            <label className={cn(styles.field, styles.full)}>
              <span className={styles.fieldLabel}>Motiu</span>
              <input
                className={styles.input}
                placeholder="Explica el perquè de l'ajust"
                value={motiu}
                onChange={(e) => setMotiu(e.target.value)}
              />
            </label>
          </div>

          <div className={styles.formActions}>
            <button className={styles.saveBtn} onClick={desar} disabled={isPending}>
              <Check size={15} /> {editId ? "Desa canvis" : "Crea ajust"}
            </button>
            <button className={styles.cancelBtn} onClick={tancar} disabled={isPending}>
              <X size={15} /> Cancel·la
            </button>
          </div>
        </div>
      )}

      {ajustos.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Cap ajust registrat</p>
          <p className={styles.emptyText}>
            Els ajustos manuals que creïs apareixeran aquí i se sumaran a les consultes.
          </p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Període</th>
                <th>Àmbit</th>
                <th>Concepte</th>
                <th className={styles.right}>Import</th>
                <th>Motiu</th>
                <th>Autor</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {ajustos.map((a) => (
                <tr key={a.id}>
                  <td className={styles.nowrap}>{a.periodNom}</td>
                  <td>{a.centre ?? a.liniaNegoci ?? "—"}</td>
                  <td>{a.concepte}</td>
                  <td className={cn(styles.right, styles.nowrap, a.import_ < 0 && styles.neg)}>
                    {formatNum(a.import_, 2)} €
                  </td>
                  <td className={styles.motiu}>{a.motiu}</td>
                  <td className={styles.dim}>{a.autor}</td>
                  {canEdit && (
                    <td className={styles.nowrap}>
                      <button
                        className={styles.iconBtn}
                        title="Edita"
                        onClick={() => editar(a)}
                        disabled={isPending}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        className={cn(styles.iconBtn, styles.iconDanger)}
                        title="Elimina"
                        onClick={() => eliminar(a.id)}
                        disabled={isPending}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
