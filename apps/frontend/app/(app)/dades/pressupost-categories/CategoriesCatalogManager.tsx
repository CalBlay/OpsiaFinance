"use client";

import {
  deleteCategoriaCatalogAction,
  setActivaCategoriaCatalogAction,
  upsertCategoriaCatalogAction,
} from "@/app/(app)/dades/pressupost-categories/actions";
import ui from "@/components/dades/dades-ui.module.css";
import type {
  CategoriaCatalogDeptOpt,
  CategoriaCatalogRow,
} from "@/lib/pressupost/partida-catalog";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import styles from "./CategoriesCatalogManager.module.css";

type Props = {
  categories: CategoriaCatalogRow[];
  departaments: CategoriaCatalogDeptOpt[];
  canEdit: boolean;
};

type FormState = {
  id?: string;
  codi: string;
  nom: string;
  notes: string;
  totsDepartaments: boolean;
  isActive: boolean;
  departamentIds: string[];
};

const FORM_BUIT: FormState = {
  codi: "",
  nom: "",
  notes: "",
  totsDepartaments: true,
  isActive: true,
  departamentIds: [],
};

export function CategoriesCatalogManager({ categories, departaments, canEdit }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(FORM_BUIT);
  const [mostrar, setMostrar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [filtre, setFiltre] = useState("");

  const filtrades = useMemo(() => {
    const q = filtre.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) =>
        c.nom.toLowerCase().includes(q) ||
        c.codi.toLowerCase().includes(q) ||
        c.key.toLowerCase().includes(q)
    );
  }, [categories, filtre]);

  const deptById = useMemo(() => {
    return new Map(departaments.map((d) => [d.id, d]));
  }, [departaments]);

  function editar(c: CategoriaCatalogRow) {
    setForm({
      id: c.id,
      codi: c.codi,
      nom: c.nom,
      notes: c.notes ?? "",
      totsDepartaments: c.totsDepartaments,
      isActive: c.isActive,
      departamentIds: [...c.departamentIds],
    });
    setMostrar(true);
    setError(null);
  }

  function toggleDept(id: string) {
    setForm((f) => {
      const set = new Set(f.departamentIds);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...f, departamentIds: [...set] };
    });
  }

  function desar() {
    if (!canEdit) return;
    setError(null);
    startTransition(async () => {
      const r = await upsertCategoriaCatalogAction({
        id: form.id,
        codi: form.codi || undefined,
        nom: form.nom,
        notes: form.notes,
        totsDepartaments: form.totsDepartaments,
        isActive: form.isActive,
        departamentIds: form.departamentIds,
      });
      if (!r.ok) {
        setError(r.missatge);
        return;
      }
      setOk(r.missatge);
      setMostrar(false);
      setForm(FORM_BUIT);
      router.refresh();
    });
  }

  function setActiva(id: string, isActive: boolean) {
    startTransition(async () => {
      const r = await setActivaCategoriaCatalogAction(id, isActive);
      if (!r.ok) setError(r.missatge);
      else {
        setOk(r.missatge);
        router.refresh();
      }
    });
  }

  function eliminar(id: string) {
    if (!window.confirm("Eliminar aquesta categoria?")) return;
    startTransition(async () => {
      const r = await deleteCategoriaCatalogAction(id);
      if (!r.ok) setError(r.missatge);
      else {
        setOk(r.missatge);
        router.refresh();
      }
    });
  }

  function etiquetaVisibilitat(c: CategoriaCatalogRow): string {
    if (c.totsDepartaments) return "Tots els departaments";
    if (!c.departamentIds.length) return "Cap departament";
    return c.departamentIds.map((id) => deptById.get(id)?.codi ?? "?").join(", ");
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          value={filtre}
          onChange={(e) => setFiltre(e.target.value)}
          placeholder="Cerca per nom, codi…"
        />
        {canEdit ? (
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => {
              setForm(FORM_BUIT);
              setMostrar(true);
              setError(null);
            }}
          >
            + Nova categoria
          </button>
        ) : null}
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {ok ? <p className={styles.ok}>{ok}</p> : null}

      {mostrar && canEdit ? (
        <div className={ui.panel}>
          <div className={ui.panelHeader}>
            <h2 className={ui.panelTitle}>{form.id ? "Editar categoria" : "Nova categoria"}</h2>
          </div>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span className={styles.label}>Nom</span>
              <input
                className={styles.input}
                value={form.nom}
                onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                placeholder="Ex.: Publicitat / comunicació"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Codi (opcional)</span>
              <input
                className={styles.input}
                value={form.codi}
                onChange={(e) => setForm((f) => ({ ...f, codi: e.target.value.toUpperCase() }))}
                placeholder="Auto si es deixa buit"
              />
            </label>
            <label className={styles.fieldWide}>
              <span className={styles.label}>Notes</span>
              <input
                className={styles.input}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Ajuda per a qui elabora el pressupost…"
              />
            </label>
          </div>

          <div className={styles.visBlock}>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={form.totsDepartaments}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    totsDepartaments: e.target.checked,
                    departamentIds: e.target.checked ? [] : f.departamentIds,
                  }))
                }
              />
              Activa a tots els departaments
            </label>

            {!form.totsDepartaments ? (
              <div className={styles.deptGrid}>
                {departaments.map((d) => (
                  <label key={d.id} className={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={form.departamentIds.includes(d.id)}
                      onChange={() => toggleDept(d.id)}
                    />
                    <span className={styles.deptCodi}>{d.codi}</span>
                    <span>{d.nom}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.btnPrimary} disabled={pending} onClick={desar}>
              Desar
            </button>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={() => {
                setMostrar(false);
                setForm(FORM_BUIT);
              }}
            >
              Cancel·lar
            </button>
          </div>
        </div>
      ) : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Codi</th>
              <th>Categoria</th>
              <th>Activa a</th>
              <th>Estat</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtrades.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.empty}>
                  Cap categoria. Les per defecte es creen soles; pots afegir-ne de noves i
                  limitar-les per departament.
                </td>
              </tr>
            ) : (
              filtrades.map((c) => (
                <tr key={c.id} className={c.isActive ? undefined : styles.rowOff}>
                  <td className={styles.codi}>{c.codi}</td>
                  <td>
                    <div className={styles.nom}>{c.nom}</div>
                    {c.notes ? <div className={styles.notes}>{c.notes}</div> : null}
                  </td>
                  <td className={styles.vis}>{etiquetaVisibilitat(c)}</td>
                  <td>{c.isActive ? "Activa" : "Inactiva"}</td>
                  <td className={styles.rowActions}>
                    {canEdit ? (
                      <>
                        <button type="button" className={styles.linkBtn} onClick={() => editar(c)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className={styles.linkBtn}
                          onClick={() => setActiva(c.id, !c.isActive)}
                        >
                          {c.isActive ? "Desactivar" : "Activar"}
                        </button>
                        <button
                          type="button"
                          className={styles.linkDanger}
                          onClick={() => eliminar(c.id)}
                        >
                          Eliminar
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
