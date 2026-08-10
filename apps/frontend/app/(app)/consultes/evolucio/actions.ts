"use server";

import {
  type AmbitEvolucio,
  type ConceptePivot,
  type EvolucioMensual,
  aplicarConsolidacioInterEvolucioEmpresa,
  getEvolucioMensual,
} from "@/lib/consultes";
import { slimConceptsForPaint } from "@/lib/consultes-slim";
import type { GrupEmpresa } from "@/lib/grups-empresa";
import { grupAplicaConsolidacioInter, grupPermetVistaGestio } from "@/lib/grups-empresa";
import {
  aplicarVistaGestioEvolucioEmpresa,
  aplicarVistaGestioEvolucioLn,
} from "@/lib/repartiment/gestio-consultes";
import { type InfoGestioConsulta, getInfoGestioConsulta } from "@/lib/repartiment/service";
import type { VistaCompte } from "@/lib/vista-compte";

async function evolucioAmbVista(input: {
  scope: AmbitEvolucio;
  lnId: string | null;
  any: number;
  grup: GrupEmpresa;
  vista: VistaCompte;
}): Promise<EvolucioMensual | null> {
  const evRaw = await getEvolucioMensual(input.scope, input.lnId, input.any, input.grup);
  if (!evRaw) return null;
  if (input.vista !== "gestio" || !grupPermetVistaGestio(input.grup)) return evRaw;

  if (input.scope === "linia" && input.lnId) {
    return {
      ...evRaw,
      concepts: await aplicarVistaGestioEvolucioLn(input.lnId, input.any, evRaw.concepts),
    };
  }
  if (input.scope === "empresa") {
    let conceptsGestio = await aplicarVistaGestioEvolucioEmpresa(input.any, evRaw.concepts);
    if (grupAplicaConsolidacioInter(input.grup)) {
      conceptsGestio = await aplicarConsolidacioInterEvolucioEmpresa(
        input.any,
        input.grup,
        conceptsGestio,
        { desMes: 1, finsMes: 12 }
      );
    }
    return { ...evRaw, concepts: conceptsGestio };
  }
  return evRaw;
}

/** Capa Gestió en diferit (KPIs slim; pivot sencer en obrir el compte). */
export async function carregarEvolucioGestioAction(input: {
  scope: AmbitEvolucio;
  lnId: string | null;
  any: number;
  grup: GrupEmpresa;
}): Promise<{ gestio: EvolucioMensual; infoGestio: InfoGestioConsulta } | null> {
  if (!grupPermetVistaGestio(input.grup)) return null;
  if (input.scope === "linia" && !input.lnId) return null;

  const [gestioFull, infoGestio] = await Promise.all([
    evolucioAmbVista({ ...input, vista: "gestio" }),
    getInfoGestioConsulta(input.any, { des: 1, fins: 12 }),
  ]);
  if (!gestioFull) return null;

  return {
    gestio: { ...gestioFull, concepts: slimConceptsForPaint(gestioFull.concepts) },
    infoGestio,
  };
}

/** Compte detallat complet (totes les files) en diferit. */
export async function carregarEvolucioPivotAction(input: {
  scope: AmbitEvolucio;
  lnId: string | null;
  any: number;
  grup: GrupEmpresa;
  vista: VistaCompte;
}): Promise<ConceptePivot[]> {
  if (input.scope === "linia" && !input.lnId) return [];
  const vista: VistaCompte =
    input.vista === "gestio" && grupPermetVistaGestio(input.grup) ? "gestio" : "directe";
  const ev = await evolucioAmbVista({ ...input, vista });
  return ev?.concepts ?? [];
}
