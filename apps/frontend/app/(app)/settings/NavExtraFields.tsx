"use client";

import { defaultSubs, esRolRestringit } from "@/lib/nav-access";
import {
  DADES_SUBS,
  MODUL_LABELS,
  type NavExtra,
  type NavModul,
  PRESSUPOST_SUBS,
  RESTAURANTS_SUBS,
  RESULTATS_SUBS,
  SETTINGS_SUBS,
} from "@/lib/nav-catalog";
import type { UserRole } from "@/types";
import { useMemo } from "react";
import styles from "./nou/page.module.css";

const MODULS: NavModul[] = ["inici", "resultats", "restaurants", "pressupost", "dades", "settings"];

function subsOf(modul: NavModul) {
  switch (modul) {
    case "resultats":
      return RESULTATS_SUBS;
    case "restaurants":
      return RESTAURANTS_SUBS;
    case "pressupost":
      return PRESSUPOST_SUBS;
    case "dades":
      return DADES_SUBS;
    case "settings":
      return SETTINGS_SUBS;
    default:
      return [];
  }
}

type Props = {
  role: UserRole;
  value: NavExtra;
  onChange: (next: NavExtra) => void;
  disabled?: boolean;
};

export function NavExtraFields({ role, value, onChange, disabled }: Props) {
  const defaults = useMemo(() => {
    const map: Partial<Record<NavModul, string[]>> = {};
    for (const m of MODULS) map[m] = defaultSubs(role, m);
    return map;
  }, [role]);

  if (!esRolRestringit(role)) return null;

  function toggleModul(modul: NavModul, on: boolean) {
    const next = { ...value };
    if (modul === "inici") {
      if (on) next.inici = true;
      else next.inici = undefined;
      onChange(next);
      return;
    }
    const allIds = subsOf(modul).map((s) => s.id);
    if (on) {
      (next as Record<string, string[]>)[modul] = allIds;
    } else {
      (next as Record<string, unknown>)[modul] = undefined;
    }
    onChange(next);
  }

  function toggleSub(modul: NavModul, subId: string, on: boolean) {
    if (modul === "inici") return;
    const cur = new Set(((value as Record<string, string[] | undefined>)[modul] ?? []) as string[]);
    if (on) cur.add(subId);
    else cur.delete(subId);
    const next = { ...value } as Record<string, unknown>;
    if (cur.size === 0) next[modul] = undefined;
    else next[modul] = [...cur];
    onChange(next as NavExtra);
  }

  function modulOn(modul: NavModul): boolean {
    if (modul === "inici") return value.inici === true;
    const arr = (value as Record<string, string[] | undefined>)[modul];
    return Array.isArray(arr) && arr.length > 0;
  }

  return (
    <div className={styles.field}>
      <span className={styles.label}>Accés addicional (opcional)</span>
      <p className={styles.hint}>
        Per defecte només veu el mòdul del seu rol. Aquí pots marcar altres pestanyes i subpestanyes
        (incloent Dades i Configuració). L&apos;usuari ha de tornar a entrar perquè s&apos;apliquin
        els canvis.
      </p>
      <div className={styles.extraStack}>
        {MODULS.map((modul) => {
          const def = defaults[modul] ?? [];
          const isDefaultOnly = def.length > 0 && def[0] !== "*";
          // No mostrar el mòdul per defecte del rol com a "extra" activable del mateix
          // (ja el té); sí permetre ampliar subpestanyes del mòdul propi.
          const subs = subsOf(modul);
          const showAsExtraModul =
            !isDefaultOnly || modul === "pressupost" || modul === "restaurants";

          if (!showAsExtraModul && !isDefaultOnly) return null;

          const enabled = isDefaultOnly || modulOn(modul);
          const checkedExtra = modulOn(modul);

          return (
            <div key={modul} className={styles.extraModul}>
              {isDefaultOnly ? (
                <p className={styles.extraModulTitle}>
                  {MODUL_LABELS[modul]} <span className={styles.hintInline}>(per defecte)</span>
                </p>
              ) : (
                <label className={styles.deptRow}>
                  <input
                    type="checkbox"
                    checked={checkedExtra}
                    disabled={disabled}
                    onChange={(e) => toggleModul(modul, e.target.checked)}
                  />
                  <span className={styles.extraModulTitle}>{MODUL_LABELS[modul]}</span>
                </label>
              )}

              {modul !== "inici" && enabled && subs.length > 0 ? (
                <div className={styles.extraSubs}>
                  {subs.map((s) => {
                    const locked = def.includes(s.id);
                    const on =
                      locked ||
                      (
                        ((value as Record<string, string[] | undefined>)[modul] ?? []) as string[]
                      ).includes(s.id);
                    return (
                      <label key={s.id} className={styles.deptRow}>
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={disabled || locked}
                          onChange={(e) => toggleSub(modul, s.id, e.target.checked)}
                        />
                        <span>{s.label}</span>
                        {locked ? <span className={styles.hintInline}>defecte</span> : null}
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <input type="hidden" name="navExtra" value={JSON.stringify(value)} />
    </div>
  );
}
