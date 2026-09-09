"use client";

import { GRUP_CHANGE_EVENT, setGrupEmpresaClient } from "@/lib/grup-cookie-client";
import { prefetchGrupIniciAction } from "@/lib/grup-prefetch";
import { GRUP_EMPRESA_LABELS, GRUP_EMPRESA_OPCIONS, type GrupEmpresa } from "@/lib/grups-empresa";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import styles from "./GrupEmpresaSelector.module.css";

export function GrupEmpresaSelector({
  value,
  allowed,
}: {
  value: GrupEmpresa;
  /** Si és null/undefined, totes les empreses. */
  allowed?: GrupEmpresa[] | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const opcions = useMemo(() => {
    if (!allowed?.length) return GRUP_EMPRESA_OPCIONS;
    return GRUP_EMPRESA_OPCIONS.filter((g) => allowed.includes(g));
  }, [allowed]);
  const [local, setLocal] = useState<GrupEmpresa>(
    opcions.includes(value) ? value : (opcions[0] ?? value)
  );

  useEffect(() => {
    const next = opcions.includes(value) ? value : (opcions[0] ?? value);
    setLocal(next);
    if (next !== value) {
      setGrupEmpresaClient(next);
    }
  }, [value, opcions]);

  useEffect(() => {
    const onGrup = (e: Event) => {
      const detail = (e as CustomEvent<GrupEmpresa>).detail;
      if (detail && opcions.includes(detail)) setLocal(detail);
    };
    window.addEventListener(GRUP_CHANGE_EVENT, onGrup);
    return () => window.removeEventListener(GRUP_CHANGE_EVENT, onGrup);
  }, [opcions]);

  useEffect(() => {
    const altres = opcions.filter((g) => g !== local);
    const run = () => {
      for (const g of altres) {
        void prefetchGrupIniciAction(g).catch(() => {});
      }
    };
    const ric = window.requestIdleCallback?.bind(window);
    if (ric) {
      const id = ric(run, { timeout: 2500 });
      return () => window.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(run, 400);
    return () => window.clearTimeout(t);
  }, [local, opcions]);

  if (opcions.length <= 1) {
    const only = opcions[0] ?? local;
    return (
      <div className={styles.wrap}>
        <span className={styles.label}>Empresa</span>
        <span className={styles.select} style={{ display: "inline-flex", alignItems: "center" }}>
          {GRUP_EMPRESA_LABELS[only]}
        </span>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <label className={styles.label} htmlFor="global-grup-empresa">
        Empresa
      </label>
      <select
        id="global-grup-empresa"
        className={styles.select}
        value={local}
        disabled={isPending}
        aria-busy={isPending}
        onChange={(e) => {
          const next = e.target.value as GrupEmpresa;
          if (next === local) return;
          if (!opcions.includes(next)) return;
          setLocal(next);
          setGrupEmpresaClient(next);
          startTransition(() => {
            if (pathname === "/") {
              router.refresh();
            } else {
              router.push("/");
            }
          });
        }}
      >
        {opcions.map((val) => (
          <option key={val} value={val}>
            {GRUP_EMPRESA_LABELS[val]}
          </option>
        ))}
      </select>
    </div>
  );
}
