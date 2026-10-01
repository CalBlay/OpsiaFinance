import { ConsultaHeader } from "@/components/consultes/ConsultaHeader";
import report from "@/components/consultes/report.module.css";
import { getArbreSeleccio } from "@/lib/consultes";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { liniesPerConsultaDetall } from "@/lib/grups-empresa";
import {
  getAnysRrhh,
  getEvolucioMensualRrhh,
  getInformeRrhhDepartaments,
} from "@/lib/rrhh/consultes";
import { RrhhBoard } from "../RrhhPresentacio";
import { RrhhSelectors } from "../RrhhSelectors";

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

  const ln = lnId ? arbre.find((l) => l.id === lnId) : null;
  const centre = centreId ? arbre.flatMap((l) => l.centres).find((c) => c.id === centreId) : null;

  const [informe, evolucio] = await Promise.all([
    getInformeRrhhDepartaments(any, mes, { liniaNegociId: lnId, centreId }),
    mes == null
      ? getEvolucioMensualRrhh(any, { liniaNegociId: lnId, centreId })
      : Promise.resolve([]),
  ]);

  return (
    <div className={report.page}>
      <ConsultaHeader
        title="RRHH · Per departament"
        subtitle="Dimensió 3: persones, hores i composició de jornades per departament."
        meta={
          <span>
            {ln ? `${ln.codi} · ${ln.nom}` : "Totes les LN"}
            {centre ? ` → ${centre.codi} · ${centre.nom}` : ""}
          </span>
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
      <RrhhBoard
        titol={
          centre ? `${centre.codi} · ${centre.nom}` : ln ? `${ln.codi} · ${ln.nom}` : "Empresa"
        }
        periodeLabel={informe.periodeLabel}
        nivellLabel="Per departament"
        informe={informe}
        evolucio={evolucio}
        esMitjana={mes == null}
      />
    </div>
  );
}
