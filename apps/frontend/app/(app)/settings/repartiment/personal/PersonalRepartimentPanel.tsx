"use client";

import { Button } from "@/components/ui/Button";
import { formatNum } from "@/lib/utils";
import type { ModeRepartimentPersonalLn } from "@prisma/client";
import Link from "next/link";
import { Fragment, useMemo, useState, useTransition } from "react";
import styles from "../page.module.css";
import { saveConfigPersonalLnCompletaAction, updatePesDefecteComercialAction } from "./actions";

type LnConfig = {
  id: string;
  codi: string;
  nom: string;
  mode: ModeRepartimentPersonalLn;
  importFixTotal: number | null;
};

type DeptRow = {
  departamentId: string;
  centreCodi: string;
  centreNom: string;
  deptCodi: string;
  deptNom: string;
  costRef: number;
};

type DeptAssign = {
  liniaNegociId: string;
  departamentId: string;
  actiu: boolean;
  percentDept: number | null;
  pesInternFix: number | null;
};

type PesDefecte = {
  liniaNegociId: string;
  codi: string;
  pesDefecte: number;
};

function parseNum(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function PersonalRepartimentPanel({
  lnsConfig,
  lnsComercial,
  departaments,
  assignacions,
  pesDefecte,
  refMesLabel,
  canEdit,
}: {
  lnsConfig: LnConfig[];
  lnsComercial: { id: string; codi: string; nom: string }[];
  departaments: DeptRow[];
  assignacions: DeptAssign[];
  pesDefecte: PesDefecte[];
  refMesLabel: string | null;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [modalLnId, setModalLnId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const lnConfig = lnsConfig.find((l) => l.id === modalLnId) ?? null;

  const assignMap = useMemo(() => {
    const m = new Map<string, DeptAssign>();
    for (const a of assignacions) {
      m.set(`${a.liniaNegociId}:${a.departamentId}`, a);
    }
    return m;
  }, [assignacions]);

  const deptsPerCentre = useMemo(() => {
    const map = new Map<string, DeptRow[]>();
    for (const d of departaments) {
      const key = `${d.centreCodi} · ${d.centreNom}`;
      const list = map.get(key) ?? [];
      list.push(d);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [departaments]);

  function getAssign(lnId: string, deptId: string): DeptAssign | undefined {
    return assignMap.get(`${lnId}:${deptId}`);
  }

  function explicitImportAbsForLnDept(ln: LnConfig, deptId: string, costRef: number): number {
    const a = getAssign(ln.id, deptId);
    if (!a?.actiu) return 0;
    if (ln.mode === "PERCENT_DEPT") {
      const pct = a.percentDept ?? 0;
      if (pct === 0 || costRef === 0) return 0;
      return costRef * (pct / 100);
    }

    // FIX_TOTAL: repartim importFixTotal segons "pesInternFix" entre depts actius.
    const fixTotalAbs = ln.importFixTotal != null ? Math.abs(ln.importFixTotal) : 0;
    if (fixTotalAbs === 0) return 0;

    let sumPes = 0;
    for (const d of departaments) {
      const aa = getAssign(ln.id, d.departamentId);
      if (!aa?.actiu) continue;
      // Si pes no està definit (null), fem per defecte un pes relatiu = 1.
      sumPes += Math.max(0, aa.pesInternFix ?? 1);
    }
    const pes = a.pesInternFix ?? 1;
    if (sumPes <= 0 || pes <= 0) return 0;
    return fixTotalAbs * (pes / sumPes);
  }

  const totalsConfigured = new Map<string, number>();
  for (const ln of lnsConfig) totalsConfigured.set(ln.id, 0);
  for (const d of departaments) {
    for (const ln of lnsConfig) {
      const v = explicitImportAbsForLnDept(ln, d.departamentId, d.costRef);
      totalsConfigured.set(ln.id, (totalsConfigured.get(ln.id) ?? 0) + v);
    }
  }

  const saveLnCompleta = (
    lnId: string,
    data: {
      mode: ModeRepartimentPersonalLn;
      importFixTotal: number | null;
      departaments: {
        departamentId: string;
        actiu: boolean;
        percentDept: number | null;
        pesInternFix: number | null;
      }[];
    }
  ) => {
    startTransition(async () => {
      const r = await saveConfigPersonalLnCompletaAction(lnId, data);
      if (r.ok) {
        setFeedback(r.missatge ?? "Configuració desada.");
        setModalLnId(null);
      } else if (r.missatge) {
        setFeedback(r.missatge);
      }
    });
  };

  return (
    <div className={styles.stack}>
      <p className={styles.helpText}>
        Pool = personal SAP de Central (font). LN00000/01/04/05/06 són LN destí amb import fix/%
        (LN00000 no és només el residual). El <strong>sobrant</strong> va a LN00002 i LN00003: 50% a
        parts iguals i 50% segons el pes de vendes sobre (vendes02 + vendes03). Sense vendes → pes
        per defecte a la meitat de vendes. FDLC no participa.
        {refMesLabel
          ? ` Costos de referència (nòmina): ${refMesLabel}.`
          : " Sense dades de nòmina de referència."}
      </p>

      {feedback && <p className={styles.feedbackOk}>{feedback}</p>}

      <div className={styles.actionsBlock}>
        <div className={styles.actions}>
          {lnsConfig.map((ln) => (
            <Button
              key={ln.id}
              variant="outline"
              disabled={pending}
              onClick={() => setModalLnId(ln.id)}
            >
              Configurar {ln.codi}
            </Button>
          ))}
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Pesos per defecte (LN00002 / LN00003)</h2>
        <div className={styles.actions} style={{ flexWrap: "wrap" }}>
          {pesDefecte.map((p) => (
            <label
              key={p.liniaNegociId}
              style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
            >
              <span>{p.codi}</span>
              <input
                className={styles.inlineInput}
                type="text"
                defaultValue={String((p.pesDefecte * 100).toFixed(1))}
                disabled={!canEdit || pending}
                onBlur={(e) => {
                  const v = parseNum(e.target.value);
                  if (v == null) return;
                  startTransition(async () => {
                    await updatePesDefecteComercialAction(p.liniaNegociId, v / 100);
                  });
                }}
              />
              <span>%</span>
            </label>
          ))}
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Matriu departament × LN</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Centre / Departament</th>
              <th>Cost ref.</th>
              {lnsConfig.map((ln) => (
                <th key={ln.id}>{ln.codi}</th>
              ))}
              {lnsComercial.map((ln) => (
                <th key={ln.id}>{ln.codi} (auto)</th>
              ))}
              <th>Queda %</th>
            </tr>
          </thead>
          <tbody>
            {deptsPerCentre.map(([centreLabel, depts]) => (
              <Fragment key={centreLabel}>
                <tr className={styles.lnSection}>
                  <td colSpan={3 + lnsConfig.length + lnsComercial.length}>
                    <strong>{centreLabel}</strong>
                  </td>
                </tr>
                {depts.map((d) => {
                  return (
                    <tr key={d.departamentId}>
                      <td>
                        {d.deptCodi} · {d.deptNom}
                      </td>
                      <td>{d.costRef > 0 ? `${formatNum(d.costRef)} €` : "—"}</td>
                      {(() => {
                        const explicitImports = lnsConfig.map((ln) =>
                          explicitImportAbsForLnDept(ln, d.departamentId, d.costRef)
                        );
                        const explicitSumAbs = explicitImports.reduce((s, v) => s + v, 0);
                        const remainderPct =
                          d.costRef > 0
                            ? Math.max(0, ((d.costRef - explicitSumAbs) / d.costRef) * 100)
                            : 0;

                        return (
                          <>
                            {lnsConfig.map((ln, idx) => {
                              const impAbs = explicitImports[idx] ?? 0;
                              if (impAbs === 0) return <td key={ln.id}>—</td>;
                              const pct = d.costRef > 0 ? (impAbs / d.costRef) * 100 : 0;
                              return (
                                <td key={ln.id}>
                                  <div
                                    style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
                                  >
                                    {formatNum(impAbs)} €
                                  </div>
                                  <div
                                    style={{
                                      color: "var(--opsia-ink-soft)",
                                      fontVariantNumeric: "tabular-nums",
                                    }}
                                  >
                                    {pct > 0.0001 ? `${pct.toFixed(1)}%` : ""}
                                  </div>
                                </td>
                              );
                            })}
                            {lnsComercial.map((ln) => (
                              <td key={ln.id} className={styles.cellMuted}>
                                {remainderPct > 0 ? `${remainderPct.toFixed(1)}% × vendes` : "—"}
                              </td>
                            ))}
                            <td
                              className={
                                d.costRef > 0
                                  ? remainderPct === 0
                                    ? styles.cellOk
                                    : styles.cellWarn
                                  : styles.cellMuted
                              }
                            >
                              {remainderPct === 0 ? "0.0%" : `${remainderPct.toFixed(1)}%`}
                            </td>
                          </>
                        );
                      })()}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
            <tr>
              <td>
                <strong>TOTAL</strong>
              </td>
              <td />
              {lnsConfig.map((ln) => (
                <td key={ln.id}>
                  <div style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                    {formatNum(totalsConfigured.get(ln.id) ?? 0)} €
                  </div>
                </td>
              ))}
              {lnsComercial.map((ln) => (
                <td key={ln.id} className={styles.cellMuted}>
                  —
                </td>
              ))}
              <td className={styles.cellMuted}>—</td>
            </tr>
          </tbody>
        </table>
      </div>

      {modalLnId && lnConfig && (
        <LnModal
          ln={lnConfig}
          departaments={departaments}
          assignacions={assignacions.filter((a) => a.liniaNegociId === modalLnId)}
          canEdit={canEdit}
          pending={pending}
          onClose={() => setModalLnId(null)}
          onSave={saveLnCompleta}
        />
      )}

      <p className={styles.helpText}>
        Compres i gestió: <Link href="/settings/repartiment/normes">pestanya Compres i gestió</Link>
        .
      </p>
    </div>
  );
}

function LnModal({
  ln,
  departaments,
  assignacions,
  canEdit,
  pending,
  onClose,
  onSave,
}: {
  ln: LnConfig;
  departaments: DeptRow[];
  assignacions: DeptAssign[];
  canEdit: boolean;
  pending: boolean;
  onClose: () => void;
  onSave: (
    lnId: string,
    data: {
      mode: ModeRepartimentPersonalLn;
      importFixTotal: number | null;
      departaments: {
        departamentId: string;
        actiu: boolean;
        percentDept: number | null;
        pesInternFix: number | null;
      }[];
    }
  ) => void;
}) {
  const [mode, setMode] = useState<ModeRepartimentPersonalLn>(ln.mode);
  const [fixTotal, setFixTotal] = useState(String(ln.importFixTotal ?? ""));

  type DraftDept = {
    actiu: boolean;
    valor: string;
  };

  const [draft, setDraft] = useState<Record<string, DraftDept>>(() => {
    const init: Record<string, DraftDept> = {};
    for (const d of departaments) {
      const a = assignacions.find((x) => x.departamentId === d.departamentId);
      init[d.departamentId] = {
        actiu: a?.actiu ?? false,
        valor: String(ln.mode === "PERCENT_DEPT" ? (a?.percentDept ?? "") : (a?.pesInternFix ?? 1)),
      };
    }
    return init;
  });

  const deptsPerCentre = useMemo(() => {
    const map = new Map<string, DeptRow[]>();
    for (const d of departaments) {
      const key = `${d.centreCodi} · ${d.centreNom}`;
      const list = map.get(key) ?? [];
      list.push(d);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [departaments]);

  const patchDraft = (deptId: string, patch: Partial<DraftDept>) => {
    setDraft((prev) => ({
      ...prev,
      [deptId]: { ...(prev[deptId] ?? { actiu: false, valor: "" }), ...patch },
    }));
  };

  const handleSave = () => {
    onSave(ln.id, {
      mode,
      importFixTotal: mode === "FIX_TOTAL" ? parseNum(fixTotal) : null,
      departaments: departaments.map((d) => {
        const row = draft[d.departamentId] ?? { actiu: false, valor: "" };
        const n = parseNum(row.valor);
        return {
          departamentId: d.departamentId,
          actiu: row.actiu,
          percentDept: mode === "PERCENT_DEPT" ? n : null,
          pesInternFix: mode === "FIX_TOTAL" ? (n ?? 1) : null,
        };
      }),
    });
  };

  return (
    <div className={styles.modalBackdrop}>
      <dialog className={styles.modal} aria-labelledby="ln-modal-title" open>
        <h2 id="ln-modal-title" className={styles.cardTitle}>
          {ln.codi} · {ln.nom}
        </h2>

        {canEdit && (
          <div
            style={{
              marginBottom: "1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <label>
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "PERCENT_DEPT"}
                  onChange={() => setMode("PERCENT_DEPT")}
                />{" "}
                % per departament
              </label>
              <label>
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "FIX_TOTAL"}
                  onChange={() => setMode("FIX_TOTAL")}
                />{" "}
                Import fix total
              </label>
            </div>
            {mode === "FIX_TOTAL" && (
              <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                Import fix mensual (€)
                <input
                  className={styles.inlineInput}
                  value={fixTotal}
                  onChange={(e) => setFixTotal(e.target.value)}
                />
              </label>
            )}
            <p className={styles.helpText}>
              Marca departaments i escriu els valors. Res no es desa fins que premis{" "}
              <strong>Desar</strong>.
            </p>
          </div>
        )}

        <div style={{ maxHeight: "50vh", overflow: "auto" }}>
          {deptsPerCentre.map(([centreLabel, depts]) => (
            <Fragment key={centreLabel}>
              <p style={{ fontWeight: 600, margin: "0.75rem 0 0.25rem" }}>{centreLabel}</p>
              {depts.map((d) => {
                const row = draft[d.departamentId] ?? { actiu: false, valor: "" };
                const disabled = d.departamentId.startsWith("__sense__");
                return (
                  <div
                    key={d.departamentId}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto auto",
                      gap: "0.5rem",
                      alignItems: "center",
                      padding: "0.35rem 0",
                      borderBottom: "1px solid var(--opsia-border)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={row.actiu}
                      disabled={!canEdit || pending || disabled}
                      onChange={(e) => patchDraft(d.departamentId, { actiu: e.target.checked })}
                    />
                    <span>
                      {d.deptCodi} · {d.deptNom}
                      {d.costRef > 0 && (
                        <span style={{ color: "var(--opsia-ink-soft)", marginLeft: "0.5rem" }}>
                          ({formatNum(d.costRef)} €)
                        </span>
                      )}
                    </span>
                    <input
                      className={styles.inlineInput}
                      value={row.valor}
                      disabled={!row.actiu || !canEdit || pending || disabled}
                      onChange={(e) => patchDraft(d.departamentId, { valor: e.target.value })}
                      placeholder={mode === "PERCENT_DEPT" ? "%" : "pes"}
                    />
                    <span style={{ color: disabled ? "var(--opsia-ink-soft)" : undefined }}>
                      {mode === "PERCENT_DEPT" ? "%" : "pes"}
                    </span>
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>

        <div
          style={{
            marginTop: "1rem",
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.75rem",
          }}
        >
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel·lar
          </Button>
          {canEdit && (
            <Button disabled={pending} onClick={handleSave}>
              {pending ? "Desant…" : "Desar"}
            </Button>
          )}
        </div>
      </dialog>
    </div>
  );
}
