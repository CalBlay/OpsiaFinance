import { auth } from "@/lib/auth";
import {
  type VistaCompte,
  aplicarConsolidacioInterEvolucioEmpresa,
  getAnysAmbDades,
  getComparativaEmpresa,
  getComparativaEmpresaParell,
  getEvolucioMensual,
  parseRangMesosFromSearchParams,
} from "@/lib/consultes";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { grupAplicaConsolidacioInter, grupPermetVistaGestio } from "@/lib/grups-empresa";
import { aplicarVistaGestioEvolucioEmpresa } from "@/lib/repartiment/gestio-consultes";
import { getInfoGestioConsulta } from "@/lib/repartiment/service";
import { EmpresaBoard } from "./EmpresaBoard";
import { buildEmpresaVistaData } from "./empresa-view-model";

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
  const vista: VistaCompte = potGestio && sp.vista === "gestio" ? "gestio" : "directe";
  const isAdmin = session?.user?.role === "ADMIN";
  // Si l'usuari arriba en Directe, no bloquegem el paint amb la capa Gestió.
  const carregaGestioEager = potGestio && vista === "gestio";

  const [parell, evEmpresaRaw, infoGestio] = await Promise.all([
    carregaGestioEager
      ? getComparativaEmpresaParell(anyActual, rang, grup)
      : getComparativaEmpresa(anyActual, rang, "directe", grup).then((directe) => ({
          directe,
          gestio: null,
        })),
    getEvolucioMensual("empresa", null, anyActual, grup),
    carregaGestioEager ? getInfoGestioConsulta(anyActual, rang) : Promise.resolve(null),
  ]);

  const evEmpresaDirecte = evEmpresaRaw;
  let evEmpresaGestio = evEmpresaRaw;
  if (evEmpresaRaw && carregaGestioEager) {
    let conceptsGestio = await aplicarVistaGestioEvolucioEmpresa(anyActual, evEmpresaRaw.concepts);
    if (grupAplicaConsolidacioInter(grup)) {
      conceptsGestio = await aplicarConsolidacioInterEvolucioEmpresa(
        anyActual,
        grup,
        conceptsGestio,
        { desMes: rang.des, finsMes: rang.fins }
      );
    }
    evEmpresaGestio = {
      ...evEmpresaRaw,
      concepts: conceptsGestio,
    };
  }

  const directe = buildEmpresaVistaData({
    vista: "directe",
    grup,
    anyActual,
    rang,
    isAdmin,
    comp: parell.directe,
    evFdlc: null,
    evEmpresa: evEmpresaDirecte,
    infoGestio: null,
  });

  const gestio =
    parell.gestio != null
      ? buildEmpresaVistaData({
          vista: "gestio",
          grup,
          anyActual,
          rang,
          isAdmin,
          comp: parell.gestio,
          evFdlc: null,
          evEmpresa: evEmpresaGestio,
          infoGestio,
        })
      : null;

  return (
    <EmpresaBoard
      anys={anys.length ? anys : [anyActual]}
      anyActual={anyActual}
      rang={rang}
      grup={grup}
      vistaInicial={vista}
      directe={directe}
      gestio={gestio}
      potCarregarGestio={potGestio && gestio == null}
    />
  );
}
