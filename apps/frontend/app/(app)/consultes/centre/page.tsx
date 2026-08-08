import { auth } from "@/lib/auth";
import {
  getAnysAmbDades,
  getArbreSeleccio,
  getCompteExplotacioCentreParell,
} from "@/lib/consultes";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { exclouFdlcDeConsultaLinia, grupMostraConsultesLiniaCentre } from "@/lib/grups-empresa";
import { redirect } from "next/navigation";
import { CentreBoard } from "./CentreBoard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consulta per centre — OpsiaFinance" };

export default async function ConsultaCentrePage({
  searchParams,
}: {
  searchParams: Promise<{ centre?: string; any?: string; ln?: string; vista?: string }>;
}) {
  const sp = await searchParams;
  const [session, arbre, anys, grup] = await Promise.all([
    auth(),
    getArbreSeleccio(),
    getAnysAmbDades(),
    getGrupEmpresaActual(),
  ]);

  const anyActual = sp.any ? Number(sp.any) : (anys[0] ?? new Date().getFullYear());
  if (!grupMostraConsultesLiniaCentre(grup)) {
    redirect(`/consultes/empresa?any=${anyActual}`);
  }
  const vista = sp.vista === "gestio" ? "gestio" : "directe";
  let lnId = sp.ln ?? null;
  let centreId = sp.centre ?? null;

  if (centreId && !lnId) {
    for (const ln of arbre) {
      if (ln.centres.some((c) => c.id === centreId)) {
        lnId = ln.id;
        break;
      }
    }
  }

  const arbreCalBlay = exclouFdlcDeConsultaLinia(arbre);

  if (lnId) {
    const lnSeleccionada = arbre.find((l) => l.id === lnId);
    if (lnSeleccionada && !arbreCalBlay.some((l) => l.id === lnId)) {
      lnId = null;
      centreId = null;
    }
  }

  if (centreId && lnId) {
    const ln = arbreCalBlay.find((l) => l.id === lnId);
    if (ln && !ln.centres.some((c) => c.id === centreId)) centreId = null;
  }

  const parell = centreId ? await getCompteExplotacioCentreParell(centreId, anyActual) : null;

  return (
    <CentreBoard
      arbre={arbreCalBlay}
      anys={anys.length ? anys : [anyActual]}
      lnId={lnId}
      centreId={centreId}
      anyActual={anyActual}
      vistaInicial={vista}
      isAdmin={session?.user?.role === "ADMIN"}
      directe={parell?.directe ?? null}
      gestio={parell?.gestio ?? null}
    />
  );
}
