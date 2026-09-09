import { ConsultaHeader } from "@/components/consultes/ConsultaHeader";
import styles from "@/components/consultes/report.module.css";
import { auth } from "@/lib/auth";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { MESOS_LLARGS } from "@/lib/periodes";
import { esPressupostDeptOnly } from "@/lib/pressupost/access";
import { listAnysPressupost } from "@/lib/pressupost/pressupost-ln";
import {
  getSeguimentVendesCentre,
  getSeguimentVendesLn,
  listCentresSeguimentLn,
} from "@/lib/pressupost/seguiment-vendes-ln";
import { potVeurePressupostGlobal } from "@/lib/roles";
import type { UserRole } from "@/types";
import { redirect } from "next/navigation";
import { type NivellLn, SeguimentPresentacio, type VistaSeguiment } from "./SeguimentPresentacio";

export const metadata = { title: "Seguiment vendes LN — OpsiaFinance" };

type Search = {
  any?: string;
  mes?: string;
  ln?: string;
  vista?: string;
  nivell?: string;
  centre?: string;
};

export default async function PressupostSeguimentPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const session = await auth();
  const role = (session?.user?.role ?? "CONSULTA") as UserRole;

  if (esPressupostDeptOnly(role) || !potVeurePressupostGlobal(role)) {
    redirect("/pressupost/departaments");
  }

  const sp = await searchParams;
  const [anysExistents, grup] = await Promise.all([listAnysPressupost(), getGrupEmpresaActual()]);

  const anyNow = new Date().getFullYear();
  const mesNow = new Date().getMonth() + 1;
  const anys = [...new Set([anyNow, anyNow - 1, ...anysExistents])]
    .filter((a) => a >= 2000 && a <= 2100)
    .sort((a, b) => b - a);

  const anyParam = sp.any != null && sp.any !== "" ? Number(sp.any) : anyNow;
  const any =
    Number.isInteger(anyParam) && anyParam >= 2000 && anyParam <= 2100 ? anyParam : anyNow;

  const mesParam = sp.mes != null && sp.mes !== "" ? Number(sp.mes) : any === anyNow ? mesNow : 1;
  const mes = Number.isInteger(mesParam) && mesParam >= 1 && mesParam <= 12 ? mesParam : mesNow;

  const vista: VistaSeguiment = sp.vista === "ln" ? "ln" : "mes";
  const data = await getSeguimentVendesLn({ any, grup, mesFins: 12 });
  const lnId =
    sp.ln && data.files.some((f) => f.liniaNegociId === sp.ln)
      ? sp.ln
      : (data.files[0]?.liniaNegociId ?? null);

  const lnMeta = data.files.find((f) => f.liniaNegociId === lnId) ?? null;
  const centres =
    vista === "ln" && lnMeta ? await listCentresSeguimentLn(lnMeta.liniaNegociId, lnMeta.codi) : [];

  const nivell: NivellLn = sp.nivell === "centre" && centres.length > 0 ? "centre" : "general";
  const centreId =
    nivell === "centre"
      ? sp.centre && centres.some((c) => c.id === sp.centre)
        ? sp.centre
        : (centres[0]?.id ?? null)
      : null;

  const seguimentCentre =
    vista === "ln" && nivell === "centre" && lnId && centreId
      ? await getSeguimentVendesCentre({ any, liniaNegociId: lnId, centreId })
      : null;

  const centreMeta = centres.find((c) => c.id === centreId);

  const subtitle =
    vista === "mes"
      ? `Desviació del mes — ${MESOS_LLARGS[mes - 1]} ${any}.`
      : nivell === "centre" && centreMeta
        ? `Desviació per mesos — ${centreMeta.codi} ${centreMeta.nom} (${any}).`
        : `Desviació per mesos — ${lnMeta ? `${lnMeta.codi} ${lnMeta.nom}` : "LN"} (${any}).`;

  return (
    <div className={styles.report}>
      <ConsultaHeader title="Seguiment vendes per LN" subtitle={subtitle} />
      <SeguimentPresentacio
        data={data}
        anys={anys}
        mes={mes}
        lnId={lnId}
        vista={vista}
        nivell={nivell}
        centres={centres}
        centreId={centreId}
        seguimentCentre={seguimentCentre}
      />
    </div>
  );
}
