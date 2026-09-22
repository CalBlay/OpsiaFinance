"use client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { BriefcaseBusiness, Check, PackageOpen, Save, UsersRound } from "lucide-react";
import { Fragment, useMemo, useState, useTransition } from "react";
import {
  saveGestioMatrixAction,
  savePersonalMatrixAction,
  updateNormaAction,
} from "./actions";
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
          value={value === 0 ? "" : String(value)}
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

export function RepartimentWorkspace({
  linies,
  departaments,
  assignacions,
  gestioRows,
  compres,
  refMesLabel,
  canEdit,
}: {
  linies: Ln[];
  departaments: Departament[];
  assignacions: Assignacio[];
  gestioRows: GestioRow[];
  compres: Compra[];
  refMesLabel: string | null;
  canEdit: boolean;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("personal");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const initialPersonal = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cell of assignacions) {
      map[`${cell.departamentId}:${cell.liniaNegociId}`] = cell.percentDept ?? 0;
    }
    return map;
  }, [assignacions]);
  const [personalDraft, setPersonalDraft] = useState(initialPersonal);

  const initialGestio = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of gestioRows) {
      for (const ln of linies) map[`${row.node}:${ln.id}`] = row.percentByLn[ln.id] ?? 0;
    }
    return map;
  }, [gestioRows, linies]);
  const [gestioDraft, setGestioDraft] = useState(initialGestio);

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
  const personalValid = departaments.every((dept) => Math.abs(personalTotal(dept.departamentId) - 100) <= 0.01);
  const gestioValid = gestioRows.every((row) => Math.abs(gestioTotal(row.node) - 100) <= 0.01);

  const notify = (result: { ok: boolean; missatge?: string }) => {
    setFeedback({ ok: result.ok, text: result.missatge ?? (result.ok ? "Canvis desats." : "No s'ha pogut desar.") });
  };

  const savePersonal = () => {
    startTransition(async () => {
      notify(
        await savePersonalMatrixAction(
          departaments.map((dept) => ({
            departamentId: dept.departamentId,
            percentByLn: linies.map((ln) => ({
              liniaNegociId: ln.id,
              percent: personalDraft[`${dept.departamentId}:${ln.id}`] ?? 0,
            })),
          }))
        )
      );
    });
  };

  const saveGestio = () => {
    startTransition(async () => {
      notify(
        await saveGestioMatrixAction(
          gestioRows.map((row) => ({
            node: row.node,
            label: row.label,
            percentByLn: linies.map((ln) => ({
              liniaNegociId: ln.id,
              percent: gestioDraft[`${row.node}:${ln.id}`] ?? 0,
            })),
          }))
        )
      );
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
                          startTransition(async () => notify(await updateNormaAction(rule.id, { valorPercent: value })));
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
            {canEdit && (
              <Button disabled={pending || !personalValid} onClick={savePersonal}>
                <Save size={16} /> {pending ? "Desant…" : "Desar personal"}
              </Button>
            )}
          </div>
          <div className={styles.matrixWrap}>
            <table className={styles.matrix}>
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
                            disabled={!canEdit || pending || dept.departamentId.startsWith("__sense__")}
                            onChange={(value) =>
                              setPersonalDraft((current) => ({
                                ...current,
                                [`${dept.departamentId}:${ln.id}`]: value,
                              }))
                            }
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
        </section>
      )}

      {activeTab === "gestio" && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>03 · Cost de gestió</span>
              <h2>Una decisió diferent per a cada partida</h2>
              <p>Distribueix cada línia del compte d’explotació i comprova l’import resultant al moment.</p>
            </div>
            {canEdit && (
              <Button disabled={pending || !gestioValid} onClick={saveGestio}>
                <Save size={16} /> {pending ? "Desant…" : "Desar gestió"}
              </Button>
            )}
          </div>
          <div className={styles.matrixWrap}>
            <table className={styles.matrix}>
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
                        disabled={!canEdit || pending}
                        onChange={(value) =>
                          setGestioDraft((current) => ({
                            ...current,
                            [`${row.node}:${ln.id}`]: value,
                          }))
                        }
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
