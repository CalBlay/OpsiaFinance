"use client";

import { DadesPageShell } from "@/components/dades/DadesPageShell";
import { Button } from "@/components/ui/Button";
import { formatNum } from "@/lib/utils";
import { Check, Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  confirmarTraspassPersonalAction,
  deleteExecucioTraspassPersonalAction,
  deleteMovimentTraspassAction,
  tornarEsborranyTraspassPersonalAction,
  updateMovimentTraspassAction,
} from "./actions";
import styles from "./page.module.css";

type Moviment = {
  id: string;
  hores: number;
  tarifaHora: number;
  import_: number;
  centreOrigen: { codi: string; nom: string };
  centreDesti: { codi: string; nom: string };
};

type Alerta = {
  fila: number;
  empleado: string;
  organizaciones: string;
  proyecto: string;
  motiu: string;
};

export function TraspassExecucioPanel({
  periodId: _periodId,
  periodNom,
  execucio,
  canEdit,
}: {
  periodId: string;
  periodNom: string;
  execucio: {
    id: string;
    estat: string;
    nomFitxer: string | null;
    moviments: Moviment[];
    alertes: Alerta[];
  } | null;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [editId, setEditId] = useState<string | null>(null);
  const [editHores, setEditHores] = useState("");
  const [editTarifa, setEditTarifa] = useState("");
  const [editImport, setEditImport] = useState("");
  const editable = canEdit && execucio?.estat === "BORRADOR";

  const startEdit = (m: Moviment) => {
    setEditId(m.id);
    setEditHores(String(m.hores).replace(".", ","));
    setEditTarifa(String(m.tarifaHora).replace(".", ","));
    setEditImport(String(m.import_).replace(".", ","));
  };

  const parseNum = (raw: string) => Number(raw.replace(/\s/g, "").replace(",", "."));

  return (
    <DadesPageShell
      backHref="/dades/traspass-personal"
      backLabel="Traspassos personal"
      title={`Traspassos personal · ${periodNom}`}
      description={
        <>
          {execucio ? (
            <span
              className={`${styles.badge} ${
                execucio.estat === "CONFIRMAT" ? styles.badgeConfirmat : styles.badgeBorrador
              }`}
            >
              {execucio.estat === "CONFIRMAT" ? "Confirmat" : "Esborrany"}
            </span>
          ) : null}
          {execucio?.nomFitxer ? ` Fitxer: ${execucio.nomFitxer}` : null}
        </>
      }
      actions={
        <>
          <Button asChild variant="outline" size="sm">
            <Link href="/dades/traspass-personal/resum">Resum anual</Link>
          </Button>
          {canEdit && execucio?.estat === "CONFIRMAT" && (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await tornarEsborranyTraspassPersonalAction(execucio.id);
                  window.location.reload();
                })
              }
            >
              Tornar a esborrany
            </Button>
          )}
          {editable && execucio.moviments.length > 0 && (
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await confirmarTraspassPersonalAction(execucio.id);
                  window.location.reload();
                })
              }
            >
              Confirmar traspassos
            </Button>
          )}
          {canEdit && execucio && (
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (!confirm("Eliminar aquesta importació i tots els moviments del mes?")) return;
                startTransition(async () => {
                  await deleteExecucioTraspassPersonalAction(execucio.id);
                  window.location.href = "/dades/traspass-personal";
                });
              }}
            >
              Eliminar importació
            </Button>
          )}
        </>
      }
    >
      {!execucio ? (
        <p className={styles.muted}>
          Encara no s&apos;ha importat l&apos;excel d&apos;hores d&apos;aquest mes.
        </p>
      ) : (
        <>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Moviments agregats per centre</h2>
            {execucio.moviments.length === 0 ? (
              <p className={styles.muted}>Cap traspass entre centres diferents.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Origen</th>
                    <th>Destí</th>
                    <th className={styles.num}>Hores</th>
                    <th className={styles.num}>Tarifa</th>
                    <th className={styles.num}>Total</th>
                    {canEdit && <th />}
                  </tr>
                </thead>
                <tbody>
                  {execucio.moviments.map((m) => (
                    <tr key={m.id}>
                      <td>
                        {m.centreOrigen.codi} · {m.centreOrigen.nom}
                      </td>
                      <td>
                        {m.centreDesti.codi} · {m.centreDesti.nom}
                      </td>
                      {editId === m.id ? (
                        <>
                          <td className={styles.num}>
                            <input
                              className={styles.inlineInput}
                              value={editHores}
                              onChange={(e) => setEditHores(e.target.value)}
                            />
                          </td>
                          <td className={styles.num}>
                            <input
                              className={styles.inlineInput}
                              value={editTarifa}
                              onChange={(e) => setEditTarifa(e.target.value)}
                            />
                          </td>
                          <td className={styles.num}>
                            <input
                              className={styles.inlineInput}
                              value={editImport}
                              onChange={(e) => setEditImport(e.target.value)}
                            />
                          </td>
                          <td className={styles.rowActions}>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() =>
                                startTransition(async () => {
                                  await updateMovimentTraspassAction(m.id, {
                                    hores: parseNum(editHores),
                                    tarifaHora: parseNum(editTarifa),
                                    import_: parseNum(editImport),
                                  });
                                  setEditId(null);
                                  window.location.reload();
                                })
                              }
                            >
                              <Check size={16} />
                            </button>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => setEditId(null)}
                            >
                              <X size={16} />
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className={styles.num}>{formatNum(m.hores)}</td>
                          <td className={styles.num}>{formatNum(m.tarifaHora)} €</td>
                          <td className={styles.num}>{formatNum(m.import_)} €</td>
                          {canEdit && (
                            <td className={styles.rowActions}>
                              <button
                                type="button"
                                disabled={!editable || pending}
                                onClick={() => startEdit(m)}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                type="button"
                                disabled={!editable || pending}
                                onClick={() => {
                                  if (!confirm("Eliminar aquest moviment?")) return;
                                  startTransition(async () => {
                                    await deleteMovimentTraspassAction(m.id);
                                    window.location.reload();
                                  });
                                }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {execucio.alertes.length > 0 && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Alertes ({execucio.alertes.length})</h2>
              <p className={styles.helpText}>
                Files sense mapeig. Afegeix-los a{" "}
                <Link href="/settings/traspass-personal">
                  Configuració → Traspassos de personal
                </Link>{" "}
                o importa l&apos;excel de mapeig.
              </p>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Fila</th>
                    <th>Empleado</th>
                    <th>Organizaciones</th>
                    <th>Proyecto</th>
                    <th>Motiu</th>
                  </tr>
                </thead>
                <tbody>
                  {execucio.alertes.slice(0, 50).map((a, i) => (
                    <tr key={`${a.fila}-${i}`}>
                      <td>{a.fila}</td>
                      <td>{a.empleado}</td>
                      <td>{a.organizaciones}</td>
                      <td>{a.proyecto}</td>
                      <td>{a.motiu}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </DadesPageShell>
  );
}
