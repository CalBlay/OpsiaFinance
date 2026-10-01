import { ConsultaHeader } from "@/components/consultes/ConsultaHeader";
import { getArbreSeleccio } from "@/lib/consultes";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { liniesPerConsultaDetall } from "@/lib/grups-empresa";
import { getAnysRrhh, getInformeRrhhDepartaments } from "@/lib/rrhh/consultes";
import { RrhhKpis, RrhhTaulaInforme } from "../RrhhPresentacio";
import { RrhhSelectors } from "../RrhhSelectors";
import styles from "../rrhh.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "RRHH — Per departament — OpsiaFinance" };

export default async function RrhhDepartamentPage({
  searchParams,
}: {
  searchParams: Promise<{ any?: string; mes?: string; ln?: string; centre?: string }>;
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

  let lnId = sp.ln && arbre.some((l) => l.id === sp.ln) ? sp.ln : null;
  let centreId = sp.centre ?? null;
  if (centreId && !lnId) {
    for (const ln of arbre) {
      if (ln.centres.some((c) => c.id === centreId)) {
        lnId = ln.id;
        break;
      }
    }
  }
  if (centreId && lnId) {
    const ln = arbre.find((l) => l.id === lnId);
    if (ln && !ln.centres.some((c) => c.id === centreId)) centreId = null;
  }

  const informe = await getInformeRrhhDepartaments(any, mes, {
    liniaNegociId: lnId,
    centreId,
  });
  const esMitjana = mes == null;

  return (
    <div className={styles.page}>
      <ConsultaHeader
        title="RRHH · Per departament"
        subtitle={
          <>Persones i hores/setmana per departament (Dimensions). {informe.periodeLabel}.</>
        }
        actions={
          <RrhhSelectors
            basePath="/rrhh/departament"
            anys={anys}
            any={any}
            mes={mes}
            lnId={lnId}
            centreId={centreId}
            arbre={arbre}
            showLn
            showCentre
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
