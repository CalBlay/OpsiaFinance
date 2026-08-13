import { auth } from "@/lib/auth";
import {
  type ComparativaEmpresa,
  aplicarConsolidacioInterEvolucioEmpresa,
  getAnysAmbDades,
  getComparativaEmpresa,
  getComparativaEmpresaParell,
  getEvolucioMensual,
  parseRangMesosFromSearchParams,
} from "@/lib/consultes";
import { sensePivotRows } from "@/lib/consultes-slim";
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
import { EmpresaBoard } from "./EmpresaBoard";
import { buildEmpresaVistaData } from "./empresa-view-model";
import type { EmpresaVistaData } from "./empresa-vista-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Resultats d'empresa — OpsiaFinance" };

export default async function ConsultaEmpresaPage({
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
  const carregaCapesEager = potGestio && vistaInclouTraspassos(vista);

  const [evEmpresaRaw, evEmpresaSap, infoGestio] = await Promise.all([
    getEvolucioMensual("empresa", null, anyActual, grup, { inclouAjustos: true }),
    vista === "sap" || carregaCapesEager
      ? getEvolucioMensual("empresa", null, anyActual, grup, { inclouAjustos: false })
      : Promise.resolve(null),
    vistaInclouRepartiment(vista) ? getInfoGestioConsulta(anyActual, rang) : Promise.resolve(null),
  ]);

  async function evPerVista(v: VistaCompte) {
    const base = v === "sap" ? (evEmpresaSap ?? evEmpresaRaw) : evEmpresaRaw;
    if (!base) return null;
    if (!vistaInclouTraspassos(v) && !vistaInclouRepartiment(v)) return base;
    let concepts = base.concepts;
    if (vistaInclouTraspassos(v)) {
      concepts = await aplicarBaseGestioPersonalEvolucioEmpresa(anyActual, concepts);
    }
    if (vistaInclouRepartiment(v)) {
      concepts = await aplicarVistaGestioEvolucioEmpresa(anyActual, concepts);
      if (grupAplicaConsolidacioInter(grup)) {
        concepts = await aplicarConsolidacioInterEvolucioEmpresa(anyActual, grup, concepts, {
          desMes: rang.des,
          finsMes: rang.fins,
        });
      }
    }
    return { ...base, concepts };
  }

  function build(
    v: VistaCompte,
    comp: ComparativaEmpresa,
    ev: Awaited<ReturnType<typeof evPerVista>>,
    info: typeof infoGestio
  ): EmpresaVistaData {
    return sensePivotRows(
      buildEmpresaVistaData({
        vista: v,
        grup,
        anyActual,
        rang,
        isAdmin,
        comp,
        evFdlc: null,
        evEmpresa: ev,
        infoGestio: info,
      })
    );
  }

  const capes: Partial<Record<VistaCompte, EmpresaVistaData>> = {};

  if (carregaCapesEager) {
    const parell = await getComparativaEmpresaParell(anyActual, rang, grup);
    const [evSap, evDirecte, evTraspassos, evGestio] = await Promise.all([
      evPerVista("sap"),
      evPerVista("directe"),
      evPerVista("traspassos"),
      evPerVista("gestio"),
    ]);
    capes.sap = build("sap", parell.sap, evSap, null);
    capes.directe = build("directe", parell.directe, evDirecte, null);
    if (parell.traspassos) {
      capes.traspassos = build("traspassos", parell.traspassos, evTraspassos, null);
    }
    if (parell.gestio) {
      capes.gestio = build("gestio", parell.gestio, evGestio, infoGestio);
    }
  } else {
    const comp = await getComparativaEmpresa(anyActual, rang, vista, grup);
    capes[vista] = build(vista, comp, await evPerVista(vista), infoGestio);
  }

  return (
    <EmpresaBoard
      anys={anys.length ? anys : [anyActual]}
      anyActual={anyActual}
      rang={rang}
      grup={grup}
      vistaInicial={vista}
      capesInicials={capes}
      potCarregarCapes={potGestio && !carregaCapesEager}
    />
  );
}
