"use client";

import { Button } from "@/components/ui/Button";
import {
  FONT_IMPORT_LABELS,
  GRUP_CONSOLIDACIO_LABELS,
  GRUP_EMPRESA_NORMA_LABELS,
  TIPUS_NORMA_LABELS,
  labelNode,
} from "@/lib/consolidacio/labels";
import { MESOS_CURTS } from "@/lib/periodes";
import { useMemo, useState, useTransition } from "react";
import styles from "../repartiment/page.module.css";
import {
  carregarNormesConsolidacioSeedAction,
  createNormaConsolidacioAction,
  deleteImportNormaConsolidacioAction,
  deleteNormaConsolidacioAction,
  toggleNormaConsolidacioAction,
  updateNormaConsolidacioAction,
  upsertImportNormaConsolidacioAction,
} from "./actions";

type ImportDTO = {
  id: string;
  any: number;
  mes: number;
  import: number;
  nota: string | null;
};

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
  nodesOrigen: number[];
  nodesDesti: number[];
  fontImport: string;
  notaOrigen: string | null;
  notaDesti: string | null;
  imports: ImportDTO[];
};

function formatEur(n: number): string {
  return n.toLocaleString("ca-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function labelNodes(
  nodeLabels: Record<number, string>,
  singles: number | null,
  multi: number[]
): string {
  const nodes = multi.length > 0 ? multi : singles != null ? [singles] : [];
  if (nodes.length === 0) return "—";
  return nodes.map((nd) => labelNode(nodeLabels, nd)).join(" + ");
}

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
  const [expandedId, setExpandedId] = useState<string | null>(
    () => normes.find((n) => n.fontImport === "IMPORT_FIX_MENSUAL")?.id ?? null
  );

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
            Les regles actives modifiquen el total consolidat. Intra Cal Blay s&apos;aplica a
            Empresa · Cal Blay i Consolidat (Directe i Gestió). Les de grup empresarial (lloguer,
            factures IC) només amb selector <strong>Consolidat</strong> i vista{" "}
            <strong>Gestió</strong>, respectant el filtre de mesos. Les factures IC es veuen
            expandint la norma (taula any/mes).
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
                <th />
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
                  expanded={expandedId === n.id}
                  onToggleExpand={() => setExpandedId((cur) => (cur === n.id ? null : n.id))}
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
  expanded,
  onToggleExpand,
  onNotify,
}: {
  norma: Norma;
  nodeLabels: Record<number, string>;
  canEdit: boolean;
  pending: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onNotify: (r: { ok: boolean; missatge?: string }) => void;
}) {
  const [rowPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [nom, setNom] = useState(norma.nom);
  const [nodesAjust, setNodesAjust] = useState(norma.nodesAjust.join(", "));

  const busy = pending || rowPending;
  const teImports = norma.fontImport === "IMPORT_FIX_MENSUAL";

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
        {labelNodes(nodeLabels, norma.nodeOrigen, norma.nodesOrigen)}
        {" ↔ "}
        {GRUP_EMPRESA_NORMA_LABELS[norma.grupEmpresaDesti ?? ""] ?? norma.grupEmpresaDesti ?? "—"}
        {" · "}
        {labelNodes(nodeLabels, norma.nodeDesti, norma.nodesDesti)}
        {teImports && (
          <>
            {" · "}
            <span className={styles.muted}>
              {FONT_IMPORT_LABELS[norma.fontImport] ?? norma.fontImport}
            </span>
          </>
        )}
        {(norma.notaOrigen || norma.notaDesti) && (
          <div className={styles.muted} style={{ marginTop: 4 }}>
            {norma.notaOrigen}
            {norma.notaOrigen && norma.notaDesti ? " → " : null}
            {norma.notaDesti}
          </div>
        )}
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
    <>
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
        {canEdit ? (
          <td style={{ whiteSpace: "nowrap" }}>
            {teImports && (
              <>
                <button type="button" className={styles.muted} onClick={onToggleExpand}>
                  {expanded ? "Amagar imports" : "Veure imports"}
                </button>
                {" · "}
              </>
            )}
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
        ) : (
          <td>
            {teImports ? (
              <button type="button" className={styles.muted} onClick={onToggleExpand}>
                {expanded ? "Amagar imports" : "Veure imports"}
              </button>
            ) : null}
          </td>
        )}
      </tr>
      {expanded && teImports && (
        <tr>
          <td colSpan={5} style={{ background: "var(--surface-muted, #f7f7f5)" }}>
            <ImportsMensualsPanel
              normaId={norma.id}
              imports={norma.imports}
              canEdit={canEdit}
              pending={busy}
              onNotify={onNotify}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function ImportsMensualsPanel({
  normaId,
  imports,
  canEdit,
  pending,
  onNotify,
}: {
  normaId: string;
  imports: ImportDTO[];
  canEdit: boolean;
  pending: boolean;
  onNotify: (r: { ok: boolean; missatge?: string }) => void;
}) {
  const [rowPending, startTransition] = useTransition();
  const anys = useMemo(() => {
    const set = new Set(imports.map((i) => i.any));
    if (set.size === 0) set.add(new Date().getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [imports]);
  const [anyActiu, setAnyActiu] = useState(anys[0] ?? new Date().getFullYear());
  const [nouAny, setNouAny] = useState(String(new Date().getFullYear()));
  const [nouMes, setNouMes] = useState("1");
  const [nouImport, setNouImport] = useState("");
  const [novaNota, setNovaNota] = useState("");

  const delAny = imports.filter((i) => i.any === anyActiu).sort((a, b) => a.mes - b.mes);
  const totalAny = delAny.reduce((s, i) => s + i.import, 0);
  const busy = pending || rowPending;

  return (
    <div style={{ padding: "0.75rem 0.5rem" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "center",
          marginBottom: "0.75rem",
        }}
      >
        <strong>Imports mensuals (factures IC)</strong>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Any
          <select
            className={styles.inlineInputNarrow}
            value={anyActiu}
            onChange={(e) => setAnyActiu(Number(e.target.value))}
          >
            {anys.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <span className={styles.muted}>
          Total {anyActiu}: <strong>{formatEur(totalAny)} €</strong>
        </span>
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Mes</th>
            <th>Import (€)</th>
            <th>Nota / projecte</th>
            {canEdit && <th />}
          </tr>
        </thead>
        <tbody>
          {delAny.length === 0 ? (
            <tr>
              <td colSpan={canEdit ? 4 : 3} className={styles.muted}>
                Cap import per a {anyActiu}. Afegeix els mensuals de les factures.
              </td>
            </tr>
          ) : (
            delAny.map((imp) => (
              <ImportRow
                key={imp.id}
                normaId={normaId}
                imp={imp}
                canEdit={canEdit}
                busy={busy}
                onNotify={onNotify}
                startTransition={startTransition}
              />
            ))
          )}
        </tbody>
      </table>

      {canEdit && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            alignItems: "flex-end",
            marginTop: "0.75rem",
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            Any
            <input
              className={styles.inlineInputNarrow}
              value={nouAny}
              onChange={(e) => setNouAny(e.target.value)}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            Mes
            <select
              className={styles.inlineInputNarrow}
              value={nouMes}
              onChange={(e) => setNouMes(e.target.value)}
            >
              {MESOS_CURTS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            Import
            <input
              className={styles.inlineInputNarrow}
              value={nouImport}
              onChange={(e) => setNouImport(e.target.value)}
              placeholder="0,00"
            />
          </label>
          <label
            style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 180 }}
          >
            Nota
            <input
              className={styles.inlineInputWide}
              value={novaNota}
              onChange={(e) => setNovaNota(e.target.value)}
              placeholder="ENTREGUES … LA BLAYETA · C019081"
            />
          </label>
          <Button
            disabled={busy}
            onClick={() => {
              const valor = Number(String(nouImport).replace(",", "."));
              const anyN = Number(nouAny);
              const mesN = Number(nouMes);
              startTransition(async () => {
                const r = await upsertImportNormaConsolidacioAction(
                  normaId,
                  anyN,
                  mesN,
                  valor,
                  novaNota
                );
                onNotify(r);
                if (r.ok) {
                  setAnyActiu(anyN);
                  setNouImport("");
                  setNovaNota("");
                }
              });
            }}
          >
            Afegir / actualitzar
          </Button>
        </div>
      )}
    </div>
  );
}

function ImportRow({
  normaId,
  imp,
  canEdit,
  busy,
  onNotify,
  startTransition,
}: {
  normaId: string;
  imp: ImportDTO;
  canEdit: boolean;
  busy: boolean;
  onNotify: (r: { ok: boolean; missatge?: string }) => void;
  startTransition: (fn: () => void) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [valor, setValor] = useState(String(imp.import).replace(".", ","));
  const [nota, setNota] = useState(imp.nota ?? "");

  if (editing && canEdit) {
    return (
      <tr>
        <td>{MESOS_CURTS[imp.mes - 1] ?? imp.mes}</td>
        <td>
          <input
            className={styles.inlineInputNarrow}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </td>
        <td>
          <input
            className={styles.inlineInputWide}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
        </td>
        <td style={{ whiteSpace: "nowrap" }}>
          <button
            type="button"
            className={styles.muted}
            disabled={busy}
            onClick={() => {
              const n = Number(String(valor).replace(",", "."));
              startTransition(async () => {
                const r = await upsertImportNormaConsolidacioAction(
                  normaId,
                  imp.any,
                  imp.mes,
                  n,
                  nota
                );
                onNotify(r);
                if (r.ok) setEditing(false);
              });
            }}
          >
            Desar
          </button>
          {" · "}
          <button
            type="button"
            className={styles.muted}
            disabled={busy}
            onClick={() => {
              setEditing(false);
              setValor(String(imp.import).replace(".", ","));
              setNota(imp.nota ?? "");
            }}
          >
            Cancel·lar
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{MESOS_CURTS[imp.mes - 1] ?? imp.mes}</td>
      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {formatEur(imp.import)}
      </td>
      <td className={styles.muted}>{imp.nota ?? "—"}</td>
      {canEdit && (
        <td style={{ whiteSpace: "nowrap" }}>
          <button
            type="button"
            className={styles.muted}
            disabled={busy}
            onClick={() => setEditing(true)}
          >
            Editar
          </button>
          {" · "}
          <button
            type="button"
            className={styles.neg}
            disabled={busy}
            onClick={() => {
              if (!window.confirm(`Eliminar import ${imp.any}-${imp.mes}?`)) return;
              startTransition(async () =>
                onNotify(await deleteImportNormaConsolidacioAction(imp.id))
              );
            }}
          >
            Eliminar
          </button>
        </td>
      )}
    </tr>
  );
}
