"use client";

import {
  crearPressupostDeptAction,
  deleteLiniaDeptAction,
  setEstatPressupostDeptAction,
  updateNotesPressupostDeptAction,
  upsertLiniaDeptAction,
} from "@/app/(app)/pressupost/departaments/actions";
import ui from "@/components/dades/dades-ui.module.css";
import { etiquetaMesos, nomMes, opcionsMesos } from "@/lib/periodes";
import type { CategoriaCatalogOpt } from "@/lib/pressupost/partida-catalog";
import type {
  DepartamentPressupostInfo,
  PressupostDeptCapcalera,
  PressupostLiniaDeptRow,
} from "@/lib/pressupost/pressupost-dept";
import {
  PERIODICITATS_TIPUS_B,
  type PeriodicitatTipusB,
  distribucioMensual,
  importAnualLinia,
  labelCategoria,
  labelPeriodicitat,
  mesosPerDefecte,
  totalAnualLinies,
} from "@/lib/pressupost/tipus-b";
import { formatNum } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import styles from "./PressupostDeptManager.module.css";

type Vista = "partides" | "calendari" | "resum";

type Props = {
  anyInicial: number;
  dept: DepartamentPressupostInfo;
  capcalera: PressupostDeptCapcalera | null;
  linies: PressupostLiniaDeptRow[];
  catalogCategories: CategoriaCatalogOpt[];
  anysExistents: number[];
  canEdit: boolean;
};

type FormState = {
  liniaId?: string;
  categoriaCatalogId: string;
  descripcio: string;
  premissa: string;
  periodicitat: PeriodicitatTipusB;
  importUnitari: string;
  mesAncora: number;
  mesosPerso: number[];
};

const FORM_BUIT: FormState = {
  categoriaCatalogId: "",
  descripcio: "",
  premissa: "",
  periodicitat: "MENSUAL",
  importUnitari: "",
  mesAncora: 1,
  mesosPerso: [1],
};

