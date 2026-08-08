"use client";

import { GRUP_CHANGE_EVENT, setGrupEmpresaClient } from "@/lib/grup-cookie-client";
import { prefetchGrupIniciAction } from "@/lib/grup-prefetch";
import { GRUP_EMPRESA_LABELS, GRUP_EMPRESA_OPCIONS, type GrupEmpresa } from "@/lib/grups-empresa";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import styles from "./GrupEmpresaSelector.module.css";

export function GrupEmpresaSelector({ value }: { value: GrupEmpresa }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [local, setLocal] = useState<GrupEmpresa>(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => {
    const onGrup = (e: Event) => {
      const detail = (e as CustomEvent<GrupEmpresa>).detail;
      if (detail) setLocal(detail);
    };
    window.addEventListener(GRUP_CHANGE_EVENT, onGrup);
    return () => window.removeEventListener(GRUP_CHANGE_EVENT, onGrup);
  }, []);

  // Escalfa Cal Blay / FDLC / Consolidat en idle perquè el canvi sigui ràpid.
  useEffect(() => {
    const altres = GRUP_EMPRESA_OPCIONS.filter((g) => g !== value);
    const run = () => {
      for (const g of altres) {
        void prefetchGrupIniciAction(g).catch(() => {});
      }
    };
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = window.requestIdleCallback(run, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(run, 400);
    return () => window.clearTimeout(t);
  }, [value]);

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
          setLocal(next);
          setGrupEmpresaClient(next);
          startTransition(() => {
            // Sempre Inici amb KPIs de l'últim mes d'aquell àmbit.
            if (pathname === "/") {
              router.refresh();
            } else {
              router.push("/");
            }
          });
        }}
      >
        {GRUP_EMPRESA_OPCIONS.map((val) => (
          <option key={val} value={val}>
            {GRUP_EMPRESA_LABELS[val]}
          </option>
        ))}
      </select>
    </div>
  );
}
