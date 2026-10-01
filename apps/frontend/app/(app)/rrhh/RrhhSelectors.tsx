"use client";

import { ConsultaToolbar } from "@/components/consultes/ConsultaToolbar";
import { FILTRE, MES_TOT_ANY } from "@/components/consultes/consulta-filtres";
import styles from "@/components/consultes/report.module.css";
import { MESOS_LLARGS } from "@/lib/periodes";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type LnOpt = {
  id: string;
  codi: string;
  nom: string;
  centres: { id: string; codi: string; nom: string }[];
};

export function RrhhSelectors({
  basePath,
  anys,
  any,
  mes,
  lnId,
  centreId,
  arbre,
  showLn = false,
  showCentre = false,
  extraParams,
}: {
  basePath: string;
  anys: number[];
  any: number;
  mes: number | null;
  lnId?: string | null;
  centreId?: string | null;
  arbre?: LnOpt[];
  showLn?: boolean;
  showCentre?: boolean;
  extraParams?: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const push = (patch: Record<string, string | null | undefined>) => {
    const p = new URLSearchParams();
    const next: Record<string, string | null | undefined> = {
      any: String(any),
      mes: mes != null ? String(mes) : null,
      ln: lnId ?? null,
      centre: centreId ?? null,
      ...extraParams,
      ...patch,
    };
    for (const [k, v] of Object.entries(next)) {
      if (v != null && v !== "") p.set(k, v);
    }
    startTransition(() => router.push(`${basePath}?${p}`));
  };

  const ln = arbre?.find((l) => l.id === lnId);
  const centres = showCentre ? (ln?.centres ?? arbre?.flatMap((l) => l.centres) ?? []) : [];

  return (
    <ConsultaToolbar
      pending={pending}
      dates={
        <>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="rrhh-any">
              {FILTRE.any}
            </label>
            <select
              id="rrhh-any"
              className={styles.select}
              style={{ minWidth: 100 }}
              value={any}
              onChange={(e) => push({ any: e.target.value })}
            >
              {anys.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="rrhh-mes">
              {FILTRE.mes}
            </label>
            <select
              id="rrhh-mes"
              className={styles.select}
              style={{ minWidth: 130 }}
              value={mes ?? ""}
              lang="ca"
              translate="no"
              onChange={(e) => push({ mes: e.target.value || null })}
            >
              <option value="">{MES_TOT_ANY}</option>
              {MESOS_LLARGS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </>
      }
      camps={
        (showLn || showCentre) && arbre ? (
          <>
            {showLn ? (
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="rrhh-ln">
                  {FILTRE.linia}
                </label>
                <select
                  id="rrhh-ln"
                  className={styles.select}
                  style={{ minWidth: 160 }}
                  value={lnId ?? ""}
                  onChange={(e) => push({ ln: e.target.value || null, centre: null })}
                >
                  <option value="">Totes</option>
                  {arbre.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.codi} · {l.nom}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {showCentre ? (
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="rrhh-centre">
                  {FILTRE.centre}
                </label>
                <select
                  id="rrhh-centre"
                  className={styles.select}
                  style={{ minWidth: 160 }}
                  value={centreId ?? ""}
                  onChange={(e) => push({ centre: e.target.value || null })}
                >
                  <option value="">Tots</option>
                  {centres.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.codi} · {c.nom}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </>
        ) : undefined
      }
    />
  );
}
