"use client";

import { ConsultaToolbar } from "@/components/consultes/ConsultaToolbar";
import { FILTRE, MES_TOT_ANY } from "@/components/consultes/consulta-filtres";
import styles from "@/components/consultes/report.module.css";
import { MESOS_LLARGS } from "@/lib/periodes";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

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
    <ConsultaToolbar
      pending={pending}
      dates={
        <>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="rrhh-ca-any">
              Període A · {FILTRE.any}
            </label>
            <select
              id="rrhh-ca-any"
              className={styles.select}
              value={anyA}
              onChange={(e) => push({ anyA: e.target.value })}
            >
              {anys.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="rrhh-ca-mes">
              {FILTRE.mes} A
            </label>
            <select
              id="rrhh-ca-mes"
              className={styles.select}
              value={mesA ?? ""}
              lang="ca"
              translate="no"
              onChange={(e) => push({ mesA: e.target.value || null })}
            >
              <option value="">{MES_TOT_ANY}</option>
              {MESOS_LLARGS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="rrhh-cb-any">
              Període B · {FILTRE.any}
            </label>
            <select
              id="rrhh-cb-any"
              className={styles.select}
              value={anyB}
              onChange={(e) => push({ anyB: e.target.value })}
            >
              {anys.map((y) => (
                <option key={`b-${y}`} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="rrhh-cb-mes">
              {FILTRE.mes} B
            </label>
            <select
              id="rrhh-cb-mes"
              className={styles.select}
              value={mesB ?? ""}
              lang="ca"
              translate="no"
              onChange={(e) => push({ mesB: e.target.value || null })}
            >
              <option value="">{MES_TOT_ANY}</option>
              {MESOS_LLARGS.map((m, i) => (
                <option key={`bm-${m}`} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </>
      }
      camps={
        <>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="rrhh-cniv">
              Nivell
            </label>
            <select
              id="rrhh-cniv"
              className={styles.select}
              value={nivell}
              onChange={(e) => push({ nivell: e.target.value })}
            >
              <option value="linia">Línia</option>
              <option value="centre">Centre</option>
              <option value="departament">Departament</option>
            </select>
          </div>
          {(nivell === "centre" || nivell === "departament") && (
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="rrhh-cln">
                {FILTRE.linia}
              </label>
              <select
                id="rrhh-cln"
                className={styles.select}
                style={{ minWidth: 150 }}
                value={lnId ?? ""}
                onChange={(e) => push({ ln: e.target.value || null })}
              >
                <option value="">Totes</option>
                {arbre.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.codi} · {l.nom}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      }
    />
  );
}
