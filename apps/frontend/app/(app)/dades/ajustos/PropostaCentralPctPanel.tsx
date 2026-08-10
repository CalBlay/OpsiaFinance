import type { PropostaAjustCentralPctGrup } from "@/lib/ajustos/proposta-central-pct-grup";
import { formatNum } from "@/lib/utils";
import styles from "./page.module.css";

export function PropostaCentralPctPanel({ calc }: { calc: PropostaAjustCentralPctGrup }) {
  return (
    <div className={styles.calcPanel}>
      <div className={styles.calcTitle}>
        Proposta manual · LN00000 · {calc.any} · Març–Juliol · {calc.percentTxt}% s/ ingressos (Cal
        Blay)
      </div>
      <p className={styles.calcIntro}>
        Mateixa lògica que el KPI de Resultats:{" "}
        <strong>objectiu = −{calc.percentTxt}% × ingressos explotació empresa</strong>, després{" "}
        <strong>Δ = objectiu − TOTAL COMPRES SAP</strong>. Si el % actual &gt; {calc.percentTxt}% →
        Δ positiu (reduir compres a Central). L&apos;ajust va a <strong>COMPRES de LN00000</strong>.
      </p>
      <div className={styles.previewWrap}>
        <table className={styles.previewTable}>
          <thead>
            <tr>
              <th>Mes</th>
              <th className={styles.num}>Ingressos emp.</th>
              <th className={styles.num}>% actual</th>
              <th className={styles.num}>Objectiu {calc.percentTxt}%</th>
              <th className={styles.num}>TOTAL COMPRES SAP</th>
              <th className={styles.num}>Δ a LN00000</th>
            </tr>
          </thead>
          <tbody>
            {calc.files.map((f) => (
              <tr key={f.mes}>
                <td>{f.mesNom}</td>
                <td className={styles.num}>{formatNum(f.baseEmpresa, 2)}</td>
                <td className={styles.num}>
                  {f.pctActual != null ? `${String(f.pctActual).replace(".", ",")}%` : "—"}
                </td>
                <td className={styles.num}>{formatNum(f.objectiuCompres, 2)}</td>
                <td className={styles.num}>{formatNum(f.compresSapEmpresa, 2)}</td>
                <td className={styles.num}>
                  <strong>{formatNum(f.deltaCentral, 2)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.calcFoot}>
        A Ajustos: àmbit LN00000 · concepte COMPRES · un ajust per mes amb l&apos;import Δ · motiu
        tipus «{calc.percentTxt}% s/ ingressos empresa · Mar–Jul».
      </p>
    </div>
  );
}
