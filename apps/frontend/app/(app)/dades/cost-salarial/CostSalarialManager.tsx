"use client";

import { DadesFilterBar, coincideixCerca } from "@/components/dades/DadesFilterBar";
import { DadesEmpty, DadesNewBtn, dadesUi as ui } from "@/components/dades/DadesPanel";
import { FloatingAddButton } from "@/components/ui/FloatingAddButton";
import { MESOS_LLARGS } from "@/lib/periodes";
import { cn, formatNum } from "@/lib/utils";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
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
  const [query, setQuery] = useState("");
  /** Per defecte només afegeix mesos/línies noves (fitxer acumulatiu). */
  const [actualitzarExistents, setActualitzarExistents] = useState(false);

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
    fd.set("mode", actualitzarExistents ? "actualitzar" : "nomes_nous");
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

  const registresFiltrats = useMemo(() => {
    return registres.filter((r) =>
      coincideixCerca(`${r.centreLabel} ${r.departament} ${r.periodNom} ${r.notes ?? ""}`, query)
    );
  }, [registres, query]);

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
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.xlsm"
            hidden
            disabled={isPending}
            onChange={(e) => pujar(e.target.files?.[0] ?? null)}
          />
          <label className={styles.importMode}>
            <input
              type="checkbox"
              checked={actualitzarExistents}
              onChange={(e) => setActualitzarExistents(e.target.checked)}
              disabled={isPending}
            />
            <span>
              En pujar amb +: actualitzar també línies ja carregades (per defecte només afegeix el
              mes nou)
            </span>
          </label>
          <FloatingAddButton
            label="Pujar Excel de cost salarial"
            disabled={isPending}
            onClick={() => fileRef.current?.click()}
          />
        </>
      )}

      <DadesFilterBar
        query={query}
        onQueryChange={setQuery}
        placeholder="Cerca restaurant, departament, període…"
        onClear={() => {
          setQuery("");
          aplicarFiltre("", "");
        }}
        filters={[
          {
            id: "any",
            value: filtreAny ? String(filtreAny) : "",
            onChange: (v) => aplicarFiltre(v, filtreMes ? String(filtreMes) : ""),
            options: anys.map((y) => ({ value: String(y), label: String(y) })),
            allLabel: "Tots els anys",
            "aria-label": "Filtra per any",
          },
          {
            id: "mes",
            value: filtreMes ? String(filtreMes) : "",
            onChange: (v) => aplicarFiltre(filtreAny ? String(filtreAny) : "", v),
            options: MESOS_LLARGS.map((m, i) => ({
              value: String(i + 1),
              label: m,
            })),
            allLabel: "Tots els mesos",
            "aria-label": "Filtra per mes",
          },
        ]}
        summary={
          query.trim() ? `${registresFiltrats.length} de ${registres.length} registres` : undefined
        }
      />

      {canEdit && !obert && (
        <DadesNewBtn
          onClick={() => {
            reset();
            setObert(true);
          }}
        >
          <Plus size={16} /> Nou registre
        </DadesNewBtn>
      )}

      {obert && (
        <div className={styles.form}>
          <h3 className={styles.formTitle}>{editId ? "Editar registre" : "Nou registre"}</h3>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="cost-salarial-any">
                Any
              </label>
              <input
                id="cost-salarial-any"
                className={styles.input}
                type="number"
                value={any}
                onChange={(e) => setAny(Number(e.target.value))}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="cost-salarial-mes">
                Mes
              </label>
              <select
                id="cost-salarial-mes"
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
              <label className={styles.fieldLabel} htmlFor="cost-salarial-restaurant">
                Restaurant
              </label>
              <select
                id="cost-salarial-restaurant"
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
              <label className={styles.fieldLabel} htmlFor="cost-salarial-departament">
                Departament
              </label>
              <select
                id="cost-salarial-departament"
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
                <label className={styles.fieldLabel} htmlFor={`cost-salarial-${key}`}>
                  {label}
                </label>
                <input
                  id={`cost-salarial-${key}`}
                  className={styles.input}
                  inputMode="decimal"
                  value={String(nums[key]).replace(".", ",")}
                  onChange={(e) => setNum(key, e.target.value)}
                />
              </div>
            ))}

            <div className={cn(styles.field, styles.full)}>
              <label className={styles.fieldLabel} htmlFor="cost-salarial-notes">
                Notes
              </label>
              <input
                id="cost-salarial-notes"
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
        <DadesEmpty
          boxed
          title="Sense registres"
          text="Puja l&apos;Excel de cost salarial o crea un registre manualment."
        />
      ) : registresFiltrats.length === 0 ? (
        <DadesEmpty boxed title="Cap resultat" text="Prova a canviar la cerca o els filtres." />
      ) : (
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Període</th>
                <th>Restaurant</th>
                <th>Dept.</th>
                <th className={ui.right}>Total</th>
                <th className={ui.right}>Salari</th>
                <th className={ui.right}>Incentius</th>
                <th className={ui.right}>H. extres</th>
                <th className={ui.right}>Altres</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {registresFiltrats.map((r) => (
                <tr key={r.id}>
                  <td className={ui.nowrap}>{r.periodNom}</td>
                  <td>{r.centreLabel}</td>
                  <td>{r.departament === "SALA" ? "Sala" : "Cuina"}</td>
                  <td className={ui.right}>{formatNum(totalRegistre(r))}</td>
                  <td className={ui.right}>{formatNum(r.totalSalari)}</td>
                  <td className={ui.right}>
                    {formatNum(r.incentiusMensual + r.incentiuTrimestral)}
                  </td>
                  <td className={ui.right}>{formatNum(r.horesExtres)}</td>
                  <td className={ui.right}>
                    {formatNum(r.altres + r.baixes + r.indemnitzacions + r.foraCentre)}
                  </td>
                  {canEdit && (
                    <td className={ui.nowrap}>
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
