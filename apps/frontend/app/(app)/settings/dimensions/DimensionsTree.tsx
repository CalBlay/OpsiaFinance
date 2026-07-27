"use client";

import { cn } from "@/lib/utils";
import {
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FolderTree,
  Layers,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { createContext, useContext, useMemo, useState, useTransition } from "react";
import {
  createCentreAction,
  createDepartamentAction,
  createLnAction,
  deleteCentreAction,
  deleteDepartamentAction,
  deleteLnAction,
  toggleCentreAction,
  toggleDepartamentAction,
  toggleLnAction,
  updateCentreAction,
  updateDepartamentAction,
  updateLnAction,
} from "./actions";
import styles from "./page.module.css";

/* ─── Tipus ──────────────────────────────────────────────────────────────────── */

export interface DeptDTO {
  id: string;
  codi: string;
  nom: string;
  isActive: boolean;
}
export interface CentreDTO {
  id: string;
  codi: string;
  nom: string;
  isActive: boolean;
  departaments: DeptDTO[];
}
export interface LnDTO {
  id: string;
  codi: string;
  nom: string;
  isActive: boolean;
  centres: CentreDTO[];
}

type Result = { ok: boolean; missatge: string };

/* ─── Context ────────────────────────────────────────────────────────────────── */

interface TreeCtx {
  canEdit: boolean;
  notify: (r: Result) => void;
}
const Ctx = createContext<TreeCtx>({ canEdit: false, notify: () => {} });

/* ─── Component principal ────────────────────────────────────────────────────── */

export function DimensionsTree({ linies, canEdit }: { linies: LnDTO[]; canEdit: boolean }) {
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState<Result | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [addingLn, setAddingLn] = useState(false);

  const notify = (r: Result) => {
    setFeedback(r);
    if (r.ok && r.missatge) setTimeout(() => setFeedback(null), 4000);
  };

  const stats = useMemo(() => {
    const ce = linies.reduce((a, l) => a + l.centres.length, 0);
    const de = linies.reduce(
      (a, l) => a + l.centres.reduce((b, c) => b + c.departaments.length, 0),
      0
    );
    return { ln: linies.length, ce, de };
  }, [linies]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return linies;
    const match = (s: string) => s.toLowerCase().includes(q);
    return linies
      .map((ln) => {
        const lnHit = match(ln.codi) || match(ln.nom);
        const centres = ln.centres
          .map((c) => {
            const cHit = match(c.codi) || match(c.nom);
            const depts = c.departaments.filter((d) => match(d.codi) || match(d.nom));
            if (cHit || depts.length) return { ...c, departaments: cHit ? c.departaments : depts };
            return null;
          })
          .filter(Boolean) as CentreDTO[];
        if (lnHit || centres.length) return { ...ln, centres: lnHit ? ln.centres : centres };
        return null;
      })
      .filter(Boolean) as LnDTO[];
  }, [linies, query]);

  const isSearching = query.trim().length > 0;

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <Ctx.Provider value={{ canEdit, notify }}>
      {/* Estadístiques */}
      <div className={styles.statsBar}>
        <StatCard
          icon={<Layers size={18} />}
          cls={styles.statIconLn}
          value={stats.ln}
          label="Línies de negoci"
        />
        <StatCard
          icon={<Building2 size={18} />}
          cls={styles.statIconCe}
          value={stats.ce}
          label="Centres"
        />
        <StatCard
          icon={<FolderTree size={18} />}
          cls={styles.statIconDe}
          value={stats.de}
          label="Departaments"
        />
      </div>

      {/* Barra d'eines */}
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Cerca per codi o nom…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button className={styles.linkBtn} onClick={() => setCollapsed(new Set())}>
          Expandir tot
        </button>
        <button
          className={styles.linkBtn}
          onClick={() =>
            setCollapsed(new Set(linies.flatMap((l) => [l.id, ...l.centres.map((c) => c.id)])))
          }
        >
          Col·lapsar tot
        </button>
      </div>

      {feedback && (
        <div className={cn(styles.feedback, feedback.ok ? styles.feedbackOk : styles.feedbackErr)}>
          {feedback.missatge}
        </div>
      )}

      {/* Arbre */}
      <div className={styles.tree}>
        {filtered.map((ln) => (
          <LnNode
            key={ln.id}
            ln={ln}
            collapsed={collapsed}
            toggleCollapse={toggleCollapse}
            forceOpen={isSearching}
          />
        ))}

        {canEdit &&
          !isSearching &&
          (addingLn ? (
            <AddInline
              level="ln"
              placeholder="Codi (p.ex. LN00007)"
              onCancel={() => setAddingLn(false)}
              onSubmit={async (codi, nom) => {
                const r = await createLnAction(codi, nom);
                notify(r);
                if (r.ok) setAddingLn(false);
                return r;
              }}
            />
          ) : (
            <div className={styles.addRow}>
              <button className={styles.addTrigger} onClick={() => setAddingLn(true)}>
                <Plus size={14} /> Afegir línia de negoci
              </button>
            </div>
          ))}
      </div>
    </Ctx.Provider>
  );
}

