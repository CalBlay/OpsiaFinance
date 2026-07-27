import { NORMES_CONSOLIDACIO_SEED } from "@/lib/consolidacio/normes-seed";
import { db } from "@/lib/db";

/** Crea o actualitza les normes de consolidació per defecte (idempotent per `codi`). */
export async function syncNormesConsolidacioSeed(): Promise<{ ok: boolean; missatge: string }> {
  let upserts = 0;
  for (const n of NORMES_CONSOLIDACIO_SEED) {
    await db.normaConsolidacio.upsert({
      where: { codi: n.codi },
      update: {
        nom: n.nom,
        descripcio: n.descripcio,
        grup: n.grup,
        tipus: n.tipus,
        ordre: n.ordre,
        nodeExcloure: n.nodeExcloure ?? null,
        nodesAjust: n.nodesAjust ?? [],
        grupEmpresaOrigen: n.grupEmpresaOrigen ?? null,
        nodeOrigen: n.nodeOrigen ?? null,
        grupEmpresaDesti: n.grupEmpresaDesti ?? null,
        nodeDesti: n.nodeDesti ?? null,
      },
      create: {
        codi: n.codi,
        nom: n.nom,
        descripcio: n.descripcio,
        grup: n.grup,
        tipus: n.tipus,
        ordre: n.ordre,
        actiu: n.actiu,
        nodeExcloure: n.nodeExcloure ?? null,
        nodesAjust: n.nodesAjust ?? [],
        grupEmpresaOrigen: n.grupEmpresaOrigen ?? null,
        nodeOrigen: n.nodeOrigen ?? null,
        grupEmpresaDesti: n.grupEmpresaDesti ?? null,
        nodeDesti: n.nodeDesti ?? null,
      },
    });
    upserts++;
  }
  return { ok: true, missatge: `${upserts} normes de consolidació sincronitzades.` };
}

export async function ensureNormesConsolidacio(): Promise<void> {
  const count = await db.normaConsolidacio.count();
  if (count === 0) await syncNormesConsolidacioSeed();
}

export async function resetNormesConsolidacioSeed(): Promise<{ ok: boolean; missatge: string }> {
  const codis = NORMES_CONSOLIDACIO_SEED.map((n) => n.codi);
  await db.normaConsolidacio.deleteMany({ where: { codi: { notIn: codis } } });
  return syncNormesConsolidacioSeed();
}
