"use client";

import { Button } from "@/components/ui/Button";
import {
  GRUP_CONSOLIDACIO_LABELS,
  GRUP_EMPRESA_NORMA_LABELS,
  TIPUS_NORMA_LABELS,
  labelNode,
} from "@/lib/consolidacio/labels";
import { useState, useTransition } from "react";
import styles from "../repartiment/page.module.css";
import {
  carregarNormesConsolidacioSeedAction,
  createNormaConsolidacioAction,
  deleteNormaConsolidacioAction,
  toggleNormaConsolidacioAction,
  updateNormaConsolidacioAction,
} from "./actions";

type Norma = {
  id: string;
  codi: string | null;
  nom: string;
  descripcio: string | null;
  grup: string;
  tipus: string;
  ordre: number;
  actiu: boolean;
  nodeExcloure: number | null;
  nodesAjust: number[];
  grupEmpresaOrigen: string | null;
  nodeOrigen: number | null;
  grupEmpresaDesti: string | null;
  nodeDesti: number | null;
};

export function ConsolidacioPanel({
  normes,
  nodeLabels,
  canEdit,
}: {
  normes: Norma[];
  nodeLabels: Record<number, string>;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; missatge: string } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newNom, setNewNom] = useState("");
  const [newNode, setNewNode] = useState("");
  const [newAjust, setNewAjust] = useState("11, 12, 32, 40, 42");

  const notify = (r: { ok: boolean; missatge?: string }) => {
    if (!r.missatge && r.ok) return;
    setFeedback({ ok: r.ok, missatge: r.missatge ?? (r.ok ? "Desat." : "Error") });
    if (r.ok) setTimeout(() => setFeedback(null), 5000);
  };

  const perGrup = normes.reduce<Map<string, Norma[]>>((acc, n) => {
    const list = acc.get(n.grup) ?? [];
    list.push(n);
    acc.set(n.grup, list);
    return acc;
  }, new Map());

  const blocs = [...perGrup.entries()].sort(([a], [b]) => a.localeCompare(b));

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
                    "Restablirà les normes del seed (conservant personalitzacions sense codi). Continuar?"
                  )
                ) {
                  return;
                }
                startTransition(async () => notify(await carregarNormesConsolidacioSeedAction()));
              }}
            >
              Restablir normes per defecte
            </Button>
            <Button disabled={pending} variant="outline" onClick={() => setShowAdd((v) => !v)}>
              {showAdd ? "Cancel·lar" : "Afegir regla Cal Blay"}
            </Button>
          </div>
          <p className={styles.helpText}>
            Les regles actives modifiquen el total consolidat sense canviar les columnes per LN. Les
            regles de grup empresarial es poden deixar inactives fins que la consulta Consolidat
            estigui llesta.
          </p>
        </div>
      )}

      {feedback && (
        <p className={feedback.ok ? styles.feedbackOk : styles.feedbackErr}>{feedback.missatge}</p>
      )}

      {showAdd && canEdit && (
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Nova regla · Excloure node (Cal Blay intra-empresa)</h3>
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.75rem" }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              Nom
              <input
                className={styles.inlineInputWide}
                value={newNom}
                onChange={(e) => setNewNom(e.target.value)}
                placeholder="p.ex. Nova eliminació interna"
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              Node a excloure
              <input
                className={styles.inlineInputNarrow}
                value={newNode}
                onChange={(e) => setNewNode(e.target.value)}
                placeholder="9"
              />
            </label>
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                flex: 1,
                minWidth: 200,
              }}
            >
              Nodes a ajustar (subtotals)
              <input
                className={styles.inlineInputWide}
                value={newAjust}
                onChange={(e) => setNewAjust(e.target.value)}
                placeholder="11, 12, 32, 40, 42"
              />
            </label>
          </div>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await createNormaConsolidacioAction(
                  "CALBLAY_INTRA",
                  "EXCLURE_NODE",
                  newNom,
                  Number(newNode) || null,
                  newAjust
                );
                notify(r);
                if (r.ok) {
                  setShowAdd(false);
                  setNewNom("");
                  setNewNode("");
                }
              })
            }
          >
            Crear regla
          </Button>
        </div>
      )}

      {blocs.map(([grup, list]) => (
        <div key={grup} className={styles.card}>
          <h3 className={styles.cardTitle}>{GRUP_CONSOLIDACIO_LABELS[grup] ?? grup}</h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Activa</th>
                <th>Nom</th>
                <th>Tipus</th>
                <th>Detall</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {list.map((n) => (
                <NormaRow
                  key={n.id}
                  norma={n}
                  nodeLabels={nodeLabels}
                  canEdit={canEdit}
                  pending={pending}
                  onNotify={notify}
                />
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function NormaRow({
  norma,
  nodeLabels,
  canEdit,
  pending,
  onNotify,
}: {
  norma: Norma;
  nodeLabels: Record<number, string>;
  canEdit: boolean;
  pending: boolean;
  onNotify: (r: { ok: boolean; missatge?: string }) => void;
}) {
  const [rowPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [nom, setNom] = useState(norma.nom);
  const [nodesAjust, setNodesAjust] = useState(norma.nodesAjust.join(", "));

  const busy = pending || rowPending;

  const detall =
    norma.tipus === "EXCLURE_NODE" ? (
      <>
        Excloure <strong>{labelNode(nodeLabels, norma.nodeExcloure)}</strong>
        {norma.nodesAjust.length > 0 && (
          <> · ajust: {norma.nodesAjust.map((nd) => labelNode(nodeLabels, nd)).join(", ")}</>
        )}
      </>
    ) : (
      <>
        {GRUP_EMPRESA_NORMA_LABELS[norma.grupEmpresaOrigen ?? ""] ?? norma.grupEmpresaOrigen ?? "—"}
        {" · "}
        {labelNode(nodeLabels, norma.nodeOrigen)}
        {" ↔ "}
        {GRUP_EMPRESA_NORMA_LABELS[norma.grupEmpresaDesti ?? ""] ?? norma.grupEmpresaDesti ?? "—"}
        {" · "}
        {labelNode(nodeLabels, norma.nodeDesti)}
      </>
    );

  const save = () => {
    startTransition(async () => {
      const r = await updateNormaConsolidacioAction(norma.id, {
        nom,
        nodesAjust: norma.tipus === "EXCLURE_NODE" ? nodesAjust : undefined,
      });
      onNotify(r);
      if (r.ok) setEditing(false);
    });
  };

  return (
    <tr style={!norma.actiu ? { opacity: 0.55 } : undefined}>
      <td>
        <input
          type="checkbox"
          checked={norma.actiu}
          disabled={!canEdit || busy}
          onChange={(e) =>
            startTransition(async () =>
              onNotify(await toggleNormaConsolidacioAction(norma.id, e.target.checked))
            )
          }
        />
      </td>
      <td>
        {editing ? (
          <input
            className={styles.inlineInputNom}
            value={nom}
            onChange={(e) => setNom(e.target.value)}
          />
        ) : (
          <div>
            <div>{norma.nom}</div>
            {norma.descripcio && <div className={styles.muted}>{norma.descripcio}</div>}
          </div>
        )}
      </td>
      <td>{TIPUS_NORMA_LABELS[norma.tipus] ?? norma.tipus}</td>
      <td>
        {editing && norma.tipus === "EXCLURE_NODE" ? (
          <input
            className={styles.inlineInputWide}
            value={nodesAjust}
            onChange={(e) => setNodesAjust(e.target.value)}
          />
        ) : (
          detall
        )}
      </td>
      {canEdit && (
        <td style={{ whiteSpace: "nowrap" }}>
          {editing ? (
            <>
              <button type="button" className={styles.muted} onClick={save} disabled={busy}>
                Desar
              </button>
              {" · "}
              <button
                type="button"
                className={styles.muted}
                onClick={() => setEditing(false)}
                disabled={busy}
              >
                Cancel·lar
              </button>
            </>
          ) : (
            <>
              <button type="button" className={styles.muted} onClick={() => setEditing(true)}>
                Editar
              </button>
              {!norma.codi && (
                <>
                  {" · "}
                  <button
                    type="button"
                    className={styles.neg}
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Eliminar la regla «${norma.nom}»?`)) {
                        startTransition(async () =>
                          onNotify(await deleteNormaConsolidacioAction(norma.id))
                        );
                      }
                    }}
                  >
                    Eliminar
                  </button>
                </>
              )}
            </>
          )}
        </td>
      )}
    </tr>
  );
}