/* ─── Node LN ────────────────────────────────────────────────────────────────── */

function LnNode({
  ln,
  collapsed,
  toggleCollapse,
  forceOpen,
}: {
  ln: LnDTO;
  collapsed: Set<string>;
  toggleCollapse: (id: string) => void;
  forceOpen: boolean;
}) {
  const { canEdit, notify } = useContext(Ctx);
  const open = forceOpen || !collapsed.has(ln.id);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);

  return (
    <div className={styles.node}>
      <div className={cn(styles.row, styles.lnRow, !ln.isActive && styles.inactiveRow)}>
        <button className={styles.expandBtn} onClick={() => toggleCollapse(ln.id)}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {editing ? (
          <InlineEdit
            codi={ln.codi}
            nom={ln.nom}
            onCancel={() => setEditing(false)}
            onSubmit={async (codi, nom) => {
              const r = await updateLnAction(ln.id, codi, nom);
              notify(r);
              if (r.ok) setEditing(false);
              return r;
            }}
          />
        ) : (
          <>
            <span className={cn(styles.codePill, styles.codeLn)}>{ln.codi}</span>
            <span className={cn(styles.name, styles.lnName)}>{ln.nom}</span>
            {!ln.isActive && <span className={styles.inactiveTag}>inactiva</span>}
            <span className={styles.count}>{ln.centres.length} centres</span>
            {canEdit && (
              <NodeActions
                isActive={ln.isActive}
                onEdit={() => setEditing(true)}
                onAdd={() => setAdding(true)}
                addTitle="Afegir centre"
                onToggle={async () => notify(await toggleLnAction(ln.id, !ln.isActive))}
                onDelete={async () => notify(await deleteLnAction(ln.id))}
                deleteConfirm={`Eliminar la línia "${ln.nom}"? Només es pot si no té dades importades.`}
              />
            )}
          </>
        )}
      </div>

      {open && (
        <div className={styles.children}>
          {ln.centres.map((c) => (
            <CentreNode
              key={c.id}
              centre={c}
              collapsed={collapsed}
              toggleCollapse={toggleCollapse}
              forceOpen={forceOpen}
            />
          ))}

          {canEdit &&
            (adding ? (
              <div className={styles.centreAdd}>
                <AddInline
                  level="centre"
                  placeholder="Codi (p.ex. CCR00012)"
                  onCancel={() => setAdding(false)}
                  onSubmit={async (codi, nom) => {
                    const r = await createCentreAction(ln.id, codi, nom);
                    notify(r);
                    if (r.ok) setAdding(false);
                    return r;
                  }}
                />
              </div>
            ) : (
              <div className={cn(styles.addRow, styles.centreAdd)}>
                <button className={styles.addTrigger} onClick={() => setAdding(true)}>
                  <Plus size={13} /> Afegir centre
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

/* ─── Node Centre ────────────────────────────────────────────────────────────── */

function CentreNode({
  centre,
  collapsed,
  toggleCollapse,
  forceOpen,
}: {
  centre: CentreDTO;
  collapsed: Set<string>;
  toggleCollapse: (id: string) => void;
  forceOpen: boolean;
}) {
  const { canEdit, notify } = useContext(Ctx);
  const open = forceOpen || !collapsed.has(centre.id);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const hasDepts = centre.departaments.length > 0;

  return (
    <div className={styles.node}>
      <div className={cn(styles.row, styles.centreRow, !centre.isActive && styles.inactiveRow)}>
        {hasDepts ? (
          <button className={styles.expandBtn} onClick={() => toggleCollapse(centre.id)}>
            {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
        ) : (
          <span className={styles.expandSpacer} />
        )}

        {editing ? (
          <InlineEdit
            codi={centre.codi}
            nom={centre.nom}
            onCancel={() => setEditing(false)}
            onSubmit={async (codi, nom) => {
              const r = await updateCentreAction(centre.id, codi, nom);
              notify(r);
              if (r.ok) setEditing(false);
              return r;
            }}
          />
        ) : (
          <>
            <span className={cn(styles.codePill, styles.codeCe)}>{centre.codi}</span>
            <span className={cn(styles.name, styles.centreName)}>{centre.nom}</span>
            {!centre.isActive && <span className={styles.inactiveTag}>inactiu</span>}
            <span className={styles.count}>{centre.departaments.length} depts.</span>
            {canEdit && (
              <NodeActions
                isActive={centre.isActive}
                onEdit={() => setEditing(true)}
                onAdd={() => setAdding(true)}
                addTitle="Afegir departament"
                onToggle={async () => notify(await toggleCentreAction(centre.id, !centre.isActive))}
                onDelete={async () => notify(await deleteCentreAction(centre.id))}
                deleteConfirm={`Eliminar el centre "${centre.nom}"?`}
              />
            )}
          </>
        )}
      </div>

      {open && (
        <div className={styles.children}>
          {centre.departaments.map((d) => (
            <DeptNode key={d.id} dept={d} />
          ))}

          {canEdit &&
            (adding ? (
              <div className={styles.deptAdd}>
                <AddInline
                  level="dept"
                  placeholder="Codi (p.ex. DRO0005)"
                  onCancel={() => setAdding(false)}
                  onSubmit={async (codi, nom) => {
                    const r = await createDepartamentAction(centre.id, codi, nom);
                    notify(r);
                    if (r.ok) setAdding(false);
                    return r;
                  }}
                />
              </div>
            ) : (
              <div className={cn(styles.addRow, styles.deptAdd)}>
                <button className={styles.addTrigger} onClick={() => setAdding(true)}>
                  <Plus size={12} /> Afegir departament
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

/* ─── Node Departament ───────────────────────────────────────────────────────── */

function DeptNode({ dept }: { dept: DeptDTO }) {
  const { canEdit, notify } = useContext(Ctx);
  const [editing, setEditing] = useState(false);

  return (
    <div className={cn(styles.row, styles.deptRow, !dept.isActive && styles.inactiveRow)}>
      <span className={styles.expandSpacer} />
      {editing ? (
        <InlineEdit
          codi={dept.codi}
          nom={dept.nom}
          onCancel={() => setEditing(false)}
          onSubmit={async (codi, nom) => {
            const r = await updateDepartamentAction(dept.id, codi, nom);
            notify(r);
            if (r.ok) setEditing(false);
            return r;
          }}
        />
      ) : (
        <>
          <span className={cn(styles.codePill, styles.codeDe)}>{dept.codi}</span>
          <span className={cn(styles.name, styles.deptName)}>{dept.nom}</span>
          {!dept.isActive && <span className={styles.inactiveTag}>inactiu</span>}
          {canEdit && (
            <NodeActions
              isActive={dept.isActive}
              onEdit={() => setEditing(true)}
              onToggle={async () => notify(await toggleDepartamentAction(dept.id, !dept.isActive))}
              onDelete={async () => notify(await deleteDepartamentAction(dept.id))}
              deleteConfirm={`Eliminar el departament "${dept.nom}"?`}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ─── Accions d'un node ──────────────────────────────────────────────────────── */

function NodeActions({
  isActive,
  onEdit,
  onAdd,
  addTitle,
  onToggle,
  onDelete,
  deleteConfirm,
}: {
  isActive: boolean;
  onEdit: () => void;
  onAdd?: () => void;
  addTitle?: string;
  onToggle: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  deleteConfirm: string;
}) {
  const [isPending, startTransition] = useTransition();
  const run = (fn: () => void | Promise<void>) =>
    startTransition(async () => {
      await fn();
    });

  return (
    <div className={styles.actions}>
      {onAdd && (
        <button className={styles.iconBtn} title={addTitle} onClick={onAdd} disabled={isPending}>
          <Plus size={14} />
        </button>
      )}
      <button className={styles.iconBtn} title="Edita" onClick={onEdit} disabled={isPending}>
        <Pencil size={13} />
      </button>
      <button
        className={styles.iconBtn}
        title={isActive ? "Desactiva" : "Activa"}
        onClick={() => run(onToggle)}
        disabled={isPending}
      >
        {isActive ? <Eye size={14} /> : <EyeOff size={14} />}
      </button>
      <button
        className={cn(styles.iconBtn, styles.iconBtnDanger)}
        title="Elimina"
        onClick={() => {
          if (confirm(deleteConfirm)) run(onDelete);
        }}
        disabled={isPending}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

/* ─── Edició en línia (codi + nom) ───────────────────────────────────────────── */

function InlineEdit({
  codi,
  nom,
  onSubmit,
  onCancel,
}: {
  codi: string;
  nom: string;
  onSubmit: (codi: string, nom: string) => Promise<Result>;
  onCancel: () => void;
}) {
  const [c, setC] = useState(codi);
  const [n, setN] = useState(nom);
  const [isPending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      await onSubmit(c, n);
    });

  return (
    <div className={styles.editRow}>
      <input
        className={styles.editCode}
        value={c}
        onChange={(e) => setC(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") onCancel();
        }}
      />
      <input
        className={styles.editName}
        value={n}
        autoFocus
        onChange={(e) => setN(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") onCancel();
        }}
      />
      <button className={styles.iconBtn} title="Desa" onClick={save} disabled={isPending}>
        <Check size={15} className="text-green-700" />
      </button>
      <button className={styles.iconBtn} title="Cancel·la" onClick={onCancel} disabled={isPending}>
        <X size={15} />
      </button>
    </div>
  );
}

/* ─── Afegir en línia ────────────────────────────────────────────────────────── */

function AddInline({
  level,
  placeholder,
  onSubmit,
  onCancel,
}: {
  level: "ln" | "centre" | "dept";
  placeholder: string;
  onSubmit: (codi: string, nom: string) => Promise<Result>;
  onCancel: () => void;
}) {
  const [c, setC] = useState("");
  const [n, setN] = useState("");
  const [isPending, startTransition] = useTransition();

  const save = () => {
    if (!c.trim() || !n.trim()) return;
    startTransition(async () => {
      const r = await onSubmit(c, n);
      if (r.ok) {
        setC("");
        setN("");
      }
    });
  };

  const codeCls =
    level === "ln" ? styles.codeLn : level === "centre" ? styles.codeCe : styles.codeDe;

  return (
    <div className={cn(styles.row)}>
      <span className={styles.expandSpacer} />
      <div className={styles.editRow}>
        <input
          className={cn(styles.editCode, codeCls)}
          placeholder={placeholder}
          value={c}
          autoFocus
          onChange={(e) => setC(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") onCancel();
          }}
        />
        <input
          className={styles.editName}
          placeholder="Nom"
          value={n}
          onChange={(e) => setN(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") onCancel();
          }}
        />
        <button className={styles.iconBtn} title="Afegeix" onClick={save} disabled={isPending}>
          <Check size={15} className="text-green-700" />
        </button>
        <button
          className={styles.iconBtn}
          title="Cancel·la"
          onClick={onCancel}
          disabled={isPending}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

/* ─── Targeta d'estadística ──────────────────────────────────────────────────── */

function StatCard({
  icon,
  cls,
  value,
  label,
}: { icon: React.ReactNode; cls: string; value: number; label: string }) {
  return (
    <div className={styles.statCard}>
      <div className={cn(styles.statIcon, cls)}>{icon}</div>
      <div>
        <div className={styles.statValue}>{value}</div>
        <div className={styles.statLabel}>{label}</div>
      </div>
    </div>
  );
}
