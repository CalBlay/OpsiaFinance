"use client";

import styles from "@/components/consultes/report.module.css";
import { useRouter } from "next/navigation";

interface LnOpt {
  id: string;
  codi: string;
  nom: string;
}

export function EvolucioSelectors({
  linies,
  anys,
  scope,
  lnId,
  any,
}: {
  linies: LnOpt[];
  anys: number[];
  scope: "empresa" | "linia";
  lnId: string | null;
  any: number;
}) {
  const router = useRouter();
  const scopeSelectId = "evolucio-scope";
  const lineSelectId = "evolucio-line";
  const yearSelectId = "evolucio-year";

  const go = (nextScope: string, nextLn: string, nextAny: number) => {
    if (nextScope === "linia" && !nextLn) {
      router.push(`/consultes/evolucio?scope=linia&any=${nextAny}`);
      return;
    }
    const lnPart = nextScope === "linia" ? `&ln=${nextLn}` : "";
    router.push(`/consultes/evolucio?scope=${nextScope}${lnPart}&any=${nextAny}`);
  };

  return (
    <div className={styles.selectors}>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={scopeSelectId}>
          Àmbit
        </label>
        <select
          id={scopeSelectId}
          className={styles.select}
          value={scope}
          onChange={(e) => go(e.target.value, lnId ?? "", any)}
        >
          <option value="empresa">Empresa (Cal Blay)</option>
          <option value="linia">Una línia de negoci</option>
        </select>
      </div>

      {scope === "linia" && (
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={lineSelectId}>
            Línia de negoci
          </label>
          <select
            id={lineSelectId}
            className={styles.select}
            value={lnId ?? ""}
            onChange={(e) => go("linia", e.target.value, any)}
          >
            <option value="">Selecciona…</option>
            {linies.map((ln) => (
              <option key={ln.id} value={ln.id}>
                {ln.codi} · {ln.nom}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={yearSelectId}>
          Any
        </label>
        <select
          id={yearSelectId}
          className={styles.select}
          style={{ minWidth: 100 }}
          value={any}
          onChange={(e) => go(scope, lnId ?? "", Number(e.target.value))}
        >
          {anys.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
