"use client";

import { cn } from "@/lib/utils";
import {
  BriefcaseBusiness,
  Check,
  Cloud,
  LoaderCircle,
  PackageOpen,
  UsersRound,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { saveGestioMatrixAction, savePersonalMatrixAction, updateNormaAction } from "./actions";
import styles from "./page.module.css";

type Ln = { id: string; codi: string; nom: string };
type Departament = {
  departamentId: string;
  centreCodi: string;
  centreNom: string;
  deptCodi: string;
  deptNom: string;
  costRef: number;
};
type Assignacio = { liniaNegociId: string; departamentId: string; percentDept: number | null };
type GestioRow = {
  node: number;
  label: string;
  costRef: number;
  percentByLn: Record<string, number>;
};
type Compra = {
  id: string;
  nom: string;
  tipus: string;
  valorPercent: number | null;
  liniaNegociDesti: { codi: string; nom: string } | null;
  grup: { codi: string; nom: string } | null;
};

const tabs = [
  { id: "compres", label: "Cost de compres", icon: PackageOpen },
  { id: "personal", label: "Cost de personal", icon: UsersRound },
  { id: "gestio", label: "Cost de gestió", icon: BriefcaseBusiness },
] as const;
type TabId = (typeof tabs)[number]["id"];
type AutosaveState = "idle" | "draft" | "saving" | "saved" | "error";

const PERSONAL_DRAFT_KEY = "opsia:repartiment:personal-draft-v1";
const GESTIO_DRAFT_KEY = "opsia:repartiment:gestio-draft-v1";

function numberFromInput(raw: string): number {
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
}

function money(value: number) {
  return new Intl.NumberFormat("ca-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function MatrixCell({
  value,
  base,
  disabled,
  onChange,
}: {
  value: number;
  base: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <td className={styles.matrixCell}>
      <div className={styles.percentEditor}>
        <input
          aria-label="Percentatge de repartiment"
          inputMode="decimal"
          defaultValue={value === 0 ? "" : String(value)}
          placeholder="0"
          disabled={disabled}
          onChange={(event) => onChange(numberFromInput(event.target.value))}
        />
        <span>%</span>
      </div>
      <small>{value ? money((base * value) / 100) : "—"}</small>
    </td>
  );
}

function TotalCell({ total }: { total: number }) {
  const ok = Math.abs(total - 100) <= 0.01;
  return (
    <td className={cn(styles.totalCell, ok ? styles.totalOk : styles.totalError)}>
      <strong>{total.toFixed(1)}%</strong>
      <span>{ok ? <Check size={13} /> : `${(100 - total).toFixed(1)}% pendent`}</span>
    </td>
  );
}

function AutosaveStatus({ state }: { state: AutosaveState }) {
  const content = {
    idle: { icon: <Cloud size={15} />, label: "Autodesat activat" },
    draft: { icon: <Cloud size={15} />, label: "Esborrany local · falta arribar al 100%" },
    saving: { icon: <LoaderCircle className={styles.spinner} size={15} />, label: "Desant…" },
    saved: { icon: <Check size={15} />, label: "Desat automàticament" },
    error: { icon: <Cloud size={15} />, label: "No s’ha pogut desar · esborrany conservat" },
  }[state];
  return (
    <span className={cn(styles.autosaveStatus, state === "error" && styles.autosaveError)}>
      {content.icon}
      {content.label}
    </span>
  );
}

export function RepartimentWorkspace({
  linies,
  departaments,
  assignacions,
  gestioRows,
  compres,
  reglesPersonal,
  refMesLabel,
  canEdit,
}: {
  linies: Ln[];
  departaments: Departament[];
  assignacions: Assignacio[];
  gestioRows: GestioRow[];
  compres: Compra[];
  reglesPersonal: Compra[];
  refMesLabel: string | null;
  canEdit: boolean;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("personal");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [personalDirty, setPersonalDirty] = useState<string[]>([]);
  const [gestioDirty, setGestioDirty] = useState(false);
  const [personalSaveState, setPersonalSaveState] = useState<AutosaveState>("idle");
  const [gestioSaveState, setGestioSaveState] = useState<AutosaveState>("idle");
  const [draftRevision, setDraftRevision] = useState(0);

  const initialPersonal = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cell of assignacions) {
      map[`${cell.departamentId}:${cell.liniaNegociId}`] = cell.percentDept ?? 0;
    }
    return map;
  }, [assignacions]);
  const [personalDraft, setPersonalDraft] = useState(initialPersonal);
  const latestPersonalRef = useRef(personalDraft);
  latestPersonalRef.current = personalDraft;

  const initialGestio = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of gestioRows) {
      for (const ln of linies) map[`${row.node}:${ln.id}`] = row.percentByLn[ln.id] ?? 0;
    }
    return map;
  }, [gestioRows, linies]);
  const [gestioDraft, setGestioDraft] = useState(initialGestio);
  const latestGestioRef = useRef(gestioDraft);
  latestGestioRef.current = gestioDraft;

  const deptsPerCentre = useMemo(() => {
    const groups = new Map<string, Departament[]>();
    for (const dept of departaments) {
      const key = `${dept.centreCodi} · ${dept.centreNom}`;
      groups.set(key, [...(groups.get(key) ?? []), dept]);
    }
    return [...groups.entries()];
  }, [departaments]);

  const personalTotal = (deptId: string) =>
    linies.reduce((sum, ln) => sum + (personalDraft[`${deptId}:${ln.id}`] ?? 0), 0);
  const gestioTotal = (node: number) =>
    linies.reduce((sum, ln) => sum + (gestioDraft[`${node}:${ln.id}`] ?? 0), 0);
  const gestioValid = gestioRows.every((row) => Math.abs(gestioTotal(row.node) - 100) <= 0.01);

  useEffect(() => {
    try {
      const personalSaved = window.localStorage.getItem(PERSONAL_DRAFT_KEY);
      if (personalSaved) {
        const parsed = JSON.parse(personalSaved) as {
          values?: Record<string, number>;
          dirty?: string[];
        };
        const validDepts = new Set(departaments.map((dept) => dept.departamentId));
        const dirty = (parsed.dirty ?? []).filter((id) => validDepts.has(id));
        if (dirty.length && parsed.values) {
          setPersonalDraft((current) => ({ ...current, ...parsed.values }));
          setPersonalDirty(dirty);
          setPersonalSaveState("draft");
        }
      }

      const gestioSaved = window.localStorage.getItem(GESTIO_DRAFT_KEY);
      if (gestioSaved) {
        const parsed = JSON.parse(gestioSaved) as {
          values?: Record<string, number>;
          dirty?: boolean;
        };
        if (parsed.dirty && parsed.values) {
          setGestioDraft((current) => ({ ...current, ...parsed.values }));
          setGestioDirty(true);
          setGestioSaveState("draft");
        }
      }
      setDraftRevision(1);
    } catch {
      window.localStorage.removeItem(PERSONAL_DRAFT_KEY);
      window.localStorage.removeItem(GESTIO_DRAFT_KEY);
    }
  }, [departaments]);

  useEffect(() => {
    if (!personalDirty.length) {
      window.localStorage.removeItem(PERSONAL_DRAFT_KEY);
      return;
    }
    window.localStorage.setItem(
      PERSONAL_DRAFT_KEY,
      JSON.stringify({ values: personalDraft, dirty: personalDirty })
    );
  }, [personalDraft, personalDirty]);

  useEffect(() => {
    if (!gestioDirty) {
      window.localStorage.removeItem(GESTIO_DRAFT_KEY);
      return;
    }
    window.localStorage.setItem(
      GESTIO_DRAFT_KEY,
      JSON.stringify({ values: gestioDraft, dirty: true })
    );
  }, [gestioDraft, gestioDirty]);

  const personalRowsToSave = useMemo(
    () =>
      departaments.filter(
        (dept) =>
          personalDirty.includes(dept.departamentId) &&
          !dept.departamentId.startsWith("__sense__") &&
          Math.abs(
            linies.reduce(
              (sum, ln) => sum + (personalDraft[`${dept.departamentId}:${ln.id}`] ?? 0),
              0
            ) - 100
          ) <= 0.01
      ),
    [departaments, linies, personalDraft, personalDirty]
  );

  useEffect(() => {
    if (!canEdit || personalDirty.length === 0) return;
    if (personalRowsToSave.length === 0) {
      setPersonalSaveState("draft");
      return;
    }

    const snapshot = personalDraft;
    const rows = personalRowsToSave.map((dept) => ({
      departamentId: dept.departamentId,
      percentByLn: linies.map((ln) => ({
        liniaNegociId: ln.id,
        percent: snapshot[`${dept.departamentId}:${ln.id}`] ?? 0,
      })),
    }));
    const timer = window.setTimeout(async () => {
      setPersonalSaveState("saving");
      let result: Awaited<ReturnType<typeof savePersonalMatrixAction>>;
      try {
        result = await savePersonalMatrixAction(rows);
      } catch {
        setPersonalSaveState("error");
        return;
      }
      if (!result.ok) {
        setPersonalSaveState("error");
        return;
      }
      const savedIds = new Set(
        rows
          .filter((row) =>
            row.percentByLn.every(
              (cell) =>
                (latestPersonalRef.current[`${row.departamentId}:${cell.liniaNegociId}`] ?? 0) ===
                cell.percent
            )
          )
          .map((row) => row.departamentId)
      );
      setPersonalDirty((current) => current.filter((id) => !savedIds.has(id)));
      setPersonalSaveState("saved");
    }, 700);
    return () => window.clearTimeout(timer);
  }, [canEdit, linies, personalDraft, personalDirty.length, personalRowsToSave]);

  useEffect(() => {
    if (!canEdit || !gestioDirty) return;
    if (!gestioValid) {
      setGestioSaveState("draft");
      return;
    }

    const snapshot = gestioDraft;
    const rows = gestioRows.map((row) => ({
      node: row.node,
      label: row.label,
      percentByLn: linies.map((ln) => ({
        liniaNegociId: ln.id,
        percent: snapshot[`${row.node}:${ln.id}`] ?? 0,
      })),
    }));
    const timer = window.setTimeout(async () => {
      setGestioSaveState("saving");
      let result: Awaited<ReturnType<typeof saveGestioMatrixAction>>;
      try {
        result = await saveGestioMatrixAction(rows);
      } catch {
        setGestioSaveState("error");
        return;
      }
      if (!result.ok) {
        setGestioSaveState("error");
        return;
      }
      const unchanged = rows.every((row) =>
        row.percentByLn.every(
          (cell) =>
            (latestGestioRef.current[`${row.node}:${cell.liniaNegociId}`] ?? 0) === cell.percent
        )
      );
      if (unchanged) setGestioDirty(false);
      setGestioSaveState("saved");
    }, 700);
    return () => window.clearTimeout(timer);
  }, [canEdit, gestioDraft, gestioDirty, gestioRows, gestioValid, linies]);

  const notify = (result: { ok: boolean; missatge?: string }) => {
    setFeedback({
      ok: result.ok,
      text: result.missatge ?? (result.ok ? "Canvis desats." : "No s'ha pogut desar."),
    });
  };

  return (
    <div className={styles.workspace}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Central → línies de negoci</span>
          <h1>Repartiment de costos</h1>
          <p>
            Defineix on va cada cost de la LN00000. Agenda és una destinació més i cada fila ha de
            quedar repartida al 100%.
          </p>
        </div>
        <div className={styles.heroRule}>
          <strong>Regla de control</strong>
          <span>100% assignat</span>
          <small>El total de l’empresa no canvia</small>
        </div>
      </section>

      <nav className={styles.blockTabs} aria-label="Blocs de cost">
        {tabs.map((tab, index) => (
          <button
            type="button"
            key={tab.id}
            className={cn(styles.blockTab, activeTab === tab.id && styles.blockTabActive)}
            onClick={() => {
              setFeedback(null);
              setActiveTab(tab.id);
            }}
          >
            <span className={styles.tabNumber}>0{index + 1}</span>
            <tab.icon size={18} />
            <span>
              <strong>{tab.label}</strong>
              <small>
                {tab.id === "compres"
                  ? "Criteris actuals"
                  : tab.id === "personal"
                    ? "Per centre i departament"
                    : "Per partida comptable"}
              </small>
            </span>
          </button>
        ))}
      </nav>

      {feedback && (
        <div className={feedback.ok ? styles.noticeOk : styles.noticeError}>{feedback.text}</div>
      )}

      {activeTab === "compres" && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>01 · Cost de compres</span>
              <h2>Mateix criteri, lectura més clara</h2>
              <p>Es manté el càlcul actual per vendes i pool de Central.</p>
            </div>
          </div>
          <div className={styles.ruleGrid}>
            {compres.map((rule) => (
              <article className={styles.ruleCard} key={rule.id}>
                <div>
                  <span className={styles.lnPill}>{rule.liniaNegociDesti?.codi ?? "Grup"}</span>
                  <h3>{rule.liniaNegociDesti?.nom ?? rule.grup?.nom ?? "Repartiment"}</h3>
                  <p>{rule.nom}</p>
                </div>
                <div className={styles.ruleMethod}>
                  <span>
                    {rule.tipus === "PERCENT_VENDES_PROPIES"
                      ? "% sobre vendes"
                      : rule.tipus === "REPARTIMENT_PROPORCIONAL"
                        ? "Proporcional a vendes"
                        : "% del pool Central"}
                  </span>
                  {rule.valorPercent == null ? (
                    <strong>Automàtic</strong>
                  ) : (
                    <label>
                      <input
                        inputMode="decimal"
                        defaultValue={rule.valorPercent}
                        disabled={!canEdit || pending}
                        onBlur={(event) => {
                          const value = numberFromInput(event.target.value);
                          if (value === rule.valorPercent) return;
                          startTransition(async () =>
                            notify(await updateNormaAction(rule.id, { valorPercent: value }))
                          );
                        }}
                      />
                      %
                    </label>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === "personal" && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>02 · Cost de personal</span>
              <h2>Quina part de cada equip dedica a cada LN?</h2>
              <p>
                Edita directament els percentatges. L’import de sota es recalcula al moment
                {refMesLabel ? ` amb el cost de referència de ${refMesLabel}` : ""}.
              </p>
            </div>
            {canEdit && <AutosaveStatus state={personalSaveState} />}
          </div>
          <div className={styles.matrixWrap}>
            <table className={styles.matrix} key={`personal-${draftRevision}`}>
              <thead>
                <tr>
                  <th className={styles.stickyLabel}>Centre / departament</th>
                  <th>Cost ref.</th>
                  {linies.map((ln) => (
                    <th key={ln.id}>
                      <strong>{ln.codi === "LN00000" ? "Agenda" : ln.nom}</strong>
                      <small>{ln.codi}</small>
                    </th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {deptsPerCentre.map(([centre, depts]) => (
                  <Fragment key={centre}>
                    <tr className={styles.groupRow}>
                      <td colSpan={linies.length + 3}>{centre}</td>
                    </tr>
                    {depts.map((dept) => (
                      <tr key={dept.departamentId}>
                        <td className={styles.stickyLabel}>
                          <strong>{dept.deptNom}</strong>
                          <small>{dept.deptCodi}</small>
                        </td>
                        <td className={styles.baseCell}>{money(dept.costRef)}</td>
                        {linies.map((ln) => (
                          <MatrixCell
                            key={ln.id}
                            value={personalDraft[`${dept.departamentId}:${ln.id}`] ?? 0}
                            base={dept.costRef}
                            disabled={!canEdit || dept.departamentId.startsWith("__sense__")}
                            onChange={(value) => {
                              setPersonalDraft((current) => ({
                                ...current,
                                [`${dept.departamentId}:${ln.id}`]: value,
                              }));
                              setPersonalDirty((current) =>
                                current.includes(dept.departamentId)
                                  ? current
                                  : [...current, dept.departamentId]
                              );
                              setPersonalSaveState("draft");
                            }}
                          />
                        ))}
                        <TotalCell total={personalTotal(dept.departamentId)} />
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {reglesPersonal.length > 0 && (
            <div className={styles.complementaryRules}>
              <div>
                <span className={styles.eyebrow}>Regles complementàries</span>
                <h3>Personal fora de Central</h3>
                <p>
                  Moviments específics que es calculen després de la matriu de Serveis Centrals.
                </p>
              </div>
              {reglesPersonal.map((rule) => (
                <article className={styles.inlineRule} key={rule.id}>
                  <div>
                    <span className={styles.lnPill}>
                      Destí {rule.liniaNegociDesti?.codi ?? "—"}
                    </span>
                    <strong>{rule.nom}</strong>
                  </div>
                  <label>
                    <input
                      inputMode="decimal"
                      defaultValue={rule.valorPercent ?? 0}
                      disabled={!canEdit || pending}
                      onBlur={(event) => {
                        const value = numberFromInput(event.target.value);
                        if (value === rule.valorPercent) return;
                        startTransition(async () =>
                          notify(await updateNormaAction(rule.id, { valorPercent: value }))
                        );
                      }}
                    />
                    %
                  </label>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "gestio" && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>03 · Cost de gestió</span>
              <h2>Una decisió diferent per a cada partida</h2>
              <p>
                Distribueix cada línia del compte d’explotació i comprova l’import resultant al
                moment.
              </p>
            </div>
            {canEdit && <AutosaveStatus state={gestioSaveState} />}
          </div>
          <div className={styles.matrixWrap}>
            <table className={styles.matrix} key={`gestio-${draftRevision}`}>
              <thead>
                <tr>
                  <th className={styles.stickyLabel}>Partida del compte</th>
                  <th>Central</th>
                  {linies.map((ln) => (
                    <th key={ln.id}>
                      <strong>{ln.codi === "LN00000" ? "Agenda" : ln.nom}</strong>
                      <small>{ln.codi}</small>
                    </th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {gestioRows.map((row) => (
                  <tr key={row.node}>
                    <td className={styles.stickyLabel}>
                      <strong>{row.label}</strong>
                      <small>Node {row.node}</small>
                    </td>
                    <td className={styles.baseCell}>{money(row.costRef)}</td>
                    {linies.map((ln) => (
                      <MatrixCell
                        key={ln.id}
                        value={gestioDraft[`${row.node}:${ln.id}`] ?? 0}
                        base={row.costRef}
                        disabled={!canEdit}
                        onChange={(value) => {
                          setGestioDraft((current) => ({
                            ...current,
                            [`${row.node}:${ln.id}`]: value,
                          }));
                          setGestioDirty(true);
                          setGestioSaveState("draft");
                        }}
                      />
                    ))}
                    <TotalCell total={gestioTotal(row.node)} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
