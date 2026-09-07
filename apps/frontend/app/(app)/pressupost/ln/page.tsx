import { ConsultaHeader } from "@/components/consultes/ConsultaHeader";
import styles from "@/components/consultes/report.module.css";
import { auth } from "@/lib/auth";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { filtraLiniesPerGrup } from "@/lib/grups-empresa";
import { lnSuportaDetallCentres } from "@/lib/pressupost/detall-centres";
import {
  getLiniesNegociPressupost,
  getPressupostLn,
  listAnysPressupost,
} from "@/lib/pressupost/pressupost-ln";
import {
  getCentresPressupostLn,
  getConceptesTipusA,
  getPressupostCelsCentre,
  getReferenciaAnyAnteriorCentre,
  getReferenciaAnyAnteriorTipusA,
  teDetallCentres,
} from "@/lib/pressupost/tipus-a-data";
import { CODI_LN_CENTRAL } from "@/lib/repartiment/nodes";
import { potEditarPressupost } from "@/lib/roles";
import { Suspense } from "react";
import { PressupostLnManager } from "./PressupostLnManager";

export const metadata = { title: "Pressupost per LN — OpsiaFinance" };

type Search = { any?: string; ln?: string; nivell?: string; centre?: string };

async function LnPageContent({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const [liniesAll, conceptes, anysExistents, session, grup] = await Promise.all([
    getLiniesNegociPressupost(),
    getConceptesTipusA(),
    listAnysPressupost(),
    auth(),
    getGrupEmpresaActual(),
  ]);

  const linies = filtraLiniesPerGrup(liniesAll, grup).filter((l) => l.codi !== CODI_LN_CENTRAL);

  const anyNow = new Date().getFullYear();
  const anyParam = sp.any != null && sp.any !== "" ? Number(sp.any) : anyNow;
  const any =
    Number.isInteger(anyParam) && anyParam >= 2000 && anyParam <= 2100 ? anyParam : anyNow;

  const lnFromQuery = sp.ln && linies.some((l) => l.id === sp.ln) ? sp.ln : null;
  const lnId = lnFromQuery ?? linies[0]?.id ?? null;
  const lnMeta = linies.find((l) => l.id === lnId) ?? null;

  const centres =
    lnId && lnMeta && lnSuportaDetallCentres(lnMeta.codi)
      ? await getCentresPressupostLn(lnId, lnMeta.codi)
      : [];

  const volCentre = sp.nivell === "centre" && centres.length > 0;
  const centreId =
    volCentre && sp.centre && centres.some((c) => c.id === sp.centre)
      ? sp.centre
      : volCentre
        ? (centres[0]?.id ?? null)
        : null;
  const nivell = centreId ? ("centre" as const) : ("general" as const);

  const { capcalera, celsGeneral } =
    lnId != null
      ? await getPressupostLn(any, lnId).then((r) => ({
          capcalera: r.capcalera,
          celsGeneral: r.cels,
        }))
      : { capcalera: null, celsGeneral: [] };

  const [cels, ref, teDetall] = await Promise.all([
    capcalera && centreId
      ? getPressupostCelsCentre(capcalera.id, centreId)
      : Promise.resolve(celsGeneral),
    lnId
      ? centreId
        ? getReferenciaAnyAnteriorCentre(any, centreId)
        : getReferenciaAnyAnteriorTipusA(any, lnId)
      : Promise.resolve({
          anyRef: any - 1,
          perNodeMes: {} as Record<number, number[]>,
        }),
    capcalera ? teDetallCentres(capcalera.id) : Promise.resolve(false),
  ]);

  const canEdit = potEditarPressupost(session?.user?.role);

  return (
    <div className={styles.report}>
      <ConsultaHeader
        title="Pressupost per línia de negoci"
        subtitle="Tipus A — totals: vendes, compres, personal, gestió i EBITDA. Restaurants: general o per centre."
      />
      <PressupostLnManager
        anyInicial={any}
        lnIdInicial={lnId}
        linies={linies}
        conceptes={conceptes}
        capcalera={capcalera}
        cels={cels}
        anysExistents={anysExistents}
        canEdit={canEdit}
        anyRef={ref.anyRef}
        refPerNodeMes={ref.perNodeMes}
        centres={centres}
        centreIdInicial={centreId}
        nivellInicial={nivell}
        teDetallCentres={teDetall}
      />
    </div>
  );
}

export default function PressupostLnPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  return (
    <Suspense fallback={<p className={styles.report}>Carregant…</p>}>
      <LnPageContent searchParams={searchParams} />
    </Suspense>
  );
}
