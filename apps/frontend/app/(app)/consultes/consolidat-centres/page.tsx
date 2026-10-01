import { auth } from "@/lib/auth";
import { filtrarArbrePerScope, resolveConsultaScope } from "@/lib/consulta-scope";
import {
  getAnysAmbDades,
  getArbreSeleccio,
  getCompteExplotacioCentresConsolidat,
  getCompteExplotacioCentresConsolidatParell,
  normalitzaCentreIds,
} from "@/lib/consultes";
import { slimConceptsForPaint } from "@/lib/consultes-slim";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { liniesPerConsultaDetall } from "@/lib/grups-empresa";
import { parseNavExtra } from "@/lib/nav-catalog";
import {
  parseVistaComptePerRol,
  vistaInclouTraspassos,
  vistesComptePerUsuari,
} from "@/lib/vista-compte";
import { ConsolidatCentresBoard } from "./ConsolidatCentresBoard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consolidat centres — OpsiaFinance" };

export default async function ConsolidatCentresPage({
  searchParams,
}: {
  searchParams: Promise<{ centres?: string; any?: string; vista?: string }>;
}) {
  const sp = await searchParams;
  const [session, arbreRaw, anys, grup] = await Promise.all([
    auth(),
    getArbreSeleccio(),
    getAnysAmbDades(),
    getGrupEmpresaActual(),
  ]);

  const anyActual = sp.any ? Number(sp.any) : (anys[0] ?? new Date().getFullYear());
  const role = session?.user?.role;
  const navExtra = parseNavExtra(session?.user?.navExtra);
  const vista = parseVistaComptePerRol(sp.vista, role, { navExtra });
  const vistesPermeses = vistesComptePerUsuari(role, navExtra);
  const scope = resolveConsultaScope({
    role: session?.user?.role,
    navExtra,
    arbre: arbreRaw,
  });
  const arbre = filtrarArbrePerScope(liniesPerConsultaDetall(arbreRaw, grup), scope);

  const permesos = new Set(arbre.flatMap((ln) => ln.centres.map((c) => c.id)));
  const centreIds = normalitzaCentreIds((sp.centres ?? "").split(",")).filter((id) =>
    permesos.has(id)
  );

  const parell = centreIds.length
    ? vistaInclouTraspassos(vista)
      ? await getCompteExplotacioCentresConsolidatParell(centreIds, anyActual)
      : {
          sap:
            vista === "sap"
              ? await getCompteExplotacioCentresConsolidat(centreIds, anyActual, "sap")
              : null,
          ajustos:
            vista === "ajustos"
              ? await getCompteExplotacioCentresConsolidat(centreIds, anyActual, "ajustos")
              : null,
          directe:
            vista === "sap" || vista === "ajustos"
              ? null
              : await getCompteExplotacioCentresConsolidat(centreIds, anyActual, "directe"),
          traspassos: null,
          gestio: null,
        }
    : null;

  return (
    <ConsolidatCentresBoard
      arbre={arbre}
      anys={anys.length ? anys : [anyActual]}
      centreIds={centreIds}
      anyActual={anyActual}
      vistaInicial={vista}
      vistesOpcions={vistesPermeses}
      potCarregarCapes={centreIds.length > 0 && !vistaInclouTraspassos(vista)}
      capesInicials={{
        ...(parell?.sap
          ? { sap: { ...parell.sap, concepts: slimConceptsForPaint(parell.sap.concepts) } }
          : {}),
        ...(parell?.ajustos
          ? {
              ajustos: {
                ...parell.ajustos,
                concepts: slimConceptsForPaint(parell.ajustos.concepts),
              },
            }
          : {}),
        ...(parell?.directe
          ? {
              directe: {
                ...parell.directe,
                concepts: slimConceptsForPaint(parell.directe.concepts),
              },
            }
          : {}),
        ...(parell?.traspassos
          ? {
              traspassos: {
                ...parell.traspassos,
                concepts: slimConceptsForPaint(parell.traspassos.concepts),
              },
            }
          : {}),
        ...(parell?.gestio
          ? {
              gestio: {
                ...parell.gestio,
                concepts: slimConceptsForPaint(parell.gestio.concepts),
              },
            }
          : {}),
      }}
    />
  );
}
