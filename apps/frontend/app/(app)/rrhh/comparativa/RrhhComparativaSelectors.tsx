"use client";

import { MESOS_LLARGS } from "@/lib/periodes";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import styles from "../rrhh.module.css";

type LnOpt = { id: string; codi: string; nom: string };

export function RrhhComparativaSelectors({
  anys,
  anyA,
  mesA,
  anyB,
  mesB,
  nivell,
  lnId,
  arbre,
}: {
  anys: number[];
  anyA: number;
  mesA: number | null;
  anyB: number;
  mesB: number | null;
  nivell: "linia" | "centre" | "departament";
  lnId: string | null;
  arbre: LnOpt[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const push = (patch: Record<string, string | null | undefined>) => {
    const p = new URLSearchParams();
    const next: Record<string, string | null | undefined> = {
      anyA: String(anyA),
      mesA: mesA != null ? String(mesA) : null,
      anyB: String(anyB),
      mesB: mesB != null ? String(mesB) : null,
      nivell,
      ln: lnId,
      ...patch,
    };
    for (const [k, v] of Object.entries(next)) {
      if (v != null && v !== "") p.set(k, v);
    }
    startTransition(() => router.push(`/rrhh/comparativa?${p}`));
  };

  return (
    <div className={styles.compBar} data-pending={pending ? "true" : undefined}>
      <label className={styles.compField}>
        Nivell
        <select value={nivell} onChange={(e) => push({ nivell: e.target.value })}>
          <option value="linia">Línia</option>
          <option value="centre">Centre</option>
          <option value="departament">Departament</option>
        </select>
      </label>
      {(nivell === "centre" || nivell === "departament") && (
        <label className={styles.compField}>
          Línia
          <select value={lnId ?? ""} onChange={(e) => push({ ln: e.target.value || null })}>
            <option value="">Totes</option>
            {arbre.map((l) => (
              <option key={l.id} value={l.id}>
                {l.codi} · {l.nom}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className={styles.compField}>
        Període A · Any
        <select value={anyA} onChange={(e) => push({ anyA: e.target.value })}>
          {anys.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.compField}>
        Mes A
        <select
          value={mesA ?? ""}
          onChange={(e) => push({ mesA: e.target.value || null })}
          lang="ca"
          translate="no"
        >
          <option value="">Tot l&apos;any</option>
          {MESOS_LLARGS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.compField}>
        Període B · Any
        <select value={anyB} onChange={(e) => push({ anyB: e.target.value })}>
          {anys.map((y) => (
            <option key={`b-${y}`} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.compField}>
        Mes B
        <select
          value={mesB ?? ""}
          onChange={(e) => push({ mesB: e.target.value || null })}
          lang="ca"
          translate="no"
        >
          <option value="">Tot l&apos;any</option>
          {MESOS_LLARGS.map((m, i) => (
            <option key={`b-${m}`} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
