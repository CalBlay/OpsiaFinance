"use client";

import { Button } from "@/components/ui/Button";
import { CONCEPTE_NODE_LABEL } from "@/lib/repartiment/nodes";
import { Fragment, useState, useTransition } from "react";
import {
  carregarNormesSeedAction,
  esborrarTotRepartimentAction,
  inicialitzarNormesAction,
  toggleNormaAction,
  updateNormaAction,
} from "./actions";
import styles from "./page.module.css";

type Norma = {
  id: string;
  nom: string | null;
  tipus: string;
  actiu: boolean;
  ordre: number;
  concepteNode: number;
  valorPercent: number | null;
  valorImport: number | null;
  liniaNegociDesti: { codi: string; nom: string } | null;
  grup: { codi: string; nom: string } | null;
};

function valorEditable(tipus: string): "percent" | "import" | null {
  if (tipus === "PERCENT_VENDES_PROPIES" || tipus === "PERCENT_POOL_CENTRAL") return "percent";
  if (tipus === "IMPORT_FIX") return "import";
  if (tipus === "RESTEM") return "percent";
  return null;
}

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function NormesRepartimentPanel({
  normes,
  grups,
  canEdit,
}: {
  normes: Norma[];
  grups: { codi: string; nom: string; membres: { liniaNegoci: { codi: string } }[] }[];
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; missatge: string } | null>(null);

  const notify = (r: { ok: boolean; missatge?: string }) => {
    if (!r.missatge) return;
    setFeedback({ ok: r.ok, missatge: r.missatge });
    if (r.ok) setTimeout(() => setFeedback(null), 5000);
  };

  const normesPerLn = normes.reduce<Map<string, Norma[]>>((acc, n) => {
    const codi = n.liniaNegociDesti?.codi ?? "—";
    const list = acc.get(codi) ?? [];
    list.push(n);
    acc.set(codi, list);
    return acc;
  }, new Map());

  const blocsLn = [...normesPerLn.entries()].sort(([a], [b]) => a.localeCompare(b));

  const saveField = (id: string, patch: Parameters<typeof updateNormaAction>[1]) => {
    startTransition(async () => {
      const r = await updateNormaAction(id, patch);
      notify(r);
    });
  };

  return (
    <div className={styles.stack}>
      {canEdit && (
        <div className={styles.actionsBlock}>
          <div className={styles.actions}>
            <Button
              disabled={pending}
              variant="default"
              onClick={() => {
                if (
                  !window.confirm(
                    "Esborrarà tot i carregarà les normes confirmades del seed (LN00000 + LN00001). Continuar?"
                  )
                ) {
                  return;
                }
                startTransition(async () => {
                  notify(await carregarNormesSeedAction());
                });
              }}
            >
              Reiniciar amb normes confirmades
            </Button>
            <Button
              disabled={pending}
              variant="outline"
              onClick={() =>
                startTransition(async () => {
                  notify(await inicialitzarNormesAction());
                })
              }
            >
              Sincronitzar noves normes
            </Button>
            <Button
              disabled={pending}
              variant="outline"
              onClick={() => {
                if (
                  !window.confirm(
                    "Esborrarà totes les normes i execucions mensuals, sense carregar res. Continuar?"
                  )
                ) {
                  return;
                }
                startTransition(async () => {
                  notify(await esborrarTotRepartimentAction());
                });
              }}
            >
              Esborrar tot
            </Button>
          </div>
          <p className={styles.helpText}>
            Confirmades: LN00002/03 compres pool+SAP · personal pool · LN00004 gestió 30% i suport
            personal per centres editable · LN00005/06. «Sincronitzar noves normes» afegeix del seed
            sense esborrar les existents.
          </p>
        </div>
      )}

      {feedback && (
        <p className={feedback.ok ? styles.feedbackOk : styles.feedbackErr}>{feedback.missatge}</p>
      )}

      {grups.length > 0 && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Grups de repartiment proporcional</h2>
          <ul className={styles.grupList}>
            {grups.map((g) => (
              <li key={g.codi}>
                <strong>{g.codi}</strong> — {g.nom}
                <span className={styles.muted}>
                  {" "}
                  ({g.membres.map((m) => m.liniaNegoci.codi).join(", ")})
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Normes</h2>
        {canEdit && (
          <p className={styles.helpText}>
            Clica un camp editable (ordre, nom, valor) i prem Tab o surt del camp per desar. Els
            canvis s&apos;apliquen als mesos que recalculis després.
          </p>
        )}
        {normes.length === 0 ? (
          <p className={styles.muted}>Encara no hi ha normes. Carrega la configuració inicial.</p>
        ) : (
          <table className={`${styles.table} ${styles.normesTable}`}>
            <thead>
              <tr>
                <th className={styles.colOrdre}>Ordre</th>
                <th className={styles.colNom}>Nom</th>
                <th>Tipus</th>
                <th>LN destí</th>
                <th>Concepte</th>
                <th>Valor</th>
                {canEdit && <th>Activa</th>}
              </tr>
            </thead>
            <tbody>
              {blocsLn.map(([codiLn, blocNormes]) => (
                <Fragment key={codiLn}>
                  <tr key={`ln-${codiLn}`} className={styles.lnSection}>
                    <td colSpan={canEdit ? 7 : 6}>
                      <strong>{codiLn}</strong>
                      {blocNormes[0]?.liniaNegociDesti?.nom
                        ? ` · ${blocNormes[0].liniaNegociDesti.nom}`
                        : ""}
                    </td>
                  </tr>
                  {blocNormes.map((n) => {
                    const editValor = valorEditable(n.tipus);
                    return (
                      <tr key={n.id}>
                        <td className={styles.colOrdre}>
                          {canEdit ? (
                            <input
                              className={`${styles.inlineInput} ${styles.inlineInputOrdre}`}
                              type="text"
                              defaultValue={String(n.ordre)}
                              disabled={pending}
                              onBlur={(e) => {
                                const ordre = parseOptionalNumber(e.target.value);
                                if (ordre == null || ordre === n.ordre) return;
                                saveField(n.id, { ordre });
                              }}
                            />
                          ) : (
                            n.ordre
                          )}
                        </td>
                        <td className={styles.colNom}>
                          {canEdit ? (
                            <input
                              className={`${styles.inlineInput} ${styles.inlineInputNom}`}
                              type="text"
                              defaultValue={n.nom ?? ""}
                              disabled={pending}
                              onBlur={(e) => {
                                const nom = e.target.value.trim() || null;
                                if (nom === (n.nom ?? null)) return;
                                saveField(n.id, { nom });
                              }}
                            />
                          ) : (
                            (n.nom ?? "—")
                          )}
                        </td>
                        <td>
                          <code className={styles.code}>{n.tipus}</code>
                        </td>
                        <td>{n.liniaNegociDesti?.codi ?? "—"}</td>
                        <td>{CONCEPTE_NODE_LABEL[n.concepteNode] ?? n.concepteNode}</td>
                        <td>
                          {editValor === "percent" && canEdit ? (
                            <input
                              className={styles.inlineInput}
                              type="text"
                              defaultValue={n.valorPercent != null ? String(n.valorPercent) : ""}
                              disabled={pending}
                              placeholder="%"
                              onBlur={(e) => {
                                const v = parseOptionalNumber(e.target.value);
                                if (v === n.valorPercent) return;
                                saveField(n.id, { valorPercent: v });
                              }}
                            />
                          ) : editValor === "import" && canEdit ? (
                            <input
                              className={styles.inlineInput}
                              type="text"
                              defaultValue={n.valorImport != null ? String(n.valorImport) : ""}
                              disabled={pending}
                              placeholder="€"
                              onBlur={(e) => {
                                const v = parseOptionalNumber(e.target.value);
                                if (v === n.valorImport) return;
                                saveField(n.id, { valorImport: v });
                              }}
                            />
                          ) : n.valorPercent != null ? (
                            `${n.valorPercent}%`
                          ) : n.valorImport != null ? (
                            `${n.valorImport.toLocaleString("ca-ES")} €`
                          ) : (
                            (n.grup?.codi ?? "—")
                          )}
                        </td>
                        {canEdit && (
                          <td>
                            <input
                              type="checkbox"
                              checked={n.actiu}
                              disabled={pending}
                              onChange={(e) =>
                                startTransition(async () => {
                                  notify(await toggleNormaAction(n.id, e.target.checked));
                                })
                              }
                            />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
