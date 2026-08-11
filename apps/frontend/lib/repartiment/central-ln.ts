import type { MovimentCalculat } from "@/lib/repartiment/compres-pool";
import {
  percentRetencioGestioCentral,
  poolGestioCentralDistribuible,
} from "@/lib/repartiment/gestio-ln";
import { NODE_COST_GESTIO } from "@/lib/repartiment/nodes";
import type { NormaRepartiment } from "@prisma/client";

/**
 * LN00000 com a LN destí (Agenda a Gestió).
 *
 * Pas 1+3: objectiu = Valor% × gestió SAP Central (norma PERCENT_POOL_CENTRAL de LN00000).
 * El mateix % es treu del pool abans de repartir a 02–06 (gestio-ln).
 */
export function calcularMovimentsCentralLn(
  normes: NormaRepartiment[],
  directe: Map<string, Map<number, number>>,
  centralLnId: string
): MovimentCalculat[] {
  const moviments: MovimentCalculat[] = [];
  const pct = percentRetencioGestioCentral(centralLnId, normes);
  if (pct <= 0) return moviments;

  const norma = normes.find(
    (n) =>
      n.actiu &&
      n.liniaNegociDestiId === centralLnId &&
      n.concepteNode === NODE_COST_GESTIO &&
      n.tipus === "PERCENT_POOL_CENTRAL" &&
      n.valorPercent != null
  );
  if (!norma) return moviments;

  const { centralGestio, retencioAgenda } = poolGestioCentralDistribuible(
    directe,
    centralLnId,
    normes
  );
  const objectiu = retencioAgenda;

  moviments.push({
    normaId: norma.id,
    liniaNegociDestiId: centralLnId,
    concepteNode: NODE_COST_GESTIO,
    importCalculat: objectiu,
    detallCalcul: `Agenda (LN00000): ${(pct * 100).toFixed(0)}% × gestió SAP ${centralGestio.toFixed(2)} = ${objectiu.toFixed(2)}`,
  });

  return moviments;
}
