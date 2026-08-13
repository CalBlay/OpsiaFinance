"use client";

import { DadesFilterBar, coincideixCerca } from "@/components/dades/DadesFilterBar";
import { DadesPageShell } from "@/components/dades/DadesPageShell";
import { ExportInformeButton } from "@/components/export/ExportInformeButton";
import { Button } from "@/components/ui/Button";
import { traspassMovimentsToExportInforme } from "@/lib/export/dades";
import { etiquetaDepartamentArbre } from "@/lib/traspass-personal/departament";
import { formatNum } from "@/lib/utils";
import { Check, Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  confirmarTraspassPersonalAction,
  deleteExecucioTraspassPersonalAction,
  deleteMovimentTraspassAction,
  tornarEsborranyTraspassPersonalAction,
  updateMovimentTraspassAction,
} from "./actions";
import styles from "./page.module.css";

type DeptInfo = { id: string; codi: string; nom: string } | null;

type Moviment = {
  id: string;
  minuts: number;
  hores: number;
  tarifaHora: number;
  import_: number;
  departament: "SALA" | "CUINA";
  centreOrigen: { codi: string; nom: string };
  centreDesti: { codi: string; nom: string };
  departamentOrigen?: DeptInfo;
  departamentDesti?: DeptInfo;
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
  const [editMinuts, setEditMinuts] = useState("");
  const [editHores, setEditHores] = useState("");
  const [editTarifa, setEditTarifa] = useState("");
  const [editImport, setEditImport] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filtreDept, setFiltreDept] = useState("");
  const [filtreOrigen, setFiltreOrigen] = useState("");
  const [filtreDesti, setFiltreDesti] = useState("");
  const editable = canEdit && execucio?.estat === "BORRADOR";

  const moviments = execucio?.moviments ?? [];

  const origenOpts = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of moviments) {
      map.set(m.centreOrigen.codi, `${m.centreOrigen.codi} · ${m.centreOrigen.nom}`);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([value, label]) => ({ value, label }));
  }, [moviments]);

  const destiOpts = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of moviments) {
      map.set(m.centreDesti.codi, `${m.centreDesti.codi} · ${m.centreDesti.nom}`);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([value, label]) => ({ value, label }));
  }, [moviments]);

  const deptOpts = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of moviments) {
      const origen = etiquetaDepartamentArbre(m.departamentOrigen, m.departament);
      const desti = etiquetaDepartamentArbre(m.departamentDesti);
      map.set(origen, origen);
      map.set(desti, desti);
    }
    return [...map.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], "ca"))
      .map(([value, label]) => ({ value, label }));
  }, [moviments]);

  const movimentsFiltrats = useMemo(() => {
    return moviments.filter((m) => {
      const deptOrigen = etiquetaDepartamentArbre(m.departamentOrigen, m.departament);
      const deptDesti = etiquetaDepartamentArbre(m.departamentDesti);
      if (filtreDept && deptOrigen !== filtreDept && deptDesti !== filtreDept) return false;
      if (filtreOrigen && m.centreOrigen.codi !== filtreOrigen) return false;
      if (filtreDesti && m.centreDesti.codi !== filtreDesti) return false;
      return coincideixCerca(
        `${m.centreOrigen.codi} ${m.centreOrigen.nom} ${deptOrigen} ${m.centreDesti.codi} ${m.centreDesti.nom} ${deptDesti}`,
        query
      );
    });
  }, [moviments, query, filtreDept, filtreOrigen, filtreDesti]);

  const informe =
    execucio && movimentsFiltrats.length
      ? traspassMovimentsToExportInforme(movimentsFiltrats, {
          periodNom,
          estat: execucio.estat === "CONFIRMAT" ? "Confirmat" : "Esborrany",
          nomFitxer: execucio.nomFitxer,
        })
      : null;

  const startEdit = (m: Moviment) => {
    if (!editable) {
      setFeedback("Per editar, primer fes «Tornar a esborrany».");
      setTimeout(() => setFeedback(null), 5000);
      return;
    }
    setEditId(m.id);
    setEditMinuts(
      Number(m.minuts ?? Math.round((m.hores || 0) * 60))
        .toFixed(2)
        .replace(".", ",")
    );
    setEditHores(Number(m.hores).toFixed(2).replace(".", ","));
    setEditTarifa(Number(m.tarifaHora).toFixed(2).replace(".", ","));
    setEditImport(Number(m.import_).toFixed(2).replace(".", ","));
  };

  const parseNum = (raw: string) => Number(raw.replace(/\s/g, "").replace(",", "."));

  const onChangeMinuts = (raw: string) => {
    setEditMinuts(raw);
    const minuts = parseNum(raw);
    if (!Number.isFinite(minuts) || minuts < 0) return;
    const hores = Math.round((minuts / 60) * 100) / 100;
    const tarifa = parseNum(editTarifa);
    setEditHores(String(hores).replace(".", ","));
    if (Number.isFinite(tarifa) && tarifa >= 0) {
      setEditImport(String(Math.round(hores * tarifa * 100) / 100).replace(".", ","));
    }
  };

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
          <ExportInformeButton informe={informe} />
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
            <h2 className={styles.cardTitle}>Moviments agregats per centre i departament</h2>
            {feedback && <p className={styles.helpText}>{feedback}</p>}
            {canEdit && execucio.estat === "CONFIRMAT" && (
              <p className={styles.helpText}>
                Confirmat: al compte d&apos;explotació el traspass s&apos;aplica per centre (un
                moviment intern de departament es cancel·la). El detall per departament és
                informatiu. A Consultes → Cost salarial els imports de destí sumen a «Traspassos
                (hores destí)». Per editar, fes «Tornar a esborrany».
              </p>
            )}
            {canEdit && execucio.estat === "BORRADOR" && (
              <p className={styles.helpText}>
                Per aplicar el mapeig nou: torna a pujar l&apos;Excel des de{" "}
                <Link href="/dades/traspass-personal">Traspassos personal</Link> (botó +). Això
                substitueix tots els moviments del mes.
              </p>
            )}
            {execucio.moviments.length === 0 ? (
              <p className={styles.muted}>Cap traspass entre centres o departaments diferents.</p>
            ) : (
              <>
                <DadesFilterBar
                  query={query}
                  onQueryChange={setQuery}
                  placeholder="Cerca origen, destí, departament…"
                  filters={[
                    {
                      id: "dept",
                      value: filtreDept,
                      onChange: setFiltreDept,
                      allLabel: "Tots els departaments",
                      "aria-label": "Filtrar per departament",
                      options: deptOpts,
                    },
                    {
                      id: "origen",
                      value: filtreOrigen,
                      onChange: setFiltreOrigen,
                      allLabel: "Tots els orígens",
                      "aria-label": "Filtrar per origen",
                      options: origenOpts,
                    },
                    {
                      id: "desti",
                      value: filtreDesti,
                      onChange: setFiltreDesti,
                      allLabel: "Tots els destins",
                      "aria-label": "Filtrar per destí",
                      options: destiOpts,
                    },
                  ]}
                  summary={
                    movimentsFiltrats.length === moviments.length
                      ? `${moviments.length} moviment${moviments.length !== 1 ? "s" : ""}`
                      : `${movimentsFiltrats.length} de ${moviments.length} moviments`
                  }
                />
                {movimentsFiltrats.length === 0 ? (
                  <p className={styles.muted}>Cap moviment amb aquests filtres.</p>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Origen</th>
                        <th>Dept. origen</th>
                        <th>Destí</th>
                        <th>Dept. destí</th>
                        <th className={styles.num}>Minuts</th>
                        <th className={styles.num}>Hores</th>
                        <th className={styles.num}>Tarifa</th>
                        <th className={styles.num}>Total</th>
                        {canEdit && <th />}
                      </tr>
                    </thead>
                    <tbody>
                      {movimentsFiltrats.map((m) => (
                        <tr key={m.id}>
                          <td>
                            {m.centreOrigen.codi} · {m.centreOrigen.nom}
                          </td>
                          <td>{etiquetaDepartamentArbre(m.departamentOrigen, m.departament)}</td>
                          <td>
                            {m.centreDesti.codi} · {m.centreDesti.nom}
                          </td>
                          <td>{etiquetaDepartamentArbre(m.departamentDesti)}</td>
                          {editId === m.id ? (
                            <>
                              <td className={styles.num}>
                                <input
                                  className={styles.inlineInput}
                                  value={editMinuts}
                                  onChange={(e) => onChangeMinuts(e.target.value)}
                                />
                              </td>
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
                                        minuts: parseNum(editMinuts),
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
                              <td className={styles.num}>{formatNum(m.minuts, 2)}</td>
                              <td className={styles.num}>{formatNum(m.hores, 2)}</td>
                              <td className={styles.num}>{formatNum(m.tarifaHora, 2)} €</td>
                              <td className={styles.num}>{formatNum(m.import_, 2)} €</td>
                              {canEdit && (
                                <td className={styles.rowActions}>
                                  <button
                                    type="button"
                                    disabled={pending}
                                    title={
                                      editable ? "Editar moviment" : "Torna a esborrany per editar"
                                    }
                                    onClick={() => startEdit(m)}
                                  >
                                    <Pencil size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!editable || pending}
                                    title={
                                      editable
                                        ? "Eliminar moviment"
                                        : "Torna a esborrany per eliminar"
                                    }
                                    onClick={() => {
                                      if (!editable) {
                                        setFeedback(
                                          "Per eliminar, primer fes «Tornar a esborrany»."
                                        );
                                        setTimeout(() => setFeedback(null), 5000);
                                        return;
                                      }
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
              </>
            )}
          </section>

          {execucio.alertes.length > 0 && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Sense mapeig ({execucio.alertes.length})</h2>
              <p className={styles.helpText}>
                Files de l&apos;Excel que no s&apos;han pogut mapear. Afegeix el text a Configuració
                → Traspassos personal i torna a importar.
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
                      <td>{a.fila > 0 ? a.fila : "—"}</td>
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
