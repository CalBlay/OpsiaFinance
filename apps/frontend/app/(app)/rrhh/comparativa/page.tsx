import { ConsultaHeader } from "@/components/consultes/ConsultaHeader";
import report from "@/components/consultes/report.module.css";
import { getArbreSeleccio } from "@/lib/consultes";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { liniesPerConsultaDetall } from "@/lib/grups-empresa";
import { getAnysRrhh, getComparativaRrhh } from "@/lib/rrhh/consultes";
import { RrhhComparativaBoard } from "../RrhhPresentacio";
import { RrhhComparativaSelectors } from "./RrhhComparativaSelectors";

export const dynamic = "force-dynamic";
export const metadata = { title: "RRHH — Comparativa — OpsiaFinance" };

export default async function RrhhComparativaPage({
  searchParams,
}: {
  searchParams: Promise<{
    anyA?: string;
    mesA?: string;
    anyB?: string;
    mesB?: string;
    nivell?: string;
    ln?: string;
  }>;
}) {
  const sp = await searchParams;
  const [anysRrhh, arbreRaw, grup] = await Promise.all([
    getAnysRrhh(),
    getArbreSeleccio(),
    getGrupEmpresaActual(),
  ]);
  const arbre = liniesPerConsultaDetall(arbreRaw, grup);
  const anyCal = new Date().getFullYear();
  const baseAny = anysRrhh.includes(anyCal) ? anyCal : (anysRrhh[0] ?? anyCal);
  const anys = anysRrhh.length ? anysRrhh : [baseAny];

  const anyA = sp.anyA ? Number(sp.anyA) : baseAny;
  const mesA = sp.mesA ? Number(sp.mesA) : null;
  const anyB = sp.anyB ? Number(sp.anyB) : baseAny;
  const mesB = sp.mesB ? Number(sp.mesB) : mesA != null ? mesA : new Date().getMonth() + 1;
  const nivellRaw = sp.nivell;
  const nivell = nivellRaw === "centre" || nivellRaw === "departament" ? nivellRaw : "linia";
  const lnId = sp.ln && arbre.some((l) => l.id === sp.ln) ? sp.ln : null;

  const data = await getComparativaRrhh(
    { any: anyA, mes: mesA },
    { any: anyB, mes: mesB },
    nivell,
    { liniaNegociId: lnId }
  );

  return (
    <div className={report.page}>
      <ConsultaHeader
        title="RRHH · Comparativa"
        subtitle="Anàlisi A→B de plantilla i hores per al comitè de direcció."
        actions={
          <RrhhComparativaSelectors
            anys={anys}
            anyA={anyA}
            mesA={mesA}
            anyB={anyB}
            mesB={mesB}
            nivell={nivell}
            lnId={lnId}
            arbre={arbre}
          />
        }
      />
      <RrhhComparativaBoard data={data} />
    </div>
  );
}
