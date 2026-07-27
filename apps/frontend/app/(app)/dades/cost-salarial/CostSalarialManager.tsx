"use client";

import { MESOS_LLARGS } from "@/lib/periodes";
import { cn, formatNum } from "@/lib/utils";
import { Check, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  type CostSalarialInput,
  deleteCostSalarialAction,
  uploadCostSalarialAction,
  upsertCostSalarialAction,
} from "./actions";
import styles from "./page.module.css";

interface CentreOpt {
  id: string;
  codi: string;
  nom: string;
  etiqueta: string;
}

interface RegistreDTO {
  id: string;
  departament: "SALA" | "CUINA";
  totalSalari: number;
  incentiusMensual: number;
  incentiuTrimestral: number;
  horesExtres: number;
  altres: number;
  baixes: number;
  indemnitzacions: number;
  foraCentre: number;
  notes: string | null;
  updatedAt: string;
  periodAny: number;
  periodMes: number;
  periodNom: string;
  centreId: string;
  centreLabel: string;
}

type Result = { ok: boolean; missatge: string; errors?: string[] };

const ARA = new Date();
const EMPTY_NUMS = {
  totalSalari: 0,
  incentiusMensual: 0,
  incentiuTrimestral: 0,
  horesExtres: 0,
  altres: 0,
  baixes: 0,
  indemnitzacions: 0,
  foraCentre: 0,
};

function parseImportInput(txt: string): number {
  const s = txt.trim().replace(/\./g, "").replace(",", ".");
  if (!s) return 0;
  return Number(s);
}

