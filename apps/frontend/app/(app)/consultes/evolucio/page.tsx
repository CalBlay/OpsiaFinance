import { auth } from "@/lib/auth";
import {
  type AmbitEvolucio,
  type VistaCompte,
  getAnysAmbDades,
  getArbreSeleccio,
  getEvolucioMensual,
} from "@/lib/consultes";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import {
  exclouFdlcDeConsultaLinia,
  filtraLiniesPerGrup,
  grupMostraConsultesLiniaCentre,
  grupPermetVistaGestio,
} from "@/lib/grups-empresa";
import {
  aplicarVistaGestioEvolucioEmpresa,
  aplicarVistaGestioEvolucioLn,
} from "@/lib/repartiment/gestio-consultes";
import { getInfoGestioConsulta } from "@/lib/repartiment/service";
import { EvolucioBoard } from "./EvolucioBoard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Evolució mensual — OpsiaFinance" };

export default async function EvolucioPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; ln?: string; any?: string; vista?: string }>;
}) {
  const sp = await searchParams;
  const [session, arbre, anys, grup] = await Promise.all([
    auth(),
    getArbreSeleccio(),
    getAnysAmbDades(),
    getGrupEmpresaActual(),
  ]);

  const potLinia = grupMostraConsultesLiniaCentre(grup);
  const scope: AmbitEvolucio = potLinia && sp.scope === "linia" ? "linia" : "empresa";
  const anyActual = sp.any ? Number(sp.any) : (anys[0] ?? new Date().getFullYear());
  const lnId = potLinia ? (sp.ln ?? null) : null;
  const potGestio = grupPermetVistaGestio(grup);
  const vista: VistaCompte = potGestio && sp.vista === "gestio" ? "gestio" : "directe";
  const linies = exclouFdlcDeConsultaLinia(
    arbre.map((l) => ({ id: l.id, codi: l.codi, nom: l.nom }))
  );
  const lnIdsEmpresa = filtraLiniesPerGrup(
    arbre.map((l) => ({ id: l.id, codi: l.codi, nom: l.nom })),
    grup
  ).map((l) => l.id);
  const rangAny = { des: 1, fins: 12 };

  const necessitaLn = scope === "linia" && !lnId;
  const [evRaw, infoGestio] = necessitaLn
    ? [null, null]
    : await Promise.all([
        getEvolucioMensual(scope, lnId, anyActual, grup),
        potGestio ? getInfoGestioConsulta(anyActual, rangAny) : Promise.resolve(null),
      ]);

  let gestio = null;
  if (evRaw && potGestio) {
    if (scope === "linia" && lnId) {
      gestio = {
        ...evRaw,
        concepts: await aplicarVistaGestioEvolucioLn(lnId, anyActual, evRaw.concepts),
      };
    } else if (scope === "empresa") {
      gestio = {
        ...evRaw,
        concepts: await aplicarVistaGestioEvolucioEmpresa(anyActual, evRaw.concepts),
      };
    }
  }

  return (
    <EvolucioBoard
      linies={linies}
      anys={anys.length ? anys : [anyActual]}
      scope={scope}
      lnId={lnId}
      anyActual={anyActual}
      vistaInicial={vista}
      nomesEmpresa={!potLinia}
      mostraVistaGestio={potGestio}
      potGestio={potGestio}
      isAdmin={session?.user?.role === "ADMIN"}
      grup={grup}
      lnIdsEmpresa={lnIdsEmpresa}
      directe={evRaw}
      gestio={gestio}
      infoGestio={infoGestio}
    />
  );
}
