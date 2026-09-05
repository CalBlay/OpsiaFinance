import { auth } from "@/lib/auth";
import {
  type AmbitEvolucio,
  aplicarConsolidacioInterEvolucioEmpresa,
  getAnysAmbDades,
  getArbreSeleccio,
  getEvolucioMensualPerVista,
} from "@/lib/consultes";
import { slimConceptsForPaint } from "@/lib/consultes-slim";
import {
  aplicarBaseGestioPersonalEvolucioEmpresa,
  aplicarBaseGestioPersonalEvolucioLn,
} from "@/lib/cost-personal-centre/gestio-consultes";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import {
  filtraLiniesPerGrup,
  grupAplicaConsolidacioInter,
  grupPermetVistaGestio,
  liniesPerConsultaDetall,
} from "@/lib/grups-empresa";
import { getMapaNaturaConceptes } from "@/lib/natura-map";
import {
  aplicarVistaGestioEvolucioEmpresa,
  aplicarVistaGestioEvolucioLn,
} from "@/lib/repartiment/gestio-consultes";
import { getInfoGestioConsulta } from "@/lib/repartiment/service";
import {
  parseVistaCompte,
  vistaInclouRepartiment,
  vistaInclouTraspassos,
} from "@/lib/vista-compte";
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

  const scope: AmbitEvolucio = sp.scope === "linia" ? "linia" : "empresa";
  const anyActual = sp.any ? Number(sp.any) : (anys[0] ?? new Date().getFullYear());
  const lnId = sp.ln ?? null;
  const potGestio = grupPermetVistaGestio(grup);
  const vista = parseVistaCompte(sp.vista, { permetCapesGestio: potGestio });
  // Capes amb traspassos/repartiment: carrega eager la capa demanada.
  const carregaGestioEager = potGestio && vistaInclouTraspassos(vista);
  const linies = liniesPerConsultaDetall(
    arbre.map((l) => ({ id: l.id, codi: l.codi, nom: l.nom })),
    grup
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
        getEvolucioMensualPerVista(scope, lnId, anyActual, grup, vista),
        carregaGestioEager ? getInfoGestioConsulta(anyActual, rangAny) : Promise.resolve(null),
      ]);

  let gestio = null;
  if (evRaw && carregaGestioEager) {
    if (scope === "linia" && lnId) {
      let concepts = evRaw.concepts;
      if (vistaInclouTraspassos(vista)) {
        concepts = await aplicarBaseGestioPersonalEvolucioLn(lnId, anyActual, concepts);
      }
      if (vistaInclouRepartiment(vista)) {
        concepts = await aplicarVistaGestioEvolucioLn(lnId, anyActual, concepts);
      }
      gestio = { ...evRaw, concepts };
    } else if (scope === "empresa") {
      let conceptsGestio = evRaw.concepts;
      if (vistaInclouTraspassos(vista)) {
        conceptsGestio = await aplicarBaseGestioPersonalEvolucioEmpresa(anyActual, conceptsGestio);
      }
      if (vistaInclouRepartiment(vista)) {
        conceptsGestio = await aplicarVistaGestioEvolucioEmpresa(anyActual, conceptsGestio);
        if (grupAplicaConsolidacioInter(grup)) {
          conceptsGestio = await aplicarConsolidacioInterEvolucioEmpresa(
            anyActual,
            grup,
            conceptsGestio,
            { desMes: 1, finsMes: 12 }
          );
        }
      }
      gestio = {
        ...evRaw,
        concepts: conceptsGestio,
      };
    }
  }

  const naturaByNode = await getMapaNaturaConceptes();

  return (
    <EvolucioBoard
      linies={linies}
      anys={anys.length ? anys : [anyActual]}
      scope={scope}
      lnId={lnId}
      anyActual={anyActual}
      vistaInicial={vista}
      nomesEmpresa={false}
      mostraVistaGestio={potGestio}
      potGestio={potGestio}
      isAdmin={session?.user?.role === "ADMIN"}
      grup={grup}
      lnIdsEmpresa={lnIdsEmpresa}
      directe={evRaw ? { ...evRaw, concepts: slimConceptsForPaint(evRaw.concepts) } : null}
      gestio={gestio ? { ...gestio, concepts: slimConceptsForPaint(gestio.concepts) } : null}
      infoGestio={infoGestio}
      potCarregarGestio={potGestio && vista === "directe" && !!evRaw}
      naturaByNode={naturaByNode}
    />
  );
}
