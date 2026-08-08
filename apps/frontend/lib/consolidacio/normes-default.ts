import { NORMES_CONSOLIDACIO_SEED } from "@/lib/consolidacio/normes-seed";
import { db } from "@/lib/db";

/** Codis de seed retirats (esborrats en sincronitzar). */
const CODIS_SEED_OBSOLETS = ["GRUP_COMPRES_FDLC_CONSUMS", "GRUP_COMPRES_FDLC"];

/** Crea o actualitza les normes de consolidació per defecte (idempotent per `codi`). */
export async function syncNormesConsolidacioSeed(): Promise<{ ok: boolean; missatge: string }> {
  if (CODIS_SEED_OBSOLETS.length > 0) {
    await db.normaConsolidacio.deleteMany({ where: { codi: { in: CODIS_SEED_OBSOLETS } } });
  }
  let upserts = 0;
  let importUpserts = 0;
  for (const n of NORMES_CONSOLIDACIO_SEED) {
    const norma = await db.normaConsolidacio.upsert({
      where: { codi: n.codi },
      update: {
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
        nodesOrigen: n.nodesOrigen ?? [],
        nodesDesti: n.nodesDesti ?? [],
        fontImport: n.fontImport ?? "MIN_COINCIDENT",
        notaOrigen: n.notaOrigen ?? null,
        notaDesti: n.notaDesti ?? null,
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
        nodesOrigen: n.nodesOrigen ?? [],
        nodesDesti: n.nodesDesti ?? [],
        fontImport: n.fontImport ?? "MIN_COINCIDENT",
        notaOrigen: n.notaOrigen ?? null,
        notaDesti: n.notaDesti ?? null,
      },
    });
    upserts++;

    for (const imp of n.imports ?? []) {
      await db.normaConsolidacioImport.upsert({
        where: {
          normaId_any_mes: {
            normaId: norma.id,
            any: imp.any,
            mes: imp.mes,
          },
        },
        update: {
          import_: imp.import,
          nota: imp.nota ?? null,
        },
        create: {
          normaId: norma.id,
          any: imp.any,
          mes: imp.mes,
          import_: imp.import,
          nota: imp.nota ?? null,
        },
      });
      importUpserts++;
    }
  }
  return {
    ok: true,
    missatge: `${upserts} normes i ${importUpserts} imports mensuals sincronitzats.`,
  };
}

export async function ensureNormesConsolidacio(): Promise<void> {
  await syncNormesConsolidacioSeed();
}

export async function resetNormesConsolidacioSeed(): Promise<{ ok: boolean; missatge: string }> {
  const codis = NORMES_CONSOLIDACIO_SEED.map((n) => n.codi);
  await db.normaConsolidacio.deleteMany({ where: { codi: { notIn: codis } } });
  return syncNormesConsolidacioSeed();
}