function parseImport(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return 0;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function PressupostDeptManager({
  anyInicial,
  dept,
  capcalera,
  linies,
  catalogCategories,
  anysExistents,
  canEdit,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [any, setAny] = useState(anyInicial);
  const [vista, setVista] = useState<Vista>("partides");
  const [missatge, setMissatge] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState(capcalera?.notes ?? "");
  const [form, setForm] = useState<FormState>(FORM_BUIT);
  const [mostrarForm, setMostrarForm] = useState(false);

  useEffect(() => setAny(anyInicial), [anyInicial]);
  // Reset deliberat en canviar de pressupost (id), no a cada tecla de notes
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset per capcalera.id
  useEffect(() => {
    setNotesDraft(capcalera?.notes ?? "");
    setMissatge(null);
    setError(null);
    setForm(FORM_BUIT);
    setMostrarForm(false);
  }, [capcalera?.id]);

  const cataleg = catalogCategories;

  const labelCat = (key: string) => {
    const c = cataleg.find((x) => x.key === key);
    return c?.nom ?? labelCategoria(key);
  };

  const bloquejat = !canEdit || !capcalera || capcalera.estat === "CONFIRMAT";

  const anysOpts = useMemo(() => {
    const set = new Set(anysExistents);
    set.add(any);
    set.add(new Date().getFullYear());
    set.add(new Date().getFullYear() + 1);
    return [...set].sort((a, b) => b - a);
  }, [anysExistents, any]);

  // Suma directa (sense memo) per evitar totals obsolets després d’afegir línies
  const totalAnual = totalAnualLinies(linies);

  const calendari = useMemo(() => {
    const cells: { linia: PressupostLiniaDeptRow; mes: number; import_: number }[] = [];
    for (const l of linies) {
      const dist = distribucioMensual(l.importUnitari, l.mesos);
      for (let i = 0; i < 12; i++) {
        const import_ = dist[i] ?? 0;
        if (import_ > 0) cells.push({ linia: l, mes: i + 1, import_ });
      }
    }
    return cells.sort(
      (a, b) => a.mes - b.mes || a.linia.descripcio.localeCompare(b.linia.descripcio)
    );
  }, [linies]);

  const resumMes = useMemo(() => {
    const perMes = Array.from({ length: 12 }, () => 0);
    const perCat = new Map<string, number[]>();
    for (const l of linies) {
      const dist = distribucioMensual(l.importUnitari, l.mesos);
      let row = perCat.get(l.categoria);
      if (!row) {
        row = Array.from({ length: 12 }, () => 0);
        perCat.set(l.categoria, row);
      }
      for (let i = 0; i < 12; i++) {
        const v = dist[i] ?? 0;
        row[i] = (row[i] ?? 0) + v;
        perMes[i] = (perMes[i] ?? 0) + v;
      }
    }
    return { perMes, perCat };
  }, [linies]);

  function navega(nextAny: number) {
    router.push(`/pressupost/departaments/${dept.id}?any=${nextAny}`);
  }

  function crear() {
    if (!canEdit) return;
    setError(null);
    startTransition(async () => {
      const r = await crearPressupostDeptAction(any, dept.id);
      if (!r.ok) {
        setError(r.missatge);
        return;
      }
      setMissatge(r.missatge);
      router.refresh();
    });
  }

  function setEstat(estat: "ESBORRANY" | "CONFIRMAT") {
    if (!canEdit || !capcalera) return;
    startTransition(async () => {
      const r = await setEstatPressupostDeptAction(capcalera.id, estat);
      if (!r.ok) setError(r.missatge);
      else {
        setMissatge(r.missatge);
        router.refresh();
      }
    });
  }

  function guardarNotes() {
    if (!canEdit || !capcalera || capcalera.estat === "CONFIRMAT") return;
    startTransition(async () => {
      const r = await updateNotesPressupostDeptAction(capcalera.id, notesDraft);
      if (!r.ok) setError(r.missatge);
      else setMissatge("Notes desades.");
    });
  }

  function editarLinia(l: PressupostLiniaDeptRow) {
    setForm({
      liniaId: l.id,
      categoriaCatalogId: l.partidaCatalogId ?? "",
      descripcio: l.descripcio,
      premissa: l.premissa ?? "",
      periodicitat: l.periodicitat,
      importUnitari: String(l.importUnitari),
      mesAncora: l.mesos[0] ?? 1,
      mesosPerso: l.mesos.length ? l.mesos : [1],
    });
    setMostrarForm(true);
    setVista("partides");
  }

  function desarLinia() {
    if (!capcalera || bloquejat) return;
    const importUnitari = parseImport(form.importUnitari);
    if (importUnitari == null) {
      setError("Import no vàlid.");
      return;
    }
    if (!form.categoriaCatalogId) {
      setError("Tria una categoria.");
      return;
    }
    if (!form.descripcio.trim()) {
      setError("Cal una descripció de la partida.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await upsertLiniaDeptAction({
        pressupostId: capcalera.id,
        liniaId: form.liniaId,
        categoriaCatalogId: form.categoriaCatalogId,
        descripcio: form.descripcio,
        premissa: form.premissa,
        periodicitat: form.periodicitat,
        importUnitari,
        mesAncora: form.mesAncora,
        mesos:
          form.periodicitat === "PERSONALITZAT"
            ? form.mesosPerso
            : form.periodicitat === "MENSUAL"
              ? mesosPerDefecte("MENSUAL")
              : [form.mesAncora],
      });
      if (!r.ok) {
        setError(r.missatge);
        return;
      }
      setMissatge(r.missatge);
      setForm(FORM_BUIT);
      setMostrarForm(false);
      router.refresh();
    });
  }

  function eliminarLinia(id: string) {
    if (!capcalera || bloquejat) return;
    if (!window.confirm("Eliminar aquesta partida?")) return;
    startTransition(async () => {
      const r = await deleteLiniaDeptAction(capcalera.id, id);
      if (!r.ok) setError(r.missatge);
      else {
        setMissatge(r.missatge);
        router.refresh();
      }
    });
  }

  function toggleMesPerso(mes: number) {
    setForm((f) => {
      const set = new Set(f.mesosPerso);
      if (set.has(mes)) set.delete(mes);
      else set.add(mes);
      const next = [...set].sort((a, b) => a - b);
      return { ...f, mesosPerso: next.length ? next : [mes] };
    });
  }

  const previewMesos =
    form.periodicitat === "PERSONALITZAT"
      ? form.mesosPerso
      : form.periodicitat === "MENSUAL"
        ? mesosPerDefecte("MENSUAL")
        : form.periodicitat === "TRIMESTRAL"
          ? mesosPerDefecte("TRIMESTRAL", form.mesAncora)
          : [form.mesAncora];

  const previewAnual = importAnualLinia(parseImport(form.importUnitari) ?? 0, previewMesos);

  return (
    <div className={styles.wrap} lang="ca" translate="no">
      <p className={styles.back}>
        <Link href={`/pressupost/departaments?any=${any}`}>← Tots els departaments</Link>
      </p>

      <div className={ui.panel}>
        <div className={ui.panelHeader}>
          <h2 className={ui.panelTitle}>
            {dept.nom}
            <span className={styles.deptMeta}>
              {dept.codi} · {dept.centreNom} ({dept.centreCodi})
            </span>
          </h2>
          {pending ? <span className={ui.panelMeta}>Desant…</span> : null}
        </div>
        <div className={styles.filters}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Any</span>
            <select
              className={styles.select}
              value={any}
              onChange={(e) => {
                const v = Number(e.target.value);
                setAny(v);
                navega(v);
              }}
            >
              {anysOpts.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>

          {capcalera ? (
            <div className={styles.estatBlock}>
              <span className={styles.totalChip} key={`t-${linies.length}-${totalAnual}`}>
                Total any {formatNum(totalAnual, 0)} €
              </span>
              <span
                className={capcalera.estat === "CONFIRMAT" ? styles.badgeOk : styles.badgeDraft}
              >
                {capcalera.estat === "CONFIRMAT" ? "Confirmat" : "Esborrany"}
              </span>
              {canEdit ? (
                capcalera.estat === "ESBORRANY" ? (
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    disabled={pending}
                    onClick={() => setEstat("CONFIRMAT")}
                  >
                    Confirmar
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.btnGhost}
                    disabled={pending}
                    onClick={() => setEstat("ESBORRANY")}
                  >
                    Reobrir esborrany
                  </button>
                )
              ) : null}
            </div>
          ) : canEdit ? (
            <button type="button" className={styles.btnPrimary} disabled={pending} onClick={crear}>
              Començar pressupost {any}
            </button>
          ) : (
            <p className={styles.hintInline}>Sense pressupost per a aquest any.</p>
          )}
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
        {missatge ? <p className={styles.ok}>{missatge}</p> : null}
      </div>

      {!capcalera ? (
        <p className={ui.empty}>
          Crea el pressupost per afegir partides amb descripció, categoria, periodicitat i calendari
          de desemborsament (reunions de control).
        </p>
      ) : (
        <>
          <div className={ui.panel}>
            <div className={ui.panelHeader}>
              <h2 className={ui.panelTitle}>Notes / premisses generals</h2>
            </div>
            <textarea
              className={styles.notes}
              rows={2}
              value={notesDraft}
              disabled={bloquejat}
              onChange={(e) => setNotesDraft(e.target.value)}
              onBlur={guardarNotes}
              placeholder="Objectius del dept, escenari, acords de la reunió de planificació…"
            />
          </div>

          <div className={styles.tabs} role="tablist">
            {(
              [
                ["partides", "Partides"],
                ["calendari", "Calendari"],
                ["resum", "Per mesos"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={vista === id}
                className={vista === id ? styles.tabActive : styles.tab}
                onClick={() => setVista(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {vista === "partides" ? (
            <>
              {!bloquejat ? (
                <div className={styles.formActions}>
                  {cataleg.length === 0 ? (
                    <p className={styles.hintInline}>
                      No hi ha categories actives per a aquest departament.{" "}
                      <Link href="/dades/pressupost-categories">
                        Crear-les a Dades → Categories press.
                      </Link>
                    </p>
                  ) : (
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      onClick={() => {
                        setForm({
                          ...FORM_BUIT,
                          categoriaCatalogId: cataleg[0]?.id ?? "",
                        });
                        setMostrarForm(true);
                      }}
                    >
                      + Afegir partida
                    </button>
                  )}
                </div>
              ) : null}

              {mostrarForm && !bloquejat ? (
                <div className={ui.panel}>
                  <div className={ui.panelHeader}>
                    <h2 className={ui.panelTitle}>
                      {form.liniaId ? "Editar partida" : "Afegir partida al pressupost"}
                    </h2>
                  </div>
                  <div className={styles.formGrid}>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Categoria</span>
                      <select
                        className={styles.select}
                        value={form.categoriaCatalogId}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, categoriaCatalogId: e.target.value }))
                        }
                      >
                        {cataleg.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nom}
                          </option>
                        ))}
                      </select>
                      <span className={styles.hintInline}>
                        Catàleg a{" "}
                        <Link href="/dades/pressupost-categories">Dades → Categories press.</Link>
                      </span>
                    </label>
                    <label className={styles.fieldWide}>
                      <span className={styles.fieldLabel}>Descripció de la partida</span>
                      <input
                        className={styles.input}
                        value={form.descripcio}
                        onChange={(e) => setForm((f) => ({ ...f, descripcio: e.target.value }))}
                        placeholder="Ex.: Campanya Casaments bodas.net"
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Periodicitat</span>
                      <select
                        className={styles.select}
                        value={form.periodicitat}
                        onChange={(e) => {
                          const p = e.target.value as PeriodicitatTipusB;
                          setForm((f) => ({
                            ...f,
                            periodicitat: p,
                            mesosPerso:
                              p === "PERSONALITZAT"
                                ? f.mesosPerso
                                : mesosPerDefecte(p, f.mesAncora),
                          }));
                        }}
                      >
                        {PERIODICITATS_TIPUS_B.map((p) => (
                          <option key={p.key} value={p.key}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Import / desemborsament (€)</span>
                      <input
                        className={styles.input}
                        inputMode="decimal"
                        value={form.importUnitari}
                        onChange={(e) => setForm((f) => ({ ...f, importUnitari: e.target.value }))}
                        placeholder="0"
                      />
                    </label>
                    {form.periodicitat !== "MENSUAL" && form.periodicitat !== "PERSONALITZAT" ? (
                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>
                          {form.periodicitat === "TRIMESTRAL"
                            ? "Primer mes"
                            : "Mes del desemborsament"}
                        </span>
                        <select
                          className={styles.select}
                          value={form.mesAncora}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              mesAncora: Number(e.target.value),
                            }))
                          }
                        >
                          {opcionsMesos("llarg").map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <label className={styles.fieldWide}>
                      <span className={styles.fieldLabel}>Premissa / justificant (control)</span>
                      <input
                        className={styles.input}
                        value={form.premissa}
                        onChange={(e) => setForm((f) => ({ ...f, premissa: e.target.value }))}
                        placeholder="Per què, per a què, criteri d’èxit…"
                      />
                    </label>
                  </div>

                  {form.periodicitat === "PERSONALITZAT" ? (
                    <div className={styles.mesosPick}>
                      <span className={styles.fieldLabel}>Mesos</span>
                      <div className={styles.mesosRow}>
                        {opcionsMesos("curt").map((o) => {
                          const on = form.mesosPerso.includes(o.value);
                          return (
                            <button
                              key={o.value}
                              type="button"
                              className={on ? styles.mesOn : styles.mesOff}
                              onClick={() => toggleMesPerso(o.value)}
                            >
                              {o.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className={styles.hintInline}>
                      Calendari: {etiquetaMesos(previewMesos, "llarg", ", ")} · Total any{" "}
                      {formatNum(previewAnual, 0)} €
                    </p>
                  )}

                  <div className={styles.formActions}>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      disabled={pending}
                      onClick={desarLinia}
                    >
                      Desar partida
                    </button>
                    <button
                      type="button"
                      className={styles.btnGhost}
                      onClick={() => {
                        setMostrarForm(false);
                        setForm(FORM_BUIT);
                      }}
                    >
                      Cancel·lar
                    </button>
                  </div>
                </div>
              ) : null}

              <div className={styles.liniesWrap}>
                {linies.length === 0 ? (
                  <p className={styles.hintInline}>
                    Encara no hi ha partides. Tria una categoria i defineix descripció, import i
                    calendari.
                  </p>
                ) : (
                  <table className={styles.liniesTable}>
                    <thead>
                      <tr>
                        <th>Categoria</th>
                        <th>Descripció</th>
                        <th>Periodicitat</th>
                        <th>Calendari</th>
                        <th className={styles.num}>€ / cop</th>
                        <th className={styles.num}>Total any</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {linies.map((l) => (
                        <tr key={l.id}>
                          <td>{labelCat(l.categoria)}</td>
                          <td>
                            <div className={styles.descCell}>{l.descripcio}</div>
                            {l.premissa ? (
                              <div className={styles.premissa}>{l.premissa}</div>
                            ) : null}
                          </td>
                          <td>{labelPeriodicitat(l.periodicitat)}</td>
                          <td className={styles.calShort}>{etiquetaMesos(l.mesos, "curt")}</td>
                          <td className={styles.num}>{formatNum(l.importUnitari, 0)}</td>
                          <td className={styles.num}>
                            {formatNum(importAnualLinia(l.importUnitari, l.mesos), 0)}
                          </td>
                          <td className={styles.rowActions}>
                            {!bloquejat ? (
                              <>
                                <button
                                  type="button"
                                  className={styles.linkBtn}
                                  onClick={() => editarLinia(l)}
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  className={styles.linkBtnDanger}
                                  onClick={() => eliminarLinia(l.id)}
                                >
                                  Eliminar
                                </button>
                              </>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : null}

          {vista === "calendari" ? (
            <div className={styles.calWrap}>
              {calendari.length === 0 ? (
                <p className={styles.hintInline}>Sense desemborsaments encara.</p>
              ) : (
                Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => {
                  const items = calendari.filter((c) => c.mes === mes);
                  if (!items.length) return null;
                  const suma = items.reduce((s, x) => s + x.import_, 0);
                  return (
                    <section key={mes} className={styles.calMes}>
                      <header className={styles.calMesHead}>
                        <h3>{nomMes(mes, "llarg")}</h3>
                        <span>{formatNum(suma, 0)} €</span>
                      </header>
                      <ul className={styles.calList}>
                        {items.map((it) => (
                          <li key={`${it.linia.id}-${mes}`}>
                            <span className={styles.calCat}>{labelCat(it.linia.categoria)}</span>
                            <span className={styles.calDesc}>{it.linia.descripcio}</span>
                            <span className={styles.num}>{formatNum(it.import_, 0)} €</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })
              )}
            </div>
          ) : null}

          {vista === "resum" ? (
            <div className={styles.gridWrap}>
              <table className={styles.grid}>
                <thead>
                  <tr>
                    <th className={styles.colDesc}>Categoria</th>
                    {opcionsMesos("curt").map((o) => (
                      <th key={o.value} className={styles.colMes}>
                        {o.label}
                      </th>
                    ))}
                    <th className={styles.colTotal}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[...resumMes.perCat.entries()].map(([cat, vals]) => (
                    <tr key={cat}>
                      <td className={styles.colDesc}>{labelCat(cat)}</td>
                      {opcionsMesos("curt").map((o) => {
                        const v = vals[o.value - 1] ?? 0;
                        return (
                          <td key={o.value} className={styles.colMes}>
                            {v === 0 ? "" : formatNum(v, 0)}
                          </td>
                        );
                      })}
                      <td className={styles.colTotal}>
                        {formatNum(
                          vals.reduce((a, b) => a + b, 0),
                          0
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className={styles.rowTotal}>
                    <td className={styles.colDesc}>Total</td>
                    {opcionsMesos("curt").map((o) => {
                      const v = resumMes.perMes[o.value - 1] ?? 0;
                      return (
                        <td key={o.value} className={styles.colMes}>
                          {v === 0 ? "" : formatNum(v, 0)}
                        </td>
                      );
                    })}
                    <td className={styles.colTotal}>{formatNum(totalAnual, 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
