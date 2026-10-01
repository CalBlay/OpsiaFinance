import { ConsultaHeader } from "@/components/consultes/ConsultaHeader";
import { getArbreSeleccio } from "@/lib/consultes";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { liniesPerConsultaDetall } from "@/lib/grups-empresa";
import { getAnysRrhh, getInformeRrhhCentres } from "@/lib/rrhh/consultes";
import { RrhhKpis, RrhhTaulaInforme } from "../RrhhPresentacio";
import { RrhhSelectors } from "../RrhhSelectors";
import styles from "../rrhh.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "RRHH — Per centre — OpsiaFinance" };

export default async function RrhhCentrePage({
  searchParams,
}: {
  searchParams: Promise<{ any?: string; mes?: string; ln?: string }>;
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
  const lnId = sp.ln && arbre.some((l) => l.id === sp.ln) ? sp.ln : null;
  const informe = await getInformeRrhhCentres(any, mes, lnId);
  const esMitjana = mes == null;

  return (
    <div className={styles.page}>
      <ConsultaHeader
        title="RRHH · Per centre"
        subtitle={<>Caps i hores/setmana per centre. {informe.periodeLabel}.</>}
        actions={
          <RrhhSelectors
            basePath="/rrhh/centre"
            anys={anys}
            any={any}
            mes={mes}
            lnId={lnId}
            arbre={arbre}
            showLn
          />
        }
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
