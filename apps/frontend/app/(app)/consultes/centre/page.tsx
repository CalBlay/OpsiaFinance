import { auth } from "@/lib/auth";
import {
  getAnysAmbDades,
  getArbreSeleccio,
  getCompteExplotacioCentre,
  getCompteExplotacioCentreParell,
} from "@/lib/consultes";
import { slimConceptsForPaint } from "@/lib/consultes-slim";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { liniesPerConsultaDetall } from "@/lib/grups-empresa";
import { CentreBoard } from "./CentreBoard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consulta per centre — OpsiaFinance" };

export default async function ConsultaCentrePage({
  searchParams,
}: {
  searchParams: Promise<{ centre?: string; any?: string; ln?: string; vista?: string }>;
}) {
  const sp = await searchParams;
  const [session, arbreRaw, anys, grup] = await Promise.all([
    auth(),
    getArbreSeleccio(),
    getAnysAmbDades(),
    getGrupEmpresaActual(),
  ]);

  const anyActual = sp.any ? Number(sp.any) : (anys[0] ?? new Date().getFullYear());
  const vista = sp.vista === "gestio" ? "gestio" : "directe";
  const arbre = liniesPerConsultaDetall(arbreRaw, grup);
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

  if (lnId && !arbre.some((l) => l.id === lnId)) {
    lnId = null;
    centreId = null;
  }

  if (centreId && lnId) {
    const ln = arbre.find((l) => l.id === lnId);
    if (ln && !ln.centres.some((c) => c.id === centreId)) centreId = null;
  }

  // Directe primer; Gestió només eager si ja s'ha demanat a la URL.
  const parell = centreId
    ? vista === "gestio"
      ? await getCompteExplotacioCentreParell(centreId, anyActual)
      : {
          directe: await getCompteExplotacioCentre(centreId, anyActual, "directe"),
          gestio: null,
        }
    : null;

  return (
    <CentreBoard
      arbre={arbre}
      anys={anys.length ? anys : [anyActual]}
      lnId={lnId}
      centreId={centreId}
      anyActual={anyActual}
      vistaInicial={vista}
      isAdmin={session?.user?.role === "ADMIN"}
      directe={
        parell?.directe
          ? { ...parell.directe, concepts: slimConceptsForPaint(parell.directe.concepts) }
          : null
      }
      gestio={
        parell?.gestio
          ? { ...parell.gestio, concepts: slimConceptsForPaint(parell.gestio.concepts) }
          : null
      }
      potCarregarGestio={!!centreId && vista === "directe"}
    />
  );
}
