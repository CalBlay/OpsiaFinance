"use server";

import { getComparativaEmpresa, getDarrerPeriodAmbDades } from "@/lib/consultes";
import type { GrupEmpresa } from "@/lib/grups-empresa";

/**
 * Escalfa la cache del darrer període d'un grup (Inici / canvi d'empresa).
 * Es crida en idle des del selector; errors es ignoren al client.
 */
export async function prefetchGrupIniciAction(grup: GrupEmpresa): Promise<void> {
  const darrer = await getDarrerPeriodAmbDades(grup);
  if (!darrer) return;
  await getComparativaEmpresa(darrer.any, { des: darrer.mes, fins: darrer.mes }, "directe", grup);
}
