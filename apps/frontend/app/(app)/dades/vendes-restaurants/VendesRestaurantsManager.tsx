"use client";

import { MESOS_LLARGS } from "@/lib/periodes";
import { cn, formatNum } from "@/lib/utils";
import { Eye, Pencil, Trash2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useRef, useState, useTransition } from "react";
import {
  type AmbitVendes,
  deleteVendaArticleAction,
  deleteVendaDiariaAction,
  deleteVendesBlocAction,
  getDetallVendesAction,
  updateVendaArticleAction,
  updateVendaDiariaAction,
  uploadVendesRestaurantsAction,
} from "./actions";
import styles from "./page.module.css";

interface ResumDTO {
  centreId: string;
  periodNom: string;
  periodAny: number;
  periodMes: number;
  centreCodi: string;
  centreNom: string;
  dies: number;
  baseDies: number;
  productes: number;
  packs: number;
  baseProductes: number;
  basePacks: number;
}

type Result = { ok: boolean; missatge: string; errors?: string[]; detalls?: string[] };

type DiaDet = { id: string; dia: number; dataIso: string; unitats: number; base: number };
type ArtDet = {
  id: string;
  article: string;
  categoria: string | null;
  grup: string | null;
  unitats: number;
  base: number;
};

type DetallEstat = {
  resum: ResumDTO;
  dies: DiaDet[];
  productes: ArtDet[];
  packs: ArtDet[];
};

