import { ConsultaHeader } from "@/components/consultes/ConsultaHeader";
import report from "@/components/consultes/report.module.css";
import { getArbreSeleccio } from "@/lib/consultes";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { liniesPerConsultaDetall } from "@/lib/grups-empresa";
import { getAnysRrhh, getEvolucioMensualRrhh, getInformeRrhhLinies } from "@/lib/rrhh/consultes";
import { RrhhBoard } from "./RrhhPresentacio";
import { RrhhSelectors } from "./RrhhSelectors";

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

  const [informe, evolucio] = await Promise.all([
    getInformeRrhhLinies(any, mes),
    mes == null ? getEvolucioMensualRrhh(any) : Promise.resolve([]),
  ]);

  return (
    <div className={report.page}>
      <ConsultaHeader
        title="RRHH · Resum executiu"
        subtitle="Plantilla i hores contractades per línia de negoci — pack de comitè."
        actions={<RrhhSelectors basePath="/rrhh" anys={anys} any={any} mes={mes} arbre={arbre} />}
      />
      <RrhhBoard
        titol="Empresa"
        periodeLabel={informe.periodeLabel}
        nivellLabel="Per línia de negoci"
        informe={informe}
        evolucio={evolucio}
        esMitjana={mes == null}
        hrefByKey={Object.fromEntries(
          informe.files.map((f) => {
            const p = new URLSearchParams();
            p.set("any", String(any));
            if (mes != null) p.set("mes", String(mes));
            p.set("ln", f.key);
            return [f.key, `/rrhh/centre?${p}`] as const;
          })
        )}
      />
    </div>
  );
}
