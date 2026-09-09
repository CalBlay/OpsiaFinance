"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { type ArbreScopeOpt, defaultScopeRestaurants } from "@/lib/consulta-scope";
import { esRolRestringit } from "@/lib/nav-access";
import type { NavExtra } from "@/lib/nav-catalog";
import type { UserRole } from "@/types";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ConsultaScopeFields } from "./ConsultaScopeFields";
import { NavExtraFields } from "./NavExtraFields";
import styles from "./nou/page.module.css";

export type DeptOpt = { id: string; codi: string; nom: string };

type Props = {
  mode: "create" | "edit";
  action: (formData: FormData) => void | Promise<void>;
  error?: string | null;
  pending?: boolean;
  initial?: {
    id?: string;
    name: string;
    email: string;
    role: UserRole;
    departamentIds: string[];
    navExtra?: NavExtra;
  };
  departaments: DeptOpt[];
  arbre: ArbreScopeOpt[];
};

function withDefaultScope(role: UserRole, extra: NavExtra, arbre: ArbreScopeOpt[]): NavExtra {
  if (role !== "RESTAURACIO") return extra;
  const def = defaultScopeRestaurants(arbre);
  const hasLn = Boolean(extra.scope?.liniaNegociIds?.length || extra.scope?.centreIds?.length);
  const hasGrups = Boolean(extra.scope?.grups?.length);
  const hasVistes = Boolean(extra.scope?.vistes?.length);
  if (hasLn && hasGrups && hasVistes) return extra;
  return {
    ...extra,
    scope: {
      liniaNegociIds: hasLn ? (extra.scope?.liniaNegociIds ?? []) : def.liniaNegociIds,
      centreIds: hasLn ? (extra.scope?.centreIds ?? []) : def.centreIds,
      grups: hasGrups ? extra.scope?.grups : def.grups,
      vistes: hasVistes ? extra.scope?.vistes : def.vistes,
    },
  };
}

export function UserForm({ mode, action, error, pending, initial, departaments, arbre }: Props) {
  const [role, setRole] = useState<UserRole>(initial?.role ?? "CONSULTA");
  const [deptIds, setDeptIds] = useState<string[]>(initial?.departamentIds ?? []);
  const [navExtra, setNavExtra] = useState<NavExtra>(() =>
    withDefaultScope(initial?.role ?? "CONSULTA", initial?.navExtra ?? {}, arbre)
  );

  function toggleDept(id: string) {
    setDeptIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function onRoleChange(next: UserRole) {
    setRole(next);
    if (!esRolRestringit(next)) {
      setNavExtra({});
      return;
    }
    setNavExtra((prev) => {
      const base = esRolRestringit(role) ? prev : {};
      return withDefaultScope(
        next,
        next === "RESTAURACIO" ? base : { ...base, scope: undefined },
        arbre
      );
    });
  }

  const showScope =
    role === "RESTAURACIO" ||
    Boolean(navExtra.resultats?.includes("linia") || navExtra.resultats?.includes("centre"));

  return (
    <div className={styles.page}>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/settings">
          <ChevronLeft size={14} strokeWidth={2.5} />
          Configuració
        </Link>
      </Button>

      <h1 className={styles.title}>{mode === "create" ? "Nou usuari" : "Editar usuari"}</h1>

      <form action={action} className={styles.form}>
        {error ? <p className={styles.error}>{error}</p> : null}
        {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}

        <Input
          name="name"
          label="Nom complet"
          placeholder="Anna Garcia"
          required
          autoComplete="off"
          disabled={pending}
          defaultValue={initial?.name}
        />

        <Input
          name="email"
          type="email"
          label="Correu electrònic"
          placeholder="anna@empresa.com"
          required
          autoComplete="off"
          disabled={pending || mode === "edit"}
          defaultValue={initial?.email}
        />

        <div className={styles.field}>
          <label htmlFor="role" className={styles.label}>
            Rol <span className={styles.required}>*</span>
          </label>
          <select
            id="role"
            name="role"
            className={styles.select}
            value={role}
            onChange={(e) => onRoleChange(e.target.value as UserRole)}
            disabled={pending}
          >
            <option value="CONSULTA">Consultor — només consulta</option>
            <option value="EDICIO">Editor — consulta, importació i ajustos</option>
            <option value="SUPER_USUARI">Super usuari — configuració (sense usuaris)</option>
            <option value="ADMIN">Administrador — configuració i usuaris</option>
            <option value="PRESSUPOST_DEPT">
              Pressupost departament — només pressupost dels seus depts
            </option>
            <option value="RESTAURACIO">Restauració — només mòdul Restaurants</option>
          </select>
        </div>

        {role === "PRESSUPOST_DEPT" ? (
          <div className={styles.field}>
            <span className={styles.label}>
              Departaments assignats <span className={styles.required}>*</span>
            </span>
            <p className={styles.hint}>
              Per defecte només veu Pressupost. Només podrà crear i editar el pressupost
              d&apos;aquests departaments.
            </p>
            <div className={styles.deptGrid}>
              {departaments.map((d) => (
                <label key={d.id} className={styles.deptRow}>
                  <input
                    type="checkbox"
                    name="departamentIds"
                    value={d.id}
                    checked={deptIds.includes(d.id)}
                    onChange={() => toggleDept(d.id)}
                    disabled={pending}
                  />
                  <span className={styles.deptCodi}>{d.codi}</span>
                  <span>{d.nom}</span>
                </label>
              ))}
            </div>
            {departaments.length === 0 ? (
              <p className={styles.hint}>No hi ha departaments actius a l&apos;arbre.</p>
            ) : null}
          </div>
        ) : null}

        <NavExtraFields role={role} value={navExtra} onChange={setNavExtra} disabled={pending} />

        {showScope ? (
          <ConsultaScopeFields
            arbre={arbre}
            value={navExtra}
            onChange={setNavExtra}
            disabled={pending}
          />
        ) : null}

        {mode === "create" ? (
          <div>
            <Input
              name="password"
              type="password"
              label="Contrasenya inicial"
              placeholder="Mínim 8 caràcters"
              required
              minLength={8}
              autoComplete="new-password"
              disabled={pending}
            />
            <p className={styles.hint}>L&apos;usuari hauria de canviar-la en el primer accés.</p>
          </div>
        ) : (
          <div>
            <Input
              name="password"
              type="password"
              label="Nova contrasenya (opcional)"
              placeholder="Deixa en blanc per no canviar"
              minLength={8}
              autoComplete="new-password"
              disabled={pending}
            />
          </div>
        )}

        <div className={styles.formActions}>
          <Button type="submit" disabled={pending}>
            {pending ? "Desant..." : mode === "create" ? "Crear usuari" : "Desar canvis"}
          </Button>
          <Button asChild variant="outline" disabled={pending}>
            <Link href="/settings">Cancel·lar</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