function parseNum(txt: string): number {
  const s = txt.trim().replace(/\./g, "").replace(",", ".");
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function VendesRestaurantsManager({
  resums,
  anys,
  canEdit,
  filtreAny,
  filtreMes,
}: {
  resums: ResumDTO[];
  anys: number[];
  canEdit: boolean;
  filtreAny: number | null;
  filtreMes: number | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<Result | null>(null);
  const [isPending, startTransition] = useTransition();
  const [detall, setDetall] = useState<DetallEstat | null>(null);
  const [editDia, setEditDia] = useState<DiaDet | null>(null);
  const [editArt, setEditArt] = useState<ArtDet | null>(null);
  const [editUnitats, setEditUnitats] = useState("");
  const [editBase, setEditBase] = useState("");

  const notify = (r: Result) => {
    setFeedback(r);
    if (r.ok) setTimeout(() => setFeedback(null), 5000);
  };

  const aplicarFiltre = (nextAny: string, nextMes: string) => {
    const params = new URLSearchParams();
    if (nextAny) params.set("any", nextAny);
    if (nextMes) params.set("mes", nextMes);
    const q = params.toString();
    router.push(q ? `/dades/vendes-restaurants?${q}` : "/dades/vendes-restaurants");
  };

  const pujar = (list: FileList | null) => {
    if (!list?.length) return;
    const fd = new FormData();
    for (const f of Array.from(list)) fd.append("fitxers", f);
    startTransition(async () => {
      const r = await uploadVendesRestaurantsAction(fd);
      notify(r);
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  const obrirDetall = (r: ResumDTO) => {
    startTransition(async () => {
      const d = await getDetallVendesAction({
        centreId: r.centreId,
        any: r.periodAny,
        mes: r.periodMes,
      });
      if (!d.ok) {
        notify({ ok: false, missatge: d.missatge ?? "No s'ha pogut carregar el detall." });
        return;
      }
      setDetall({ resum: r, dies: d.dies, productes: d.productes, packs: d.packs });
      setEditDia(null);
      setEditArt(null);
    });
  };

  const refrescarDetall = async (r: ResumDTO) => {
    const d = await getDetallVendesAction({
      centreId: r.centreId,
      any: r.periodAny,
      mes: r.periodMes,
    });
    if (d.ok) {
      setDetall({ resum: r, dies: d.dies, productes: d.productes, packs: d.packs });
    } else {
      setDetall(null);
    }
  };

  const eliminarBloc = (r: ResumDTO, ambit: AmbitVendes) => {
    const msg =
      ambit === "TOT"
        ? `Eliminar TOTES les vendes de ${r.centreCodi} · ${r.periodNom}?`
        : ambit === "V"
          ? `Eliminar només el fitxer V (dies) de ${r.centreCodi}?`
          : ambit === "DETALL"
            ? `Eliminar només el Detall (productes) de ${r.centreCodi}?`
            : `Eliminar només els Packs de ${r.centreCodi}?`;
    if (!confirm(msg)) return;
    startTransition(async () => {
      const res = await deleteVendesBlocAction({
        centreId: r.centreId,
        any: r.periodAny,
        mes: r.periodMes,
        ambit,
      });
      notify(res);
      if (res.ok) {
        if (ambit === "TOT") setDetall(null);
        else if (detall?.resum.centreId === r.centreId) await refrescarDetall(r);
      }
    });
  };

  const desarDia = () => {
    if (!editDia || !detall) return;
    const unitats = parseNum(editUnitats);
    const base = parseNum(editBase);
    if (Number.isNaN(unitats) || Number.isNaN(base)) {
      notify({ ok: false, missatge: "Imports no vàlids." });
      return;
    }
    startTransition(async () => {
      const res = await updateVendaDiariaAction({ id: editDia.id, unitats, base });
      notify(res);
      if (res.ok) {
        setEditDia(null);
        await refrescarDetall(detall.resum);
      }
    });
  };

  const desarArt = () => {
    if (!editArt || !detall) return;
    const unitats = parseNum(editUnitats);
    const base = parseNum(editBase);
    if (Number.isNaN(unitats) || Number.isNaN(base)) {
      notify({ ok: false, missatge: "Imports no vàlids." });
      return;
    }
    startTransition(async () => {
      const res = await updateVendaArticleAction({ id: editArt.id, unitats, base });
      notify(res);
      if (res.ok) {
        setEditArt(null);
        await refrescarDetall(detall.resum);
      }
    });
  };

  const eliminarDia = (id: string) => {
    if (!detall || !confirm("Eliminar aquest dia?")) return;
    startTransition(async () => {
      const res = await deleteVendaDiariaAction(id);
      notify(res);
      if (res.ok) await refrescarDetall(detall.resum);
    });
  };

  const eliminarArt = (id: string) => {
    if (!detall || !confirm("Eliminar aquest article?")) return;
    startTransition(async () => {
      const res = await deleteVendaArticleAction(id);
      notify(res);
      if (res.ok) await refrescarDetall(detall.resum);
    });
  };

  const iniciarEditDia = (d: DiaDet) => {
    setEditArt(null);
    setEditDia(d);
    setEditUnitats(String(d.unitats).replace(".", ","));
    setEditBase(String(d.base).replace(".", ","));
  };

  const iniciarEditArt = (a: ArtDet) => {
    setEditDia(null);
    setEditArt(a);
    setEditUnitats(String(a.unitats).replace(".", ","));
    setEditBase(String(a.base).replace(".", ","));
  };

  return (
    <>
      {feedback && (
        <div className={cn(styles.feedback, feedback.ok ? styles.feedbackOk : styles.feedbackErr)}>
          <div>{feedback.missatge}</div>
          {feedback.detalls && feedback.detalls.length > 0 && (
            <ul className={styles.errorList}>
              {feedback.detalls.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
          {feedback.errors && feedback.errors.length > 0 && (
            <ul className={styles.errorList}>
              {feedback.errors.slice(0, 10).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {canEdit && (
        <div className={styles.uploadCard}>
          <div>
            <h3 className={styles.uploadTitle}>Pujar Excel de vendes</h3>
            <p className={styles.uploadHint}>
              Pots seleccionar <strong>tots els Excel de cop</strong> (ex. gener–juliol de Camp Nou
              = 3 × mes). El sistema llegeix mes, any i centre del nom:{" "}
              <strong>V_MM_YYYY[_CC]</strong>, <strong>Detall_MM_YYYY_CC</strong>,{" "}
              <strong>Pack_MM_YYYY[_CC]</strong>. El sufix <strong>_CC</strong> són els 2 darrers
              dígits del centre (ex. _04 → CCR00004). Cada fitxer substitueix només aquell
              restaurant + període + tipus. Detall i Pack han de portar{" "}
              <strong>Article [Grupo] / [Familia] / [Subfamilia]</strong>.
            </p>
          </div>
          <label className={styles.uploadBtn}>
            <Upload size={16} />
            {isPending ? "Processant…" : "Seleccionar fitxers"}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.xlsm"
              multiple
              hidden
              disabled={isPending}
              onChange={(e) => pujar(e.target.files)}
            />
          </label>
        </div>
      )}

      <div className={styles.filters}>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="vendes-dades-any">
            Any
          </label>
          <select
            id="vendes-dades-any"
            className={styles.input}
            value={filtreAny ?? ""}
            onChange={(e) => aplicarFiltre(e.target.value, filtreMes ? String(filtreMes) : "")}
          >
            <option value="">Tots</option>
            {anys.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="vendes-dades-mes">
            Mes
          </label>
          <select
            id="vendes-dades-mes"
            className={styles.input}
            value={filtreMes ?? ""}
            onChange={(e) => aplicarFiltre(filtreAny ? String(filtreAny) : "", e.target.value)}
          >
            <option value="">Tots</option>
            {MESOS_LLARGS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {resums.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Sense vendes importades</p>
          <p className={styles.emptyText}>
            Puja els Excel mensuals V / Detall / Pack de cada restaurant.
          </p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Període</th>
                <th>Restaurant</th>
                <th className={styles.right}>Dies (V)</th>
                <th className={styles.right}>Vendes (V)</th>
                <th className={styles.right}>Productes</th>
                <th className={styles.right}>€ productes</th>
                <th className={styles.right}>Packs</th>
                <th className={styles.right}>€ packs</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {resums.map((r) => (
                <tr key={`${r.periodAny}-${r.periodMes}-${r.centreId}`}>
                  <td className={styles.nowrap}>{r.periodNom}</td>
                  <td>
                    {r.centreCodi} · {r.centreNom}
                  </td>
                  <td className={styles.right}>{r.dies || "–"}</td>
                  <td className={styles.right}>{r.dies ? formatNum(r.baseDies) : "–"}</td>
                  <td className={styles.right}>{r.productes || "–"}</td>
                  <td className={styles.right}>{r.productes ? formatNum(r.baseProductes) : "–"}</td>
                  <td className={styles.right}>{r.packs || "–"}</td>
                  <td className={styles.right}>{r.packs ? formatNum(r.basePacks) : "–"}</td>
                  <td className={styles.nowrap}>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => obrirDetall(r)}
                      disabled={isPending}
                      aria-label="Veure detall"
                      title="Veure / editar"
                    >
                      <Eye size={14} />
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        className={cn(styles.iconBtn, styles.iconDanger)}
                        onClick={() => eliminarBloc(r, "TOT")}
                        disabled={isPending}
                        aria-label="Eliminar tot"
                        title="Eliminar tot"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detall && (
        <div className={styles.detallCard}>
          <div className={styles.detallHead}>
            <div>
              <h3 className={styles.detallTitle}>
                {detall.resum.centreCodi} · {detall.resum.centreNom}
              </h3>
              <p className={styles.detallSub}>{detall.resum.periodNom}</p>
            </div>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => {
                setDetall(null);
                setEditDia(null);
                setEditArt(null);
              }}
            >
              <X size={15} /> Tancar
            </button>
          </div>

          {(editDia || editArt) && canEdit && (
            <div className={styles.editBar}>
              <strong>
                {editDia ? `Editar dia ${editDia.dia}` : `Editar ${editArt?.article}`}
              </strong>
              <div className={styles.editFields}>
                <label>
                  Unitats
                  <input
                    className={styles.input}
                    value={editUnitats}
                    onChange={(e) => setEditUnitats(e.target.value)}
                  />
                </label>
                <label>
                  Base €
                  <input
                    className={styles.input}
                    value={editBase}
                    onChange={(e) => setEditBase(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className={styles.saveBtn}
                  disabled={isPending}
                  onClick={editDia ? desarDia : desarArt}
                >
                  Desar
                </button>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => {
                    setEditDia(null);
                    setEditArt(null);
                  }}
                >
                  Cancel·lar
                </button>
              </div>
            </div>
          )}

          <BlocFitxer
            titol="Fitxer V · vendes diàries"
            comptador={`${detall.dies.length} dies · ${formatNum(detall.dies.reduce((s, d) => s + d.base, 0))} €`}
            canEdit={canEdit}
            onEliminar={() => eliminarBloc(detall.resum, "V")}
            disabled={isPending || !detall.dies.length}
          >
            {detall.dies.length === 0 ? (
              <p className={styles.emptyMini}>Sense fitxer V importat.</p>
            ) : (
              <div className={styles.miniTableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Dia</th>
                      <th>Data</th>
                      <th className={styles.right}>Unitats</th>
                      <th className={styles.right}>Base €</th>
                      {canEdit && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {detall.dies.map((d) => (
                      <tr key={d.id}>
                        <td>{d.dia}</td>
                        <td className={styles.nowrap}>
                          {d.dataIso.slice(8, 10)}/{d.dataIso.slice(5, 7)}/{d.dataIso.slice(0, 4)}
                        </td>
                        <td className={styles.right}>{formatNum(d.unitats, 0)}</td>
                        <td className={styles.right}>{formatNum(d.base)}</td>
                        {canEdit && (
                          <td className={styles.nowrap}>
                            <button
                              type="button"
                              className={styles.iconBtn}
                              onClick={() => iniciarEditDia(d)}
                              aria-label="Editar"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className={cn(styles.iconBtn, styles.iconDanger)}
                              onClick={() => eliminarDia(d.id)}
                              aria-label="Eliminar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </BlocFitxer>

          <BlocFitxer
            titol="Fitxer Detall · productes"
            comptador={`${detall.productes.length} articles · ${formatNum(detall.productes.reduce((s, a) => s + a.base, 0))} €`}
            canEdit={canEdit}
            onEliminar={() => eliminarBloc(detall.resum, "DETALL")}
            disabled={isPending || !detall.productes.length}
          >
            <ArticlesTable
              rows={detall.productes}
              canEdit={canEdit}
              onEdit={iniciarEditArt}
              onDelete={eliminarArt}
            />
          </BlocFitxer>

          <BlocFitxer
            titol="Fitxer Pack · packs i menús"
            comptador={`${detall.packs.length} packs · ${formatNum(detall.packs.reduce((s, a) => s + a.base, 0))} €`}
            canEdit={canEdit}
            onEliminar={() => eliminarBloc(detall.resum, "PACK")}
            disabled={isPending || !detall.packs.length}
          >
            <ArticlesTable
              rows={detall.packs}
              canEdit={canEdit}
              onEdit={iniciarEditArt}
              onDelete={eliminarArt}
            />
          </BlocFitxer>
        </div>
      )}
    </>
  );
}

function BlocFitxer({
  titol,
  comptador,
  canEdit,
  onEliminar,
  disabled,
  children,
}: {
  titol: string;
  comptador: string;
  canEdit: boolean;
  onEliminar: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <section className={styles.blocFitxer}>
      <div className={styles.blocHead}>
        <div>
          <h4 className={styles.blocTitle}>{titol}</h4>
          <p className={styles.blocMeta}>{comptador}</p>
        </div>
        {canEdit && (
          <button
            type="button"
            className={cn(styles.dangerBtn)}
            onClick={onEliminar}
            disabled={disabled}
          >
            <Trash2 size={14} /> Eliminar aquest fitxer
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function ArticlesTable({
  rows,
  canEdit,
  onEdit,
  onDelete,
}: {
  rows: ArtDet[];
  canEdit: boolean;
  onEdit: (a: ArtDet) => void;
  onDelete: (id: string) => void;
}) {
  if (!rows.length) return <p className={styles.emptyMini}>Sense dades importades.</p>;
  return (
    <div className={styles.miniTableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Article</th>
            <th>Categoria</th>
            <th>Grup</th>
            <th className={styles.right}>Unitats</th>
            <th className={styles.right}>Base €</th>
            {canEdit && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td>{a.article}</td>
              <td>
                {a.categoria === "BEGUDA" ? "Beguda" : a.categoria === "MENJAR" ? "Menjar" : "–"}
              </td>
              <td className={styles.muted}>{a.grup ?? "–"}</td>
              <td className={styles.right}>{formatNum(a.unitats, 0)}</td>
              <td className={styles.right}>{formatNum(a.base)}</td>
              {canEdit && (
                <td className={styles.nowrap}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => onEdit(a)}
                    aria-label="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className={cn(styles.iconBtn, styles.iconDanger)}
                    onClick={() => onDelete(a.id)}
                    aria-label="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
