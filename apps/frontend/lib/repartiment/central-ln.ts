import type { MovimentCalculat } from "@/lib/repartiment/compres-pool";
import type { NormaRepartiment } from "@prisma/client";

/**
 * LN00000 (Agenda) no genera moviments propis a la vista Gestió.
 *
 * Les normes d'Agenda (compres %, personal fix+%, gestió %) només retenen del pool
 * abans de repartir a la resta de LN. La columna Central és el residual zero-sum:
 *   Central = SAP Central − el que s'ha imputat a les altres LN
 *
 * Així Directe i Gestió tenen el mateix total empresa; només canvia el pes per LN.
 */
export function calcularMovimentsCentralLn(
  _normes: NormaRepartiment[],
  _directe: Map<string, Map<number, number>>,
  _centralLnId: string
): MovimentCalculat[] {
  return [];
}
