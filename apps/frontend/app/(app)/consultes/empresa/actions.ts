"use server";

import { auth } from "@/lib/auth";
import {
  type RangMesos,
  aplicarConsolidacioInterEvolucioEmpresa,
  getComparativaEmpresa,
  getEvolucioMensualPerVista,
} from "@/lib/consultes";
import { aplicarBaseGestioPersonalEvolucioEmpresa } from "@/lib/cost-personal-centre/gestio-consultes";
import type { GrupEmpresa } from "@/lib/grups-empresa";
import { grupAplicaConsolidacioInter, grupPermetVistaGestio } from "@/lib/grups-empresa";
import { aplicarVistaGestioEvolucioEmpresa } from "@/lib/repartiment/gestio-consultes";
import { getInfoGestioConsulta } from "@/lib/repartiment/service";
import {
  type VistaCompte,
  parseVistaCompte,
  vistaInclouRepartiment,
  vistaInclouTraspassos,
} from "@/lib/vista-compte";
import { buildEmpresaVistaData } from "./empresa-view-model";
import type { EmpresaVistaData } from "./empresa-vista-data";

async function evolucioPerVista(
  any: number,
  rang: RangMesos,
  grup: GrupEmpresa,
  vista: VistaCompte,
  evRaw: Awaited<ReturnType<typeof getEvolucioMensualPerVista>>
) {
  if (!evRaw) return null;
  if (!vistaInclouTraspassos(vista) && !vistaInclouRepartiment(vista)) return evRaw;

  let concepts = evRaw.concepts;
  if (vistaInclouTraspassos(vista)) {
    concepts = await aplicarBaseGestioPersonalEvolucioEmpresa(any, concepts);
  }
  if (vistaInclouRepartiment(vista)) {
    concepts = await aplicarVistaGestioEvolucioEmpresa(any, concepts);
    if (grupAplicaConsolidacioInter(grup)) {
      concepts = await aplicarConsolidacioInterEvolucioEmpresa(any, grup, concepts, {
        desMes: rang.des,
        finsMes: rang.fins,
      });
    }
  }
  return { ...evRaw, concepts };
}

/** Capa concreta en diferit (KPIs + compte detallat). */
export async function carregarEmpresaCapaAction(input: {
  any: number;
  rang: RangMesos;
  grup: GrupEmpresa;
  vista: VistaCompte;
}): Promise<EmpresaVistaData | null> {
  const potGestio = grupPermetVistaGestio(input.grup);
  const vista = parseVistaCompte(input.vista, { permetCapesGestio: potGestio });
  if ((vista === "traspassos" || vista === "gestio") && !potGestio) return null;

  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  const [comp, evEmpresaRaw, infoGestio] = await Promise.all([
    getComparativaEmpresa(input.any, input.rang, vista, input.grup),
    getEvolucioMensualPerVista("empresa", null, input.any, input.grup, vista),
    vistaInclouRepartiment(vista)
      ? getInfoGestioConsulta(input.any, input.rang)
      : Promise.resolve(null),
  ]);

  const evEmpresa = await evolucioPerVista(input.any, input.rang, input.grup, vista, evEmpresaRaw);

  return buildEmpresaVistaData({
    vista,
    grup: input.grup,
    anyActual: input.any,
    rang: input.rang,
    isAdmin,
    comp,
    evFdlc: null,
    evEmpresa,
    infoGestio,
  });
}

/** @deprecated Usa carregarEmpresaCapaAction({ vista: "gestio" }). */
export async function carregarEmpresaGestioAction(input: {
  any: number;
  rang: RangMesos;
  grup: GrupEmpresa;
}): Promise<EmpresaVistaData | null> {
  return carregarEmpresaCapaAction({ ...input, vista: "gestio" });
}

/** Només files del pivot (canvi de vista sense tornar a carregar evolució). */
export async function carregarEmpresaPivotAction(input: {
  any: number;
  rang: RangMesos;
  grup: GrupEmpresa;
  vista: VistaCompte;
}): Promise<EmpresaVistaData["pivotRows"]> {
  const potGestio = grupPermetVistaGestio(input.grup);
  const vista = parseVistaCompte(input.vista, { permetCapesGestio: potGestio });
  if ((vista === "traspassos" || vista === "gestio") && !potGestio) return [];

  const comp = await getComparativaEmpresa(input.any, input.rang, vista, input.grup);
  return comp.concepts;
}
