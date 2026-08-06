"use server";

import { getForaCentreDetall } from "@/lib/cost-salarial/fora-centre-detall";
import type { DepartamentSalarial } from "@prisma/client";

export async function fetchForaCentreDetallAction(params: {
  centreId: string;
  any: number;
  mes: number | null;
  departament?: "SALA" | "CUINA" | null;
}) {
  return getForaCentreDetall({
    centreId: params.centreId,
    any: params.any,
    mes: params.mes,
    departament: (params.departament as DepartamentSalarial | null | undefined) ?? null,
  });
}
