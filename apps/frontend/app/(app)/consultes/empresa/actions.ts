"use server";

import { auth } from "@/lib/auth";
import { type RangMesos, getComparativaEmpresa, getEvolucioMensual } from "@/lib/consultes";
import type { GrupEmpresa } from "@/lib/grups-empresa";
import { grupPermetVistaGestio } from "@/lib/grups-empresa";
import { aplicarVistaGestioEvolucioEmpresa } from "@/lib/repartiment/gestio-consultes";
import { getInfoGestioConsulta } from "@/lib/repartiment/service";
import { buildEmpresaVistaData } from "./empresa-view-model";
import type { EmpresaVistaData } from "./empresa-vista-data";

/** Capa Gestió en diferit (després del primer paint Directe). */
export async function carregarEmpresaGestioAction(input: {
  any: number;
  rang: RangMesos;
  grup: GrupEmpresa;
}): Promise<EmpresaVistaData | null> {
  if (!grupPermetVistaGestio(input.grup)) return null;

  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  const esPresentacioCalblay = input.grup === "calblay";

  const [compGestio, evEmpresaRaw, infoGestio] = await Promise.all([
    getComparativaEmpresa(input.any, input.rang, "gestio", input.grup),
    esPresentacioCalblay
      ? getEvolucioMensual("empresa", null, input.any, input.grup)
      : Promise.resolve(null),
    getInfoGestioConsulta(input.any, input.rang),
  ]);

  let evEmpresaGestio = evEmpresaRaw;
  if (evEmpresaRaw) {
    evEmpresaGestio = {
      ...evEmpresaRaw,
      concepts: await aplicarVistaGestioEvolucioEmpresa(input.any, evEmpresaRaw.concepts),
    };
  }

  return buildEmpresaVistaData({
    vista: "gestio",
    grup: input.grup,
    anyActual: input.any,
    rang: input.rang,
    isAdmin,
    comp: compGestio,
    evFdlc: null,
    evEmpresa: evEmpresaGestio,
    infoGestio,
  });
}
