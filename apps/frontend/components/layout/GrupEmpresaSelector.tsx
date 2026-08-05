"use client";

import { serializeGrupCookie } from "@/lib/grup-cookie-client";
import { GRUP_EMPRESA_LABELS, GRUP_EMPRESA_OPCIONS, type GrupEmpresa } from "@/lib/grups-empresa";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import styles from "./GrupEmpresaSelector.module.css";

export function GrupEmpresaSelector({ value }: { value: GrupEmpresa }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  return (
    <div className={styles.wrap}>
      <label className={styles.label} htmlFor="global-grup-empresa">
        Empresa
      </label>
      <select
        id="global-grup-empresa"
        className={styles.select}
        value={value}
        disabled={isPending}
        aria-busy={isPending}
        onChange={(e) => {
          const next = e.target.value as GrupEmpresa;
          document.cookie = serializeGrupCookie(next);
          startTransition(() => {
            // En canviar d'empresa: Inici amb KPIs de l'últim mes d'aquell àmbit.
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
