import { auth } from "@/lib/auth";
import {
  type VistaCompte,
  esAnyComplet,
  getAnysAmbDades,
  getComparativaEmpresaParell,
  getEvolucioMensual,
  parseRangMesosFromSearchParams,
} from "@/lib/consultes";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { grupPermetVistaGestio } from "@/lib/grups-empresa";
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
  const vista: VistaCompte =
    grupPermetVistaGestio(grup) && sp.vista === "gestio" ? "gestio" : "directe";
  const acumulatAnual = esAnyComplet(rang);
  const esPresentacioCalblay = grup === "calblay";
  const isAdmin = session?.user?.role === "ADMIN";
  const potGestio = grupPermetVistaGestio(grup);

  const [parell, evFdlc, evEmpresaRaw, infoGestio] = await Promise.all([
    getComparativaEmpresaParell(anyActual, rang, grup),
    grup === "fdlc" && acumulatAnual
      ? getEvolucioMensual("empresa", null, anyActual, "fdlc")
      : Promise.resolve(null),
    esPresentacioCalblay ? getEvolucioMensual("empresa", null, anyActual) : Promise.resolve(null),
    potGestio ? getInfoGestioConsulta(anyActual, rang) : Promise.resolve(null),
  ]);

  const evEmpresaDirecte = evEmpresaRaw;
  let evEmpresaGestio = evEmpresaRaw;
  if (evEmpresaRaw && potGestio) {
    evEmpresaGestio = {
      ...evEmpresaRaw,
      concepts: await aplicarVistaGestioEvolucioEmpresa(anyActual, evEmpresaRaw.concepts),
    };
  }

  const directe = buildEmpresaVistaData({
    vista: "directe",
    grup,
    anyActual,
    rang,
    isAdmin,
    comp: parell.directe,
    evFdlc,
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
          evFdlc,
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
    />
  );
}
