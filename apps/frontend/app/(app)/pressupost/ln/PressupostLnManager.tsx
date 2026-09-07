"use client";

import {
  aplicarSumaCentresAlGeneralAction,
  crearPressupostLnAction,
  desvincularGeneralDeCentresAction,
  setEstatPressupostLnAction,
  updateNotesPressupostLnAction,
  upsertPressupostCelAction,
  upsertPressupostCelCentreAction,
} from "@/app/(app)/pressupost/ln/actions";
import ui from "@/components/dades/dades-ui.module.css";
import { MESOS_CURTS, opcionsMesos } from "@/lib/periodes";
import type {
  LiniaNegociOption,
  PressupostCel,
  PressupostLnCapcalera,
} from "@/lib/pressupost/pressupost-ln";
import {
  type ConcepteTipusA,
  type ModeEntradaTipusA,
  PARTIDES_TIPUS_A,
  calcularEbitdaTipusA,
  calcularValorDesDeMode,
  importDesatAUi,
  importUiADesar,
} from "@/lib/pressupost/tipus-a";
import type { CentrePressupostOpt } from "@/lib/pressupost/tipus-a-data";
import {
  NODE_COMPRES,
  NODE_COST_GESTIO,
  NODE_COST_SALARIAL,
  NODE_EBITDA,
  NODE_VENDES,
} from "@/lib/repartiment/nodes";
import { formatNum } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import styles from "./PressupostLnManager.module.css";

type NivellVista = "general" | "centre";

type Props = {
  anyInicial: number;
  lnIdInicial: string | null;
  linies: LiniaNegociOption[];
  conceptes: ConcepteTipusA[];
  capcalera: PressupostLnCapcalera | null;
  cels: PressupostCel[];
  anysExistents: number[];
  canEdit: boolean;
  anyRef: number;
  refPerNodeMes: Record<number, number[]>;
  /** Centres disponibles si la LN admet detall (p.ex. restaurants). */
  centres: CentrePressupostOpt[];
  centreIdInicial: string | null;
  nivellInicial: NivellVista;
  teDetallCentres: boolean;
};

function celKey(concepteId: string, mes: number) {
  return `${concepteId}:${mes}`;
}

function parseImportInput(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "" || t === "-") return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function totalArr(arr: number[]) {
  return arr.reduce((s, v) => s + v, 0);
}

