import type { MovimentCalculat } from "@/lib/repartiment/compres-pool";
import { NODES_GESTIO_DETALL } from "@/lib/repartiment/nodes";
import type { NormaRepartiment } from "@prisma/client";

const nodesGestio = new Set<number>(NODES_GESTIO_DETALL);

export function esNormaMatriuGestio(norma: NormaRepartiment): boolean {
  return (
    norma.actiu &&
    nodesGestio.has(norma.concepteNode) &&
    norma.tipus === "PERCENT_POOL_CENTRAL" &&
    norma.liniaNegociDestiId != null &&
    norma.valorPercent != null
  );
}

/**
 * Reparteix cada partida de gestió de Central amb la seva pròpia fila de percentatges.
 * Els imports generats són objectius; `movimentsADeltas` els converteix després en deltes.
 */
export function calcularMovimentsMatriuGestio(
  normes: NormaRepartiment[],
  directe: Map<string, Map<number, number>>,
  centralLnId: string
): MovimentCalculat[] {
  const moviments: MovimentCalculat[] = [];

  for (const norma of normes.filter(esNormaMatriuGestio)) {
    const destiId = norma.liniaNegociDestiId;
    if (!destiId) continue;

    const node = norma.concepteNode;
    const pct = Number(norma.valorPercent);
    const baseCentral = directe.get(centralLnId)?.get(node) ?? 0;
    const imputat = baseCentral * (pct / 100);
    const baseDesti = destiId === centralLnId ? 0 : (directe.get(destiId)?.get(node) ?? 0);
    const objectiu = baseDesti + imputat;

    moviments.push({
      normaId: norma.id,
      liniaNegociDestiId: destiId,
      concepteNode: node,
      importCalculat: objectiu,
      detallCalcul:
        destiId === centralLnId
          ? `Agenda: ${pct.toFixed(2)}% × Central ${baseCentral.toFixed(2)}`
          : `SAP propi ${baseDesti.toFixed(2)} + ${pct.toFixed(2)}% × Central ${baseCentral.toFixed(2)}`,
    });
  }

  return moviments;
}
