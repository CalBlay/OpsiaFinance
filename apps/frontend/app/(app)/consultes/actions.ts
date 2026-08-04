"use server";

import { type DetallCellaParams, type DetallCellaResult, getDetallCella } from "@/lib/consultes";

export async function fetchDetallCellaAction(
  params: DetallCellaParams
): Promise<DetallCellaResult> {
  return getDetallCella(params);
}
