"use server";

import { getComparativaLn } from "@/lib/consultes";
import type { VistaCompte } from "@/lib/consultes";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { grupFiltraRestaurantsNomesMirall } from "@/lib/grups-empresa";
import type { RangMesos } from "@/lib/periodes";
import {
  getComparativaVendes,
  getInformeVendesRestaurant,
} from "@/lib/vendes-restaurants/consultes";

/** Rankings complets (articles) — es crida en background després del board totalsOnly. */
export async function carregarRankingsComparativaVendesAction(any: number, mes: number) {
  const grup = await getGrupEmpresaActual();
  const nomesMirall = grupFiltraRestaurantsNomesMirall(grup);
  return getComparativaVendes(any, mes, nomesMirall, { totalsOnly: false });
}

export async function carregarRankingsInformeVendesAction(
  centreId: string,
  any: number,
  mes: number
) {
  return getInformeVendesRestaurant(centreId, any, mes, { totalsOnly: false });
}

/** Desglossament per centres de la LN — només quan s'obre el bloc plegat. */
export async function carregarComparativaLnAction(
  liniaNegociId: string,
  any: number,
  rang: RangMesos,
  vista: VistaCompte
) {
  return getComparativaLn(liniaNegociId, any, rang, vista);
}
