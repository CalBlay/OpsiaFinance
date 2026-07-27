"use client";

import styles from "@/components/consultes/report.module.css";
import type { VistaCompte } from "@/lib/consultes";
import { MESOS_LLARGS } from "@/lib/periodes";
import { useRouter } from "next/navigation";

interface LnOpt {
  id: string;
  codi: string;
  nom: string;
}

export function LiniaSelectors({
  linies,
  anys,
  lnId,
  any,
  mes,
  vista,
}: {
  linies: LnOpt[];
  anys: number[];
  lnId: string | null;
  any: number;
  mes: number | null;
  vista: VistaCompte;
}) {
  const router = useRouter();

  const go = (nextLn: string, nextAny: number, nextMes: number | null, nextVista: VistaCompte) => {
    if (!nextLn) return;
    const mesPart = nextMes ? `&mes=${nextMes}` : "";
    router.push(`/consultes/linia?ln=${nextLn}&any=${nextAny}${mesPart}&vista=${nextVista}`);
  };

  return (
    <div className={styles.selectors}>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Línia de negoci</label>
        <select
          className={styles.select}
          value={lnId ?? ""}
          onChange={(e) => go(e.target.value, any, mes, vista)}
        >
          <option value="" disabled>
            Selecciona una línia…
          </option>
          {linies.map((ln) => (
            <option key={ln.id} value={ln.id}>
              {ln.codi} · {ln.nom}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Any</label>
        <select
          className={styles.select}
          style={{ minWidth: 100 }}
          value={any}
          onChange={(e) => go(lnId ?? "", Number(e.target.value), mes, vista)}
        >
          {anys.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Període</label>
        <select
          className={styles.select}
          style={{ minWidth: 140 }}
          value={mes ?? ""}
          onChange={(e) =>
            go(lnId ?? "", any, e.target.value ? Number(e.target.value) : null, vista)
          }
        >
          <option value="">Acumulat anual</option>
          {MESOS_LLARGS.map((m, i) => (
            <option key={i} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Vista</label>
        <select
          className={styles.select}
          style={{ minWidth: 160 }}
          value={vista}
          onChange={(e) => go(lnId ?? "", any, mes, e.target.value as VistaCompte)}
        >
          <option value="directe">Directe (SAP)</option>
          <option value="gestio">Gestió (tractat)</option>
        </select>
      </div>
    </div>
  );
}