export function PressupostLnManager({
  anyInicial,
  lnIdInicial,
  linies,
  conceptes,
  capcalera,
  cels,
  anysExistents,
  canEdit,
  anyRef,
  refPerNodeMes,
  centres,
  centreIdInicial,
  nivellInicial,
  teDetallCentres,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [any, setAny] = useState(anyInicial);
  const [lnId, setLnId] = useState(lnIdInicial ?? linies[0]?.id ?? "");
  const [nivell, setNivell] = useState<NivellVista>(nivellInicial);
  const [centreId, setCentreId] = useState(centreIdInicial ?? centres[0]?.id ?? "");
  const [missatge, setMissatge] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState(capcalera?.notes ?? "");
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<ModeEntradaTipusA>("eur");

  const admetDetall = centres.length > 0;
  const vistaCentre = admetDetall && nivell === "centre";

  const byNode = useMemo(() => {
    const m = new Map<number, ConcepteTipusA>();
    for (const c of conceptes) m.set(c.node, c);
    return m;
  }, [conceptes]);

  const idVendes = byNode.get(NODE_VENDES)?.id ?? "";
  const idCompres = byNode.get(NODE_COMPRES)?.id ?? "";
  const idPersonal = byNode.get(NODE_COST_SALARIAL)?.id ?? "";
  const idGestio = byNode.get(NODE_COST_GESTIO)?.id ?? "";
  const idEbitda = byNode.get(NODE_EBITDA)?.id ?? "";

  useEffect(() => {
    setAny(anyInicial);
    setLnId(lnIdInicial ?? linies[0]?.id ?? "");
    setNivell(nivellInicial);
    setCentreId(centreIdInicial ?? centres[0]?.id ?? "");
  }, [anyInicial, lnIdInicial, linies, nivellInicial, centreIdInicial, centres]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset en canviar pressupost/centre/nivell
  useEffect(() => {
    setNotesDraft(capcalera?.notes ?? "");
    setOverrides({});
    setMissatge(null);
    setError(null);
  }, [capcalera?.id, centreIdInicial, nivellInicial]);

  const localMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cels) m.set(celKey(c.concepteResultatId, c.mes), c.import_);
    return m;
  }, [cels]);

  const valorDesat = useCallback(
    (concepteId: string, mes: number) => {
      const k = celKey(concepteId, mes);
      if (k in overrides) return overrides[k];
      return localMap.get(k) ?? 0;
    },
    [localMap, overrides]
  );

  const valorUi = useCallback(
    (concepteId: string, mes: number, esCost: boolean) =>
      importDesatAUi(valorDesat(concepteId, mes), esCost),
    [valorDesat]
  );

  const totalUi = useCallback(
    (concepteId: string, esCost: boolean) => {
      let s = 0;
      for (let mes = 1; mes <= 12; mes++) s += valorUi(concepteId, mes, esCost);
      return s;
    },
    [valorUi]
  );

  const ebitdaMes = useCallback(
    (mes: number) => {
      if (!idVendes || !idCompres || !idPersonal || !idGestio) return 0;
      return calcularEbitdaTipusA(
        valorDesat(idVendes, mes),
        valorDesat(idCompres, mes),
        valorDesat(idPersonal, mes),
        valorDesat(idGestio, mes)
      );
    },
    [idVendes, idCompres, idPersonal, idGestio, valorDesat]
  );

  const ebitdaTotal = useMemo(() => {
    let s = 0;
    for (let mes = 1; mes <= 12; mes++) s += ebitdaMes(mes);
    return s;
  }, [ebitdaMes]);

  function navega(nextAny: number, nextLn: string, nextNivell: NivellVista, nextCentre: string) {
    const q = new URLSearchParams();
    q.set("any", String(nextAny));
    if (nextLn) q.set("ln", nextLn);
    if (nextNivell === "centre" && nextCentre) {
      q.set("nivell", "centre");
      q.set("centre", nextCentre);
    }
    router.push(`/pressupost/ln?${q.toString()}`);
  }

  function onCanviAny(v: number) {
    setAny(v);
    setOverrides({});
    navega(v, lnId, nivell, centreId);
  }

  function onCanviLn(v: string) {
    setLnId(v);
    setOverrides({});
    // Canvi de LN → sempre general (els centres depenen de la LN).
    navega(any, v, "general", "");
  }

  function onCanviNivell(next: NivellVista) {
    setNivell(next);
    setOverrides({});
    const c = next === "centre" ? centreId || centres[0]?.id || "" : "";
    if (next === "centre" && c) setCentreId(c);
    navega(any, lnId, next, c);
  }

  function onCanviCentre(v: string) {
    setCentreId(v);
    setOverrides({});
    navega(any, lnId, "centre", v);
  }

  function crear() {
    if (!canEdit || !lnId) return;
    setError(null);
    setMissatge(null);
    startTransition(async () => {
      const r = await crearPressupostLnAction(any, lnId);
      if (!r.ok) {
        setError(r.missatge);
        return;
      }
      setMissatge(r.missatge);
      router.refresh();
    });
  }

  async function desarCelIEbitda(
    pressupostId: string,
    mes: number,
    concepteId: string,
    importDesar: number,
    nextOverrides: Record<string, number>
  ) {
    const upsert = vistaCentre
      ? (_cid: string, mid: number, conc: string, val: number) =>
          upsertPressupostCelCentreAction(pressupostId, centreId, mid, conc, val)
      : (_cid: string, mid: number, conc: string, val: number) =>
          upsertPressupostCelAction(pressupostId, mid, conc, val);

    const r = await upsert(concepteId, mes, concepteId, importDesar);
    if (!r.ok) return r;

    if (!idEbitda || !idVendes || !idCompres || !idPersonal || !idGestio) return r;

    const get = (id: string) => {
      const k = celKey(id, mes);
      if (k in nextOverrides) return nextOverrides[k];
      return localMap.get(k) ?? 0;
    };

    const ebitda = calcularEbitdaTipusA(
      get(idVendes),
      get(idCompres),
      get(idPersonal),
      get(idGestio)
    );
    const r2 = await upsert(idEbitda, mes, idEbitda, ebitda);
    if (r2.ok) {
      nextOverrides[celKey(idEbitda, mes)] = ebitda;
    }
    return r2.ok ? r : r2;
  }

  function guardarCel(concepteId: string, node: number, esCost: boolean, mes: number, raw: string) {
    if (!canEdit || !capcalera || capcalera.estat === "CONFIRMAT") return;
    if (vistaCentre && !centreId) {
      setError("Cal seleccionar un centre.");
      return;
    }
    const input = parseImportInput(raw);
    if (input == null) {
      setError("Valor no vàlid.");
      return;
    }

    const modeEfectiu: ModeEntradaTipusA =
      node === NODE_VENDES && mode === "pct_vendes" ? "eur" : mode;

    const vendesMesUi = idVendes ? valorUi(idVendes, mes, false) : 0;
    const vendesAnyAnt = Math.abs(refPerNodeMes[NODE_VENDES]?.[mes - 1] ?? 0);

    const valorCalculat = calcularValorDesDeMode({
      mode: modeEfectiu,
      input,
      esCost,
      vendesMes: vendesMesUi,
      vendesAnyAntMes: vendesAnyAnt,
    });

    if (valorCalculat == null) {
      if (modeEfectiu === "pct_vendes") {
        setError(`Cal omplir primer les vendes de ${MESOS_CURTS[mes - 1]}.`);
      } else if (modeEfectiu === "pct_any_ant") {
        setError(`No hi ha vendes de referència ${anyRef} a ${MESOS_CURTS[mes - 1]}.`);
      } else {
        setError("No s’ha pogut calcular el valor.");
      }
      return;
    }

    const importDesar = importUiADesar(valorCalculat, esCost);
    const k = celKey(concepteId, mes);
    const prev = localMap.get(k) ?? 0;
    if (Math.abs(importDesar - prev) < 0.005 && !(k in overrides)) return;

    const nextOverrides = { ...overrides, [k]: importDesar };
    setOverrides(nextOverrides);
    setError(null);
    if (modeEfectiu !== "eur") {
      setMissatge(
        modeEfectiu === "pct_vendes"
          ? `${input}% sobre vendes → ${formatNum(valorCalculat, 0)} €`
          : `${input}% sobre vendes ${anyRef} → ${formatNum(valorCalculat, 0)} €`
      );
    }

    startTransition(async () => {
      const r = await desarCelIEbitda(capcalera.id, mes, concepteId, importDesar, nextOverrides);
      if (!r.ok) {
        setError(r.missatge);
        setOverrides((o) => {
          const next = { ...o };
          delete next[k];
          return next;
        });
        return;
      }
      setOverrides((o) => ({ ...o, ...nextOverrides }));
    });
  }

  function setEstat(estat: "ESBORRANY" | "CONFIRMAT") {
    if (!canEdit || !capcalera) return;
    setError(null);
    startTransition(async () => {
      const r = await setEstatPressupostLnAction(capcalera.id, estat);
      if (!r.ok) {
        setError(r.missatge);
        return;
      }
      setMissatge(r.missatge);
      router.refresh();
    });
  }

  function guardarNotes() {
    if (!canEdit || !capcalera || capcalera.estat === "CONFIRMAT") return;
    startTransition(async () => {
      const r = await updateNotesPressupostLnAction(capcalera.id, notesDraft);
      if (!r.ok) setError(r.missatge);
      else setMissatge("Notes desades.");
    });
  }

  function aplicarAlGeneral() {
    if (!canEdit || !capcalera || capcalera.estat === "CONFIRMAT") return;
    if (
      !window.confirm(
        "Això sobreescriurà el pressupost general amb la suma de tots els centres. Continuar?"
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await aplicarSumaCentresAlGeneralAction(capcalera.id);
      if (!r.ok) {
        setError(r.missatge);
        return;
      }
      setMissatge(r.missatge);
      router.refresh();
    });
  }

  function desvincular() {
    if (!canEdit || !capcalera) return;
    startTransition(async () => {
      const r = await desvincularGeneralDeCentresAction(capcalera.id);
      if (!r.ok) {
        setError(r.missatge);
        return;
      }
      setMissatge(r.missatge);
      router.refresh();
    });
  }

  const anysOpts = useMemo(() => {
    const set = new Set(anysExistents);
    set.add(any);
    set.add(new Date().getFullYear());
    set.add(new Date().getFullYear() + 1);
    return [...set].sort((a, b) => b - a);
  }, [anysExistents, any]);

  const bloquejat = !canEdit || !capcalera || capcalera.estat === "CONFIRMAT";
  const teRef = totalArr(refPerNodeMes[NODE_VENDES] ?? []) !== 0;
  const centreActiu = centres.find((c) => c.id === centreId);

  const placeholderMode = mode === "eur" ? "€" : mode === "pct_vendes" ? "% vendes" : `% ${anyRef}`;

  const scopeKey = vistaCentre ? `c:${centreId}` : "g";

  return (
    <div className={styles.wrap} lang="ca" translate="no">
      <div className={ui.panel}>
        <div className={ui.panelHeader}>
          <h2 className={ui.panelTitle}>Selecció</h2>
          {pending ? <span className={ui.panelMeta}>Desant…</span> : null}
        </div>
        <div className={styles.filters}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Any</span>
            <select
              className={styles.select}
              value={any}
              onChange={(e) => onCanviAny(Number(e.target.value))}
            >
              {anysOpts.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Línia de negoci</span>
            <select
              className={styles.select}
              value={lnId}
              onChange={(e) => onCanviLn(e.target.value)}
            >
              {linies.map((ln) => (
                <option key={ln.id} value={ln.id}>
                  {ln.codi} · {ln.nom}
                </option>
              ))}
            </select>
          </label>

          {admetDetall ? (
            <>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Nivell</span>
                <div className={styles.nivellRow} role="radiogroup" aria-label="Nivell">
                  <label className={styles.modeOpt}>
                    <input
                      type="radio"
                      name="nivell"
                      checked={!vistaCentre}
                      onChange={() => onCanviNivell("general")}
                    />
                    General (LN)
                  </label>
                  <label className={styles.modeOpt}>
                    <input
                      type="radio"
                      name="nivell"
                      checked={vistaCentre}
                      onChange={() => onCanviNivell("centre")}
                    />
                    Per centre
                  </label>
                </div>
              </div>
              {vistaCentre ? (
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Centre</span>
                  <select
                    className={styles.select}
                    value={centreId}
                    onChange={(e) => onCanviCentre(e.target.value)}
                  >
                    {centres.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.codi} · {c.nom}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </>
          ) : null}

          {capcalera ? (
            <div className={styles.estatBlock}>
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
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={pending || !lnId}
              onClick={crear}
            >
              Crear pressupost {any}
            </button>
          ) : null}
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
        {missatge ? <p className={styles.ok}>{missatge}</p> : null}
      </div>

      {!capcalera ? (
        <p className={ui.empty}>
          Encara no hi ha pressupost per aquesta LN i any. Crea’l per omplir vendes, compres,
          personal, gestió i EBITDA
          {admetDetall ? " (general o per centre)" : ""}.
        </p>
      ) : (
        <>
          {admetDetall && !vistaCentre ? (
            <div className={ui.panel}>
              <div className={ui.panelHeader}>
                <h2 className={ui.panelTitle}>General ↔ centres</h2>
              </div>
              {capcalera.generalDesDeCentres ? (
                <p className={styles.hint}>
                  El general està sincronitzat amb la suma dels centres. Si edites una cel·la del
                  general, es desvincula automàticament.
                </p>
              ) : (
                <p className={styles.hint}>
                  Pots omplir el general a part, o el detall per restaurant i després aplicar la
                  suma al general (opcional).
                </p>
              )}
              {!bloquejat ? (
                <div className={styles.syncRow}>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    disabled={pending || !teDetallCentres}
                    onClick={aplicarAlGeneral}
                    title={
                      teDetallCentres
                        ? "Sobreescriu el general amb la suma dels centres"
                        : "Encara no hi ha xifres als centres"
                    }
                  >
                    Aplicar suma centres → general
                  </button>
                  {capcalera.generalDesDeCentres ? (
                    <button
                      type="button"
                      className={styles.btnGhost}
                      disabled={pending}
                      onClick={desvincular}
                    >
                      Desvincular
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {vistaCentre && centreActiu ? (
            <p className={styles.hint}>
              Detall: {centreActiu.nom}. El general no canvia fins que apliquis la suma des de la
              vista General.
            </p>
          ) : null}

          <div className={ui.panel}>
            <div className={ui.panelHeader}>
              <h2 className={ui.panelTitle}>Notes</h2>
            </div>
            <textarea
              className={styles.notes}
              rows={2}
              value={notesDraft}
              disabled={bloquejat}
              onChange={(e) => setNotesDraft(e.target.value)}
              onBlur={guardarNotes}
              placeholder="Observacions del pressupost anual…"
            />
          </div>

          {!bloquejat ? (
            <div className={ui.panel}>
              <div className={ui.panelHeader}>
                <h2 className={ui.panelTitle}>Mode d’entrada</h2>
                <span className={ui.panelMeta}>
                  El valor es converteix a € en desar (costos en positiu)
                </span>
              </div>
              <div className={styles.modeRow} role="radiogroup" aria-label="Mode d’entrada">
                <label className={styles.modeOpt}>
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === "eur"}
                    onChange={() => setMode("eur")}
                  />
                  Valor unitari (€)
                </label>
                <label className={styles.modeOpt}>
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === "pct_vendes"}
                    onChange={() => setMode("pct_vendes")}
                  />
                  % sobre vendes (pressupost)
                </label>
                <label className={styles.modeOpt}>
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === "pct_any_ant"}
                    onChange={() => setMode("pct_any_ant")}
                  />
                  % sobre vendes Gestió {anyRef}
                </label>
              </div>
              {mode === "pct_vendes" ? (
                <p className={styles.hint}>
                  Per a costos: escriu el % i es calcula sobre les vendes del mateix mes. Les vendes
                  s’entren sempre en € (o % any anterior).
                </p>
              ) : null}
              {mode === "pct_any_ant" ? (
                <p className={styles.hint}>
                  Escriu el % sobre les vendes Gestió de {anyRef} del mateix mes (fila de referència
                  a sota).
                </p>
              ) : null}
            </div>
          ) : null}

          <div className={styles.gridWrap}>
            <table className={styles.grid}>
              <thead>
                <tr>
                  <th className={styles.colDesc}>Partida</th>
                  {MESOS_CURTS.map((m) => (
                    <th key={m} className={styles.colMes}>
                      {m}
                    </th>
                  ))}
                  <th className={styles.colTotal}>Total</th>
                  <th className={styles.colRef}>Gestió {anyRef}</th>
                </tr>
              </thead>
              <tbody>
                <tr className={styles.rowRef}>
                  <td className={styles.colDesc}>Vendes Gestió {anyRef}</td>
                  {opcionsMesos("curt").map((o) => {
                    const arr = refPerNodeMes[NODE_VENDES] ?? Array(12).fill(0);
                    const v = arr[o.value - 1] ?? 0;
                    return (
                      <td key={o.value} className={styles.colMes}>
                        <span className={styles.refCell}>
                          {v === 0 ? "—" : formatNum(Math.abs(v), 0)}
                        </span>
                      </td>
                    );
                  })}
                  <td className={styles.colTotal}>
                    {teRef
                      ? formatNum(Math.abs(totalArr(refPerNodeMes[NODE_VENDES] ?? [])), 0)
                      : "—"}
                  </td>
                  <td className={styles.colRef}>ref.</td>
                </tr>

                {PARTIDES_TIPUS_A.map((p) => {
                  const concepte = byNode.get(p.node);
                  if (!concepte) return null;
                  const refSum = totalArr(refPerNodeMes[p.node] ?? []);
                  const refTotal = p.esCalculat ? refSum : Math.abs(refSum);

                  if (p.esCalculat) {
                    return (
                      <tr key={p.node} className={styles.rowEbitda}>
                        <td className={styles.colDesc}>{p.label}</td>
                        {Array.from({ length: 12 }, (_, i) => {
                          const mes = i + 1;
                          const v = ebitdaMes(mes);
                          return (
                            <td key={mes} className={styles.colMes}>
                              <span className={styles.readonly}>
                                {v === 0 ? "" : formatNum(v, 0)}
                              </span>
                            </td>
                          );
                        })}
                        <td className={styles.colTotal}>{formatNum(ebitdaTotal, 0)}</td>
                        <td className={styles.colRef}>
                          {refTotal === 0 ? "—" : formatNum(refTotal, 0)}
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={p.node}>
                      <td className={styles.colDesc}>{p.label}</td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const mes = i + 1;
                        const v = valorUi(concepte.id, mes, p.esCost);
                        return (
                          <td key={mes} className={styles.colMes}>
                            {bloquejat ? (
                              <span className={styles.readonly}>
                                {v === 0 ? "" : formatNum(v, 0)}
                              </span>
                            ) : (
                              <input
                                className={styles.celInput}
                                inputMode="decimal"
                                placeholder={placeholderMode}
                                defaultValue={v === 0 ? "" : String(v)}
                                key={`${capcalera.id}-${scopeKey}-${concepte.id}-${mes}-${v}`}
                                onBlur={(e) =>
                                  guardarCel(concepte.id, p.node, p.esCost, mes, e.target.value)
                                }
                                aria-label={`${p.label} ${MESOS_CURTS[i]}`}
                              />
                            )}
                          </td>
                        );
                      })}
                      <td className={styles.colTotal}>
                        {formatNum(totalUi(concepte.id, p.esCost), 0)}
                      </td>
                      <td className={styles.colRef}>
                        {refTotal === 0 ? "—" : formatNum(refTotal, 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