export function CostSalarialManager({
  centres,
  anys,
  registres,
  canEdit,
  filtreAny,
  filtreMes,
}: {
  centres: CentreOpt[];
  anys: number[];
  registres: RegistreDTO[];
  canEdit: boolean;
  filtreAny: number | null;
  filtreMes: number | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<Result | null>(null);
  const [isPending, startTransition] = useTransition();
  const [obert, setObert] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [any, setAny] = useState(ARA.getFullYear());
  const [mes, setMes] = useState(ARA.getMonth() + 1);
  const [centreId, setCentreId] = useState("");
  const [departament, setDepartament] = useState<"SALA" | "CUINA">("SALA");
  const [nums, setNums] = useState({ ...EMPTY_NUMS });
  const [notes, setNotes] = useState("");

  const notify = (r: Result) => {
    setFeedback(r);
    if (r.ok) setTimeout(() => setFeedback(null), 5000);
  };

  const reset = () => {
    setAny(ARA.getFullYear());
    setMes(ARA.getMonth() + 1);
    setCentreId("");
    setDepartament("SALA");
    setNums({ ...EMPTY_NUMS });
    setNotes("");
    setEditId(null);
  };

  const tancar = () => {
    setObert(false);
    reset();
  };

  const aplicarFiltre = (nextAny: string, nextMes: string) => {
    const params = new URLSearchParams();
    if (nextAny) params.set("any", nextAny);
    if (nextMes) params.set("mes", nextMes);
    const q = params.toString();
    router.push(q ? `/dades/cost-salarial?${q}` : "/dades/cost-salarial");
  };

  const pujar = (file: File | null) => {
    if (!file) return;
    const fd = new FormData();
    fd.set("fitxer", file);
    startTransition(async () => {
      const r = await uploadCostSalarialAction(fd);
      notify(r);
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  const desar = () => {
    const input: CostSalarialInput = {
      any,
      mes,
      centreId,
      departament,
      ...nums,
      notes,
    };
    startTransition(async () => {
      const r = await upsertCostSalarialAction(input, editId);
      notify(r);
      if (r.ok) tancar();
    });
  };

  const eliminar = (id: string) => {
    if (!confirm("Eliminar aquest registre?")) return;
    startTransition(async () => notify(await deleteCostSalarialAction(id)));
  };

  const editar = (r: RegistreDTO) => {
    setEditId(r.id);
    setAny(r.periodAny);
    setMes(r.periodMes);
    setCentreId(r.centreId);
    setDepartament(r.departament);
    setNums({
      totalSalari: r.totalSalari,
      incentiusMensual: r.incentiusMensual,
      incentiuTrimestral: r.incentiuTrimestral,
      horesExtres: r.horesExtres,
      altres: r.altres,
      baixes: r.baixes,
      indemnitzacions: r.indemnitzacions,
      foraCentre: r.foraCentre,
    });
    setNotes(r.notes ?? "");
    setObert(true);
  };

  const setNum = (key: keyof typeof EMPTY_NUMS, txt: string) => {
    setNums((prev) => ({ ...prev, [key]: parseImportInput(txt) }));
  };

  const totalRegistre = (r: RegistreDTO) =>
    r.totalSalari +
    r.incentiusMensual +
    r.incentiuTrimestral +
    r.horesExtres +
    r.altres +
    r.baixes +
    r.indemnitzacions +
    r.foraCentre;

  return (
    <>
      {feedback && (
        <div className={cn(styles.feedback, feedback.ok ? styles.feedbackOk : styles.feedbackErr)}>
          <div>{feedback.missatge}</div>
          {feedback.errors && feedback.errors.length > 0 && (
            <ul className={styles.errorList}>
              {feedback.errors.slice(0, 8).map((e) => (
                <li key={e}>{e}</li>
              ))}
              {feedback.errors.length > 8 && <li>…i {feedback.errors.length - 8} més</li>}
            </ul>
          )}
        </div>
      )}

      {canEdit && (
        <div className={styles.uploadCard}>
          <div>
            <h3 className={styles.uploadTitle}>Pujar Excel</h3>
            <p className={styles.uploadHint}>
              Format: Data, Nom Restaurant, Departament (Sala/Cuina) i partides. Només afegeix o
              actualitza línies existents (mes + restaurant + departament).
            </p>
          </div>
          <label className={styles.uploadBtn}>
            <Upload size={16} />
            {isPending ? "Processant…" : "Seleccionar fitxer"}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.xlsm"
              hidden
              disabled={isPending}
              onChange={(e) => pujar(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      )}

      <div className={styles.filters}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Any</label>
          <select
            className={styles.input}
            value={filtreAny ?? ""}
            onChange={(e) => aplicarFiltre(e.target.value, filtreMes ? String(filtreMes) : "")}
          >
            <option value="">Tots</option>
            {anys.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Mes</label>
          <select
            className={styles.input}
            value={filtreMes ?? ""}
            onChange={(e) => aplicarFiltre(filtreAny ? String(filtreAny) : "", e.target.value)}
          >
            <option value="">Tots</option>
            {MESOS_LLARGS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {canEdit && !obert && (
        <button
          type="button"
          className={styles.newBtn}
          onClick={() => {
            reset();
            setObert(true);
          }}
        >
          <Plus size={16} /> Nou registre
        </button>
      )}

      {obert && (
        <div className={styles.form}>
          <h3 className={styles.formTitle}>{editId ? "Editar registre" : "Nou registre"}</h3>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Any</label>
              <input
                className={styles.input}
                type="number"
                value={any}
                onChange={(e) => setAny(Number(e.target.value))}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Mes</label>
              <select
                className={styles.input}
                value={mes}
                onChange={(e) => setMes(Number(e.target.value))}
              >
                {MESOS_LLARGS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Restaurant</label>
              <select
                className={styles.input}
                value={centreId}
                onChange={(e) => setCentreId(e.target.value)}
              >
                <option value="">Selecciona…</option>
                {centres.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codi} · {c.etiqueta || c.nom}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Departament</label>
              <select
                className={styles.input}
                value={departament}
                onChange={(e) => setDepartament(e.target.value as "SALA" | "CUINA")}
              >
                <option value="SALA">Sala</option>
                <option value="CUINA">Cuina</option>
              </select>
            </div>

            {(
              [
                ["totalSalari", "Total salari"],
                ["incentiusMensual", "Incentius mensual"],
                ["incentiuTrimestral", "Incentiu trimestral"],
                ["horesExtres", "Hores extres"],
                ["altres", "Altres"],
                ["baixes", "Baixes"],
                ["indemnitzacions", "Indemnitzacions"],
                ["foraCentre", "Fora centre"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className={styles.field}>
                <label className={styles.fieldLabel}>{label}</label>
                <input
                  className={styles.input}
                  inputMode="decimal"
                  value={String(nums[key]).replace(".", ",")}
                  onChange={(e) => setNum(key, e.target.value)}
                />
              </div>
            ))}

            <div className={cn(styles.field, styles.full)}>
              <label className={styles.fieldLabel}>Notes</label>
              <input
                className={styles.input}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.saveBtn} disabled={isPending} onClick={desar}>
              <Check size={15} /> Desar
            </button>
            <button type="button" className={styles.cancelBtn} onClick={tancar}>
              <X size={15} /> Cancel·lar
            </button>
          </div>
        </div>
      )}

      {registres.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Sense registres</p>
          <p className={styles.emptyText}>
            Puja l&apos;Excel de cost salarial o crea un registre manualment.
          </p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Període</th>
                <th>Restaurant</th>
                <th>Dept.</th>
                <th className={styles.right}>Total</th>
                <th className={styles.right}>Salari</th>
                <th className={styles.right}>Incentius</th>
                <th className={styles.right}>H. extres</th>
                <th className={styles.right}>Altres</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {registres.map((r) => (
                <tr key={r.id}>
                  <td className={styles.nowrap}>{r.periodNom}</td>
                  <td>{r.centreLabel}</td>
                  <td>{r.departament === "SALA" ? "Sala" : "Cuina"}</td>
                  <td className={styles.right}>{formatNum(totalRegistre(r))}</td>
                  <td className={styles.right}>{formatNum(r.totalSalari)}</td>
                  <td className={styles.right}>
                    {formatNum(r.incentiusMensual + r.incentiuTrimestral)}
                  </td>
                  <td className={styles.right}>{formatNum(r.horesExtres)}</td>
                  <td className={styles.right}>
                    {formatNum(r.altres + r.baixes + r.indemnitzacions + r.foraCentre)}
                  </td>
                  {canEdit && (
                    <td className={styles.nowrap}>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => editar(r)}
                        disabled={isPending}
                        aria-label="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className={cn(styles.iconBtn, styles.iconDanger)}
                        onClick={() => eliminar(r.id)}
                        disabled={isPending}
                        aria-label="Eliminar"
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
