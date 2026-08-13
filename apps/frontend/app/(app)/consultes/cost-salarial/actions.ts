"use server";

import type { CompteCostSalarial } from "@/lib/cost-salarial/compte";
import { getForaCentreDetall } from "@/lib/cost-salarial/fora-centre-detall";
import type { DepartamentSalarial } from "@prisma/client";

export async function fetchForaCentreDetallAction(params: {
  centreId: string;
  any: number;
  mes: number | null;
  departament?: "SALA" | "CUINA" | null;
  compte?: CompteCostSalarial;
}) {
  return getForaCentreDetall({
    centreId: params.centreId,
    any: params.any,
    mes: params.mes,
    departament: (params.departament as DepartamentSalarial | null | undefined) ?? null,
    compte: params.compte ?? "directe",
  });
}
