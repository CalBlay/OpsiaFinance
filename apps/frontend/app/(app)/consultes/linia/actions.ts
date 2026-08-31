"use server";

import {
  aplicarCapaVistaEvolucio,
  getComparativaEmpresa,
  getComparativaEmpresaParell,
  getEvolucioMensualPerVista,
  restarConceptesPivot,
} from "@/lib/consultes";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import type { GrupEmpresa } from "@/lib/grups-empresa";
import { grupPermetVistaGestio } from "@/lib/grups-empresa";
import type { RangMesos } from "@/lib/periodes";
import { type VistaCompte, parseVistaCompte, vistaInclouTraspassos } from "@/lib/vista-compte";
import { type LiniaResumCapa, buildLiniaResumCapa } from "./linia-resum-data";

async function evEmpresaPerVista(any: number, grup: GrupEmpresa, vista: VistaCompte) {
  const evRaw = await getEvolucioMensualPerVista("empresa", null, any, grup, vista);
  if (!evRaw) return null;
  return {
    ...evRaw,
    concepts: await aplicarCapaVistaEvolucio("empresa", null, any, evRaw.concepts, grup, vista),
  };
}

/** Carrega el resum multi-LN per a una vista (canvi ràpid al client). */
export async function carregarLiniaResumCapaAction(input: {
  any: number;
  rang: RangMesos;
  vista: VistaCompte;
}): Promise<LiniaResumCapa | null> {
  const grup = await getGrupEmpresaActual();
  const potGestio = grupPermetVistaGestio(grup);
  const vista = parseVistaCompte(input.vista, { permetCapesGestio: potGestio });

  if (vista === "ajustos") {
    const [sap, directe, evSap, evDirecte] = await Promise.all([
      getComparativaEmpresa(input.any, input.rang, "sap", grup),
      getComparativaEmpresa(input.any, input.rang, "directe", grup),
      evEmpresaPerVista(input.any, grup, "sap"),
      evEmpresaPerVista(input.any, grup, "directe"),
    ]);
    const comp = {
      ...directe,
      concepts: restarConceptesPivot(directe.concepts, sap.concepts),
    };
    const ev =
      evDirecte && evSap
        ? {
            ...evDirecte,
            concepts: restarConceptesPivot(evDirecte.concepts, evSap.concepts),
          }
        : evDirecte;
    return buildLiniaResumCapa(comp, ev, {
      anyActual: input.any,
      rang: input.rang,
      vista,
    });
  }

  const [comp, ev] = await Promise.all([
    getComparativaEmpresa(input.any, input.rang, vista, grup),
    evEmpresaPerVista(input.any, grup, vista),
  ]);

  return buildLiniaResumCapa(comp, ev, {
    anyActual: input.any,
    rang: input.rang,
    vista,
  });
}

/** Precàrrega de totes les vistes (resum LN) en un sol viatge al servidor. */
export async function carregarLiniaResumCapesAction(input: {
  any: number;
  rang: RangMesos;
  vistaInicial: VistaCompte;
}): Promise<Partial<Record<VistaCompte, LiniaResumCapa>>> {
  const grup = await getGrupEmpresaActual();
  const potGestio = grupPermetVistaGestio(grup);
  const vistaInicial = parseVistaCompte(input.vistaInicial, { permetCapesGestio: potGestio });
  const carregaEager = potGestio && vistaInclouTraspassos(vistaInicial);

  if (!carregaEager) {
    const capa = await carregarLiniaResumCapaAction({
      any: input.any,
      rang: input.rang,
      vista: vistaInicial,
    });
    return capa ? { [vistaInicial]: capa } : {};
  }

  const parell = await getComparativaEmpresaParell(input.any, input.rang, grup);
  const [evSap, evDirecte, evTraspassos, evGestio] = await Promise.all([
    evEmpresaPerVista(input.any, grup, "sap"),
    evEmpresaPerVista(input.any, grup, "directe"),
    evEmpresaPerVista(input.any, grup, "traspassos"),
    evEmpresaPerVista(input.any, grup, "gestio"),
  ]);

  const capes: Partial<Record<VistaCompte, LiniaResumCapa>> = {
    sap: buildLiniaResumCapa(parell.sap, evSap, {
      anyActual: input.any,
      rang: input.rang,
      vista: "sap",
    }),
    directe: buildLiniaResumCapa(parell.directe, evDirecte, {
      anyActual: input.any,
      rang: input.rang,
      vista: "directe",
    }),
  };

  capes.ajustos = buildLiniaResumCapa(
    {
      ...parell.directe,
      concepts: restarConceptesPivot(parell.directe.concepts, parell.sap.concepts),
    },
    evDirecte && evSap
      ? { ...evDirecte, concepts: restarConceptesPivot(evDirecte.concepts, evSap.concepts) }
      : evDirecte,
    { anyActual: input.any, rang: input.rang, vista: "ajustos" }
  );

  if (parell.traspassos) {
    capes.traspassos = buildLiniaResumCapa(parell.traspassos, evTraspassos, {
      anyActual: input.any,
      rang: input.rang,
      vista: "traspassos",
    });
  }
  if (parell.gestio) {
    capes.gestio = buildLiniaResumCapa(parell.gestio, evGestio, {
      anyActual: input.any,
      rang: input.rang,
      vista: "gestio",
    });
  }

  return capes;
}
