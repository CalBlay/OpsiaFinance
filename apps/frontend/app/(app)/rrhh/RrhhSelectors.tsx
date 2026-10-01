"use client";

import { ConsultaToolbar, FILTRE } from "@/components/consultes/ConsultaToolbar";
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
    startTransition(() => {
      router.push(`${basePath}?${p}`);
    });
  };

  const ln = arbre?.find((l) => l.id === lnId);
  const centres = ln?.centres ?? arbre?.flatMap((l) => l.centres) ?? [];

  return (
    <ConsultaToolbar
      pending={pending}
      dates={
        <>
          <label>
            {FILTRE.any}
            <select value={any} onChange={(e) => push({ any: e.target.value })} aria-label="Any">
              {anys.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label>
            {FILTRE.mes}
            <select
              value={mes ?? ""}
              onChange={(e) => push({ mes: e.target.value || null })}
              aria-label="Mes"
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
        </>
      }
      camps={
        (showLn || showCentre) && arbre ? (
          <>
            {showLn ? (
              <label>
                Línia
                <select
                  value={lnId ?? ""}
                  onChange={(e) => push({ ln: e.target.value || null, centre: null })}
                  aria-label="Línia de negoci"
                >
                  <option value="">Totes</option>
                  {arbre.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.codi} · {l.nom}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {showCentre ? (
              <label>
                Centre
                <select
                  value={centreId ?? ""}
                  onChange={(e) => push({ centre: e.target.value || null })}
                  aria-label="Centre"
                >
                  <option value="">Tots</option>
                  {centres.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.codi} · {c.nom}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </>
        ) : undefined
      }
    />
  );
}
