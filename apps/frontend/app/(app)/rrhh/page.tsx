import { ConsultaHeader } from "@/components/consultes/ConsultaHeader";
import { getArbreSeleccio } from "@/lib/consultes";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { liniesPerConsultaDetall } from "@/lib/grups-empresa";
import { getAnysRrhh, getInformeRrhhLinies } from "@/lib/rrhh/consultes";
import { RrhhKpis, RrhhTaulaInforme } from "./RrhhPresentacio";
import { RrhhSelectors } from "./RrhhSelectors";
import styles from "./rrhh.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "RRHH — Resum — OpsiaFinance" };

export default async function RrhhResumPage({
  searchParams,
}: {
  searchParams: Promise<{ any?: string; mes?: string }>;
}) {
  const sp = await searchParams;
  const [anysRrhh, arbreRaw, grup] = await Promise.all([
    getAnysRrhh(),
    getArbreSeleccio(),
    getGrupEmpresaActual(),
  ]);
  const arbre = liniesPerConsultaDetall(arbreRaw, grup);
  const anyCal = new Date().getFullYear();
  const any = sp.any
    ? Number(sp.any)
    : anysRrhh.includes(anyCal)
      ? anyCal
      : (anysRrhh[0] ?? anyCal);
  const anys = anysRrhh.length ? anysRrhh : [any];
  const mes = sp.mes ? Number(sp.mes) : null;
  const informe = await getInformeRrhhLinies(any, mes);
  const esMitjana = mes == null;

  return (
    <div className={styles.page}>
      <ConsultaHeader
        title="RRHH · Resum per línia"
        subtitle={
          <>
            Persones i hores setmanals contractades (font: Dades → Jornada). {informe.periodeLabel}.
          </>
        }
        actions={<RrhhSelectors basePath="/rrhh" anys={anys} any={any} mes={mes} arbre={arbre} />}
      />

      <RrhhKpis
        persones={informe.totals.nombrePersones}
        hores={informe.totals.horesSetmanals}
        esMitjana={esMitjana}
      />
      <RrhhTaulaInforme informe={informe} esMitjana={esMitjana} />
    </div>
  );
}
