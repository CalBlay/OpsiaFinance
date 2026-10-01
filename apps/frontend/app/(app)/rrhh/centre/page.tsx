import { ConsultaHeader } from "@/components/consultes/ConsultaHeader";
import report from "@/components/consultes/report.module.css";
import { getArbreSeleccio } from "@/lib/consultes";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { liniesPerConsultaDetall } from "@/lib/grups-empresa";
import { getAnysRrhh, getEvolucioMensualRrhh, getInformeRrhhCentres } from "@/lib/rrhh/consultes";
import { RrhhBoard } from "../RrhhPresentacio";
import { RrhhSelectors } from "../RrhhSelectors";

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
  const ln = lnId ? arbre.find((l) => l.id === lnId) : null;

  const [informe, evolucio] = await Promise.all([
    getInformeRrhhCentres(any, mes, lnId),
    mes == null ? getEvolucioMensualRrhh(any, { liniaNegociId: lnId }) : Promise.resolve([]),
  ]);

  return (
    <div className={report.page}>
      <ConsultaHeader
        title="RRHH · Per centre"
        subtitle="Concentració de plantilla i hores per centre de cost."
        meta={
          ln ? (
            <span>
              {ln.codi} · {ln.nom}
            </span>
          ) : null
        }
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
      <RrhhBoard
        titol={ln ? `${ln.codi} · ${ln.nom}` : "Totes les línies"}
        periodeLabel={informe.periodeLabel}
        nivellLabel="Per centre"
        informe={informe}
        evolucio={evolucio}
        esMitjana={mes == null}
        hrefByKey={Object.fromEntries(
          informe.files.map((f) => {
            const p = new URLSearchParams();
            p.set("any", String(any));
            if (mes != null) p.set("mes", String(mes));
            if (lnId) p.set("ln", lnId);
            p.set("centre", f.key);
            return [f.key, `/rrhh/departament?${p}`] as const;
          })
        )}
      />
    </div>
  );
}
