import { NODE_LABELS_FALLBACK } from "@/lib/consolidacio/labels";
import { db } from "@/lib/db";

/** Etiquetes de nodes per a la UI de settings (només servidor). */
export async function getNodeLabels(): Promise<Record<number, string>> {
  const conceptes = await db.concepteResultat.findMany({
    select: { node: true, descripcio: true },
  });
  const labels: Record<number, string> = { ...NODE_LABELS_FALLBACK };
  for (const c of conceptes) labels[c.node] = c.descripcio;
  return labels;
}
