"use client";

import { DadesFilterBar } from "@/components/dades/DadesFilterBar";
import { DadesEmpty, DadesPanel, dadesUi as ui } from "@/components/dades/DadesPanel";
import { FloatingAddButton } from "@/components/ui/FloatingAddButton";
import { MESOS_LLARGS } from "@/lib/periodes";
import { NODE_COMPRES_DETALL } from "@/lib/repartiment/nodes";
import { cn, formatNum } from "@/lib/utils";
import { Check, Copy, Pencil, Percent, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  type AjustInput,
  createAjustAction,
  createAjustMultiAction,
  createAjustPctVendesMultiAction,
  deleteAjustAction,
  previsualitzaAjustPctVendesAction,
  updateAjustAction,
} from "./actions";
import styles from "./page.module.css";

type BasePctVendes = "vendes" | "ingressos";

interface PreviewAjustPctMes {
  mes: number;
  periodId: string | null;
  base: number;
  sap: number;
  objectiu: number;
  importAjust: number;
}

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
type ModeImport = "manual" | "pct";

const ARA = new Date();

function normalitza(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

function parsePct(txt: string): number {
  return Number.parseFloat(txt.replace(",", "."));
}

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

  const [q, setQ] = useState("");
  const [filtreAny, setFiltreAny] = useState("");
  const [filtreMes, setFiltreMes] = useState("");
  const [filtreConcepte, setFiltreConcepte] = useState("");
  const [filtreAmbit, setFiltreAmbit] = useState("");

  const [any, setAny] = useState(ARA.getFullYear());
  const [mes, setMes] = useState(ARA.getMonth() + 1);
  const [mesosSeleccionats, setMesosSeleccionats] = useState<number[]>([ARA.getMonth() + 1]);
  const [ambit, setAmbit] = useState<"centre" | "linia">("linia");
  const [centreId, setCentreId] = useState("");
  const [lnId, setLnId] = useState("");
  const [concepteId, setConcepteId] = useState("");
  const [importTxt, setImportTxt] = useState("");
  const [motiu, setMotiu] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [mesosObert, setMesosObert] = useState(false);
  const mesosRef = useRef<HTMLDivElement>(null);

  const [modeImport, setModeImport] = useState<ModeImport>("manual");
  const [pctTxt, setPctTxt] = useState("32,4");
  const [basePct, setBasePct] = useState<BasePctVendes>("vendes");
  const [preview, setPreview] = useState<PreviewAjustPctMes[] | null>(null);

  const concepteCompresId = useMemo(
    () => concepts.find((c) => c.node === NODE_COMPRES_DETALL)?.id ?? "",
    [concepts]
  );

  useEffect(() => {
    if (!mesosObert) return;
    function handleClick(e: MouseEvent) {
      if (mesosRef.current && !mesosRef.current.contains(e.target as Node)) {
        setMesosObert(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [mesosObert]);

  const anysDisponibles = useMemo(() => {
    const set = new Set(ajustos.map((a) => a.periodAny));
    return [...set].sort((a, b) => b - a);
  }, [ajustos]);

  const conceptesUsats = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of ajustos) map.set(a.concepteResultatId, a.concepte);
    return [...map.entries()]
      .map(([id, descripcio]) => ({ id, descripcio }))
      .sort((a, b) => a.descripcio.localeCompare(b.descripcio, "ca"));
  }, [ajustos]);

  const ambitsUsats = useMemo(() => {
    const set = new Set<string>();
    for (const a of ajustos) {
      const label = a.centre ?? a.liniaNegoci;
      if (label) set.add(label);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "ca"));
  }, [ajustos]);

  const teFiltres = !!(q || filtreAny || filtreMes || filtreConcepte || filtreAmbit);

  const filtrats = useMemo(() => {
    const qn = normalitza(q.trim());
    return ajustos.filter((a) => {
      if (filtreAny && a.periodAny !== Number(filtreAny)) return false;
      if (filtreMes && a.periodMes !== Number(filtreMes)) return false;
      if (filtreConcepte && a.concepteResultatId !== filtreConcepte) return false;
      const ambitLabel = a.centre ?? a.liniaNegoci ?? "";
      if (filtreAmbit && ambitLabel !== filtreAmbit) return false;
      if (!qn) return true;
      const haystack = normalitza(
        [a.periodNom, ambitLabel, a.concepte, a.motiu, a.autor, formatNum(a.import_, 2)].join(" ")
      );
      return haystack.includes(qn);
    });
  }, [ajustos, q, filtreAny, filtreMes, filtreConcepte, filtreAmbit]);

  const netejaFiltres = () => {
    setQ("");
    setFiltreAny("");
    setFiltreMes("");
    setFiltreConcepte("");
    setFiltreAmbit("");
  };

  const notify = (r: Result) => {
    setFeedback(r);
    if (r.ok) setTimeout(() => setFeedback(null), 4000);
  };

  const reset = () => {
    setAny(ARA.getFullYear());
    const mesAra = ARA.getMonth() + 1;
    setMes(mesAra);
    setMesosSeleccionats([mesAra]);
    setAmbit("linia");
    setCentreId("");
    setLnId("");
    setConcepteId("");
    setImportTxt("");
    setMotiu("");
    setEditId(null);
    setModeImport("manual");
    setPctTxt("32,4");
    setBasePct("vendes");
    setPreview(null);
  };

  const tancar = () => {
    setObert(false);
    reset();
  };

  const pctInputCommon = () => ({
    any,
    mesos: mesosSeleccionats,
    concepteResultatId: concepteId,
    centreId: ambit === "centre" ? centreId || null : null,
    liniaNegociId: ambit === "linia" ? lnId || null : null,
    percent: parsePct(pctTxt),
    basePct,
  });

  const aplicarModePct = (mode: ModeImport) => {
    setModeImport(mode);
    setPreview(null);
    if (mode === "pct") {
      if (!concepteId && concepteCompresId) setConcepteId(concepteCompresId);
      if (!motiu.trim()) {
        const pct = pctTxt.trim() || "32,4";
        const base = basePct === "ingressos" ? "ingressos" : "vendes";
        setMotiu(`${pct}% s/ ${base} · reconstrucció ${any}`);
      }
    }
  };

  const calcularPct = () => {
    startTransition(async () => {
      const r = await previsualitzaAjustPctVendesAction(pctInputCommon());
      if (!r.ok) {
        notify(r);
        setPreview(null);
        return;
      }
      setPreview(r.files);
      if (!motiu.trim()) {
        const pct = pctTxt.trim() || "32,4";
        const base = basePct === "ingressos" ? "ingressos" : "vendes";
        setMotiu(`${pct}% s/ ${base} · reconstrucció ${any}`);
      }
    });
  };

  const desar = () => {
    const mesActual = mesosSeleccionats.length === 1 ? mesosSeleccionats[0] : mes;
    const input: AjustInput = {
      any,
      mes: mesActual,
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

  const toggleMesos = (m: number) => {
    setMesosSeleccionats((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
    setPreview(null);
  };

  const crearPerMesos = () => {
    if (modeImport === "pct") {
      startTransition(async () => {
        const r = await createAjustPctVendesMultiAction({
          ...pctInputCommon(),
          motiu: motiu.trim() || undefined,
        });
        notify(r);
        if (r.ok) tancar();
      });
      return;
    }

    const import_ = Number.parseFloat(importTxt.replace(",", "."));
    startTransition(async () => {
      const r = await createAjustMultiAction({
        any,
        mesos: mesosSeleccionats,
        concepteResultatId: concepteId,
        centreId: ambit === "centre" ? centreId || null : null,
        liniaNegociId: ambit === "linia" ? lnId || null : null,
        import_,
        motiu,
      });
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
    setMesosSeleccionats([a.periodMes]);
    setAmbit(a.centreId ? "centre" : "linia");
    setCentreId(a.centreId ?? "");
    setLnId(a.liniaNegociId ?? "");
    setConcepteId(a.concepteResultatId);
    setImportTxt(String(a.import_).replace(".", ","));
    setMotiu(a.motiu);
    setModeImport("manual");
    setPreview(null);
    setObert(true);
  };

  const duplicar = (a: AjustDTO) => {
    setEditId(null);
    setAny(a.periodAny);
    setMes(a.periodMes);
    setMesosSeleccionats([a.periodMes]);
    setAmbit(a.centreId ? "centre" : "linia");
    setCentreId(a.centreId ?? "");
    setLnId(a.liniaNegociId ?? "");
    setConcepteId(a.concepteResultatId);
    setImportTxt(String(a.import_).replace(".", ","));
    setMotiu(a.motiu);
    setModeImport("manual");
    setPreview(null);
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
        <FloatingAddButton
          label="Nou ajust"
          onClick={() => {
            reset();
            setObert(true);
          }}
        />
      )}

      {canEdit && obert && (
        <div className={styles.form}>
          <div className={styles.formTitle}>{editId ? "Editar ajust" : "Nou ajust"}</div>

          {!editId && (
            <div className={styles.modeRow}>
              <button
                type="button"
                className={cn(styles.modeBtn, modeImport === "manual" && styles.modeBtnActive)}
                onClick={() => aplicarModePct("manual")}
                disabled={isPending}
              >
                Import manual (€)
              </button>
              <button
                type="button"
                className={cn(styles.modeBtn, modeImport === "pct" && styles.modeBtnActive)}
                onClick={() => aplicarModePct("pct")}
                disabled={isPending}
              >
                <Percent size={14} /> % sobre vendes
              </button>
            </div>
          )}

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Any</span>
              <input
                type="number"
                className={styles.input}
                value={any}
                onChange={(e) => {
                  setAny(Number(e.target.value));
                  setPreview(null);
                }}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Àmbit</span>
              <select
                className={styles.input}
                value={ambit}
                onChange={(e) => {
                  setAmbit(e.target.value as "centre" | "linia");
                  setPreview(null);
                }}
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
                  onChange={(e) => {
                    setCentreId(e.target.value);
                    setPreview(null);
                  }}
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
                  onChange={(e) => {
                    setLnId(e.target.value);
                    setPreview(null);
                  }}
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
                onChange={(e) => {
                  setConcepteId(e.target.value);
                  setPreview(null);
                }}
              >
                <option value="">Selecciona…</option>
                {concepts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.descripcio}
                  </option>
                ))}
              </select>
            </label>

            {modeImport === "manual" || editId ? (
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Import (€)</span>
                <input
                  className={styles.input}
                  placeholder="0,00"
                  value={importTxt}
                  onChange={(e) => setImportTxt(e.target.value)}
                />
              </label>
            ) : (
              <>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>% objectiu</span>
                  <input
                    className={styles.input}
                    placeholder="32,4"
                    value={pctTxt}
                    onChange={(e) => {
                      setPctTxt(e.target.value);
                      setPreview(null);
                    }}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Base %</span>
                  <select
                    className={styles.input}
                    value={basePct}
                    onChange={(e) => {
                      setBasePct(e.target.value as BasePctVendes);
                      setPreview(null);
                    }}
                  >
                    <option value="vendes">Vendes</option>
                    <option value="ingressos">Ingressos explotació</option>
                  </select>
                </label>
              </>
            )}

            <div className={cn(styles.field, styles.wide)} ref={mesosRef}>
              <span className={styles.fieldLabel}>Mesos</span>
              <button
                type="button"
                className={cn(styles.input, styles.mesosTrigger)}
                onClick={() => setMesosObert((o) => !o)}
                disabled={isPending}
              >
                <span className={styles.mesosTriggerText}>
                  {mesosSeleccionats.length === 0
                    ? "Selecciona mesos…"
                    : mesosSeleccionats.length === 12
                      ? "Tots els mesos"
                      : mesosSeleccionats
                          .sort((a, b) => a - b)
                          .map((m) => MESOS_LLARGS[m - 1].slice(0, 3))
                          .join(", ")}
                </span>
                <span className={styles.mesosTriggerArrow}>▾</span>
              </button>
              {mesosObert && (
                <div className={styles.mesosDropdown}>
                  <div className={styles.mesosDropdownActions}>
                    <button
                      type="button"
                      onClick={() => {
                        setMesosSeleccionats([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
                        setPreview(null);
                      }}
                    >
                      Tots
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMesosSeleccionats([]);
                        setPreview(null);
                      }}
                    >
                      Cap
                    </button>
                  </div>
                  <div className={styles.mesosGrid}>
                    {MESOS_LLARGS.map((m, i) => {
                      const val = i + 1;
                      const checked = mesosSeleccionats.includes(val);
                      return (
                        <label
                          key={val}
                          className={cn(styles.mesChip, checked && styles.mesChipChecked)}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleMesos(val)}
                          />
                          {m.slice(0, 3)}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <label className={cn(styles.field, styles.motiuFila)}>
              <span className={styles.fieldLabel}>Motiu</span>
              <input
                className={styles.input}
                placeholder="Explica el perquè de l'ajust"
                value={motiu}
                onChange={(e) => setMotiu(e.target.value)}
              />
            </label>
          </div>

          {modeImport === "pct" && !editId && (
            <p className={styles.pctHint}>
              Per cada mes: objectiu = −% × |base|, ajust = objectiu − SAP. Usa la línia de detall
              (COMPRES), no el subtotal. Després recalcula el repartiment.
            </p>
          )}

          {preview && preview.length > 0 && (
            <div className={styles.previewWrap}>
              <table className={styles.previewTable}>
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th className={ui.right}>Base</th>
                    <th className={ui.right}>SAP</th>
                    <th className={ui.right}>Objectiu</th>
                    <th className={ui.right}>Ajust Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((f) => (
                    <tr key={f.mes}>
                      <td>{MESOS_LLARGS[f.mes - 1]}</td>
                      <td className={ui.right}>{formatNum(f.base, 2)}</td>
                      <td className={ui.right}>{formatNum(f.sap, 2)}</td>
                      <td className={ui.right}>{formatNum(f.objectiu, 2)}</td>
                      <td className={cn(ui.right, f.importAjust < 0 && styles.neg)}>
                        {formatNum(f.importAjust, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.formActions}>
            {modeImport === "pct" && !editId ? (
              <>
                <button
                  type="button"
                  className={styles.saveBtn}
                  onClick={calcularPct}
                  disabled={isPending}
                >
                  <Percent size={15} /> Previsualitza
                </button>
                <button
                  type="button"
                  className={styles.bulkCreateBtn}
                  onClick={crearPerMesos}
                  disabled={isPending}
                  title="Crea o actualitza un ajust per mes (objectiu % − SAP)"
                >
                  <Plus size={15} /> Aplica % als mesos
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={styles.saveBtn}
                  onClick={desar}
                  disabled={isPending}
                >
                  <Check size={15} /> {editId ? "Desa canvis" : "Crea ajust"}
                </button>
                {!editId && (
                  <button
                    type="button"
                    className={styles.bulkCreateBtn}
                    onClick={crearPerMesos}
                    disabled={isPending}
                    title="Crea ajustos nous per als mesos marcats (salta els que ja existeixen)"
                  >
                    <Plus size={15} /> Crea per mesos
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={tancar}
              disabled={isPending}
            >
              <X size={15} /> Cancel·la
            </button>
          </div>
        </div>
      )}

      {ajustos.length === 0 ? (
        <DadesPanel title="Registre d'ajustos">
          <DadesEmpty text="Encara no hi ha cap ajust. Crea'n un amb el botó +." />
        </DadesPanel>
      ) : (
        <DadesPanel
          title="Registre d'ajustos"
          meta={
            teFiltres
              ? `${filtrats.length} de ${ajustos.length}`
              : `${ajustos.length} ajust${ajustos.length !== 1 ? "os" : ""}`
          }
        >
          <DadesFilterBar
            query={q}
            onQueryChange={setQ}
            placeholder="Cerca centre, concepte, motiu, autor…"
            onClear={netejaFiltres}
            filters={[
              {
                id: "any",
                value: filtreAny,
                onChange: setFiltreAny,
                options: anysDisponibles.map((y) => ({
                  value: String(y),
                  label: String(y),
                })),
                allLabel: "Tots els anys",
                "aria-label": "Filtra per any",
              },
              {
                id: "mes",
                value: filtreMes,
                onChange: setFiltreMes,
                options: MESOS_LLARGS.map((m, i) => ({
                  value: String(i + 1),
                  label: m,
                })),
                allLabel: "Tots els mesos",
                "aria-label": "Filtra per mes",
              },
              {
                id: "concepte",
                value: filtreConcepte,
                onChange: setFiltreConcepte,
                options: conceptesUsats.map((c) => ({
                  value: c.id,
                  label: c.descripcio,
                })),
                allLabel: "Tots els conceptes",
                "aria-label": "Filtra per concepte",
              },
              {
                id: "ambit",
                value: filtreAmbit,
                onChange: setFiltreAmbit,
                options: ambitsUsats.map((label) => ({ value: label, label })),
                allLabel: "Tots els centres / LN",
                "aria-label": "Filtra per centre o línia",
              },
            ]}
          />

          {filtrats.length === 0 ? (
            <DadesEmpty text="Cap ajust amb aquests criteris." />
          ) : (
            <div className={ui.tableWrap}>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th>Període</th>
                    <th>Àmbit</th>
                    <th>Concepte</th>
                    <th className={ui.right}>Import</th>
                    <th>Motiu</th>
                    <th>Autor</th>
                    {canEdit && <th />}
                  </tr>
                </thead>
                <tbody>
                  {filtrats.map((a) => (
                    <tr key={a.id}>
                      <td className={ui.nowrap}>{a.periodNom}</td>
                      <td>{a.centre ?? a.liniaNegoci ?? "—"}</td>
                      <td>{a.concepte}</td>
                      <td className={cn(ui.right, ui.nowrap, a.import_ < 0 && styles.neg)}>
                        {formatNum(a.import_, 2)} €
                      </td>
                      <td className={cn(ui.ellipsis, ui.muted)} title={a.motiu}>
                        {a.motiu || "—"}
                      </td>
                      <td className={ui.muted}>{a.autor}</td>
                      {canEdit && (
                        <td className={ui.actions}>
                          <button
                            type="button"
                            className={styles.iconBtn}
                            title="Edita"
                            onClick={() => editar(a)}
                            disabled={isPending}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            className={styles.iconBtn}
                            title="Duplica (crea nou)"
                            onClick={() => duplicar(a)}
                            disabled={isPending}
                          >
                            <Copy size={13} />
                          </button>
                          <button
                            type="button"
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
        </DadesPanel>
      )}
    </>
  );
}
