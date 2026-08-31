import { RouteLoading } from "@/components/ui/RouteLoading";
import { auth } from "@/lib/auth";
import {
  aplicarConsolidacioInterEvolucioEmpresa,
  getAnysAmbDades,
  getComparativaEmpresa,
  getEvolucioMensual,
  parseRangMesosFromSearchParams,
  restarConceptesPivot,
} from "@/lib/consultes";
import { aplicarBaseGestioPersonalEvolucioEmpresa } from "@/lib/cost-personal-centre/gestio-consultes";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { grupAplicaConsolidacioInter, grupPermetVistaGestio } from "@/lib/grups-empresa";
import { aplicarVistaGestioEvolucioEmpresa } from "@/lib/repartiment/gestio-consultes";
import { getInfoGestioConsulta } from "@/lib/repartiment/service";
import {
  type VistaCompte,
  parseVistaCompte,
  vistaInclouRepartiment,
  vistaInclouTraspassos,
} from "@/lib/vista-compte";
import { Suspense } from "react";
import { EmpresaBoard } from "./EmpresaBoard";
import { buildEmpresaVistaData } from "./empresa-view-model";
import type { EmpresaVistaData } from "./empresa-vista-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Resultats d'empresa — OpsiaFinance" };

async function EmpresaPageContent({
  searchParams,
}: {
  searchParams: Promise<{
    any?: string;
    mes?: string;
    des?: string;
    fins?: string;
    vista?: string;
    grup?: string;
  }>;
}) {
  const sp = await searchParams;
  const [session, grup, anys] = await Promise.all([
    auth(),
    getGrupEmpresaActual(),
    getAnysAmbDades(),
  ]);
  const anyActual = sp.any ? Number(sp.any) : (anys[0] ?? new Date().getFullYear());
  const rang = parseRangMesosFromSearchParams(sp);
  const potGestio = grupPermetVistaGestio(grup);
  const vista = parseVistaCompte(sp.vista, { permetCapesGestio: potGestio });
  const isAdmin = session?.user?.role === "ADMIN";
  const needsSapEv = vista === "sap" || vista === "ajustos";

  const [comp, evEmpresaRaw, evEmpresaSap, infoGestio] = await Promise.all([
    getComparativaEmpresa(anyActual, rang, vista, grup),
    getEvolucioMensual("empresa", null, anyActual, grup, { inclouAjustos: true }),
    needsSapEv
      ? getEvolucioMensual("empresa", null, anyActual, grup, { inclouAjustos: false })
      : Promise.resolve(null),
    vistaInclouRepartiment(vista) ? getInfoGestioConsulta(anyActual, rang) : Promise.resolve(null),
  ]);

  let evEmpresa = evEmpresaRaw;
  if (vista === "ajustos" && evEmpresaSap) {
    evEmpresa = {
      ...evEmpresaRaw,
      concepts: restarConceptesPivot(evEmpresaRaw.concepts, evEmpresaSap.concepts),
    };
  } else if (vista === "sap" && evEmpresaSap) {
    evEmpresa = evEmpresaSap;
  } else if (vistaInclouTraspassos(vista) || vistaInclouRepartiment(vista)) {
    let concepts = evEmpresaRaw.concepts;
    if (vistaInclouTraspassos(vista)) {
      concepts = await aplicarBaseGestioPersonalEvolucioEmpresa(anyActual, concepts);
    }
    if (vistaInclouRepartiment(vista)) {
      concepts = await aplicarVistaGestioEvolucioEmpresa(anyActual, concepts);
      if (grupAplicaConsolidacioInter(grup)) {
        concepts = await aplicarConsolidacioInterEvolucioEmpresa(anyActual, grup, concepts, {
          desMes: rang.des,
          finsMes: rang.fins,
        });
      }
    }
    evEmpresa = { ...evEmpresaRaw, concepts };
  }

  const capes: Partial<Record<VistaCompte, EmpresaVistaData>> = {
    [vista]: buildEmpresaVistaData({
      vista,
      grup,
      anyActual,
      rang,
      isAdmin,
      comp,
      evFdlc: null,
      evEmpresa,
      infoGestio,
    }),
  };

  const scopeKey = `${anyActual}:${rang.des}-${rang.fins}:${grup}:${vista}`;

  return (
    <EmpresaBoard
      key={scopeKey}
      anys={anys.length ? anys : [anyActual]}
      anyActual={anyActual}
      rang={rang}
      grup={grup}
      vistaInicial={vista}
      capesInicials={capes}
    />
  );
}

export default function ConsultaEmpresaPage({
  searchParams,
}: {
  searchParams: Promise<{
    any?: string;
    mes?: string;
    des?: string;
    fins?: string;
    vista?: string;
    grup?: string;
  }>;
}) {
  return (
    <Suspense fallback={<RouteLoading label="Carregant resultats d'empresa…" />}>
      <EmpresaPageContent searchParams={searchParams} />
    </Suspense>
  );
}
