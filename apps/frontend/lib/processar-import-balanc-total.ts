import {
  TEXT_MAPEIG_BALANC_TOTAL,
  esNomFitxerBalancTotal,
  resolCentreBalancEsdeveniments,
} from "@/lib/balanc-esdeveniments/mapeig";
import { MOTIU_REGULARITZACIO } from "@/lib/balanc-esdeveniments/nodes";
import { parseBalancEsdevenimentsTots } from "@/lib/balanc-esdeveniments/parser";
import { revalidateConsultesDades } from "@/lib/consultes-cache";
import { db } from "@/lib/db";
import { ensureConceptesCompteBase } from "@/lib/fdlc/conceptes-base";
import { MESOS_PER_NUM } from "@/lib/periodes";
import { revalidatePath } from "next/cache";

const MESOS_NOMS = MESOS_PER_NUM;

type ImportWithRelations = {
  id: string;
  nomFitxer: string;
  periodId: string | null;
  liniaNegociId: string | null;
  period: { mes: number; any: number } | null;
  creatPer: string;
};

async function upsertPeriode(any: number, mes: number): Promise<string> {
  const period = await db.period.upsert({
    where: { any_mes: { any, mes } },
    update: {},
    create: { any, mes, nom: `${MESOS_NOMS[mes]} ${any}` },
  });
  return period.id;
}

/**
 * Balanç total: mateix format Excel, A2 buit, identificat pel nom del fitxer.
 * Per cada línia de detall × mes:
 *   residual = total_Excel − Σ Regularització d'altres centres (mateix any/mes/concepte)
 * Es desa com a Regularització al centre mapejat «Balanç total».
 */
export async function processarImportBalancTotal(
  imp: ImportWithRelations,
  fitxer: Buffer
): Promise<{ ok: boolean; missatge: string }> {
  if (!esNomFitxerBalancTotal(imp.nomFitxer)) {
    return { ok: false, missatge: "El fitxer no sembla un Balanç total (revisa el nom)." };
  }

  const anyMatch = imp.nomFitxer.match(/20\d{2}/)?.[0];
  const anyFallback = imp.period?.any ?? (anyMatch ? Number(anyMatch) : null);

  await ensureConceptesCompteBase();

  const desti = await resolCentreBalancEsdeveniments(TEXT_MAPEIG_BALANC_TOTAL);
  if (!desti) {
    return {
      ok: false,
      missatge: `Falta el mapeig «${TEXT_MAPEIG_BALANC_TOTAL}» a Configuració → Balanç esdeveniments (A2 del fitxer va en blanc).`,
    };
  }

  const multi = parseBalancEsdevenimentsTots(fitxer, anyFallback);
  const bloc = multi.blocs.find((b) => b.fets.length > 0);
  if (!bloc) {
    return {
      ok: false,
      missatge:
        [...multi.errors, ...multi.avisos].join(" ") || "No s'han trobat dades al Balanç total.",
    };
  }

  const any = bloc.anyDetectat ?? anyFallback;
  if (!any) {
    return { ok: false, missatge: "Falta l'exercici (any) al fitxer o a la classificació." };
  }

  const nodes = [...new Set(bloc.fets.map((f) => f.node))];
  const conceptes = await db.concepteResultat.findMany({
    where: { node: { in: nodes } },
    select: { id: true, node: true },
  });
  const concepteIdByNode = new Map(conceptes.map((c) => [c.node, c.id]));
  const nodesFaltants = nodes.filter((n) => !concepteIdByNode.has(n));
  if (nodesFaltants.length > 0) {
    return {
      ok: false,
      missatge: `Falten conceptes (nodes ${nodesFaltants.join(", ")}).`,
    };
  }

  const periodIdByMes = new Map<number, string>();
  for (const mes of bloc.mesosDetectats) {
    periodIdByMes.set(mes, await upsertPeriode(any, mes));
  }
  const periodIds = [...periodIdByMes.values()];

  // Esborra Regularització prèvia del centre destí (residual anterior)
  await db.ajust.deleteMany({
    where: {
      centreId: desti.centreId,
      liniaNegociId: null,
      periodId: { in: periodIds },
      motiu: MOTIU_REGULARITZACIO,
    },
  });

  // Suma Regularització d'altres centres per període × concepte
  const altres = await db.ajust.groupBy({
    by: ["periodId", "concepteResultatId"],
    where: {
      motiu: MOTIU_REGULARITZACIO,
      periodId: { in: periodIds },
      centreId: { not: desti.centreId },
      NOT: { centreId: null },
    },
    _sum: { import_: true },
  });
  const sumaAltres = new Map<string, number>();
  for (const row of altres) {
    sumaAltres.set(`${row.periodId}|${row.concepteResultatId}`, Number(row._sum.import_ ?? 0));
  }

  const rows: {
    periodId: string;
    concepteResultatId: string;
    centreId: string;
    liniaNegociId: string | null;
    import_: number;
    motiu: string;
    creatPer: string;
  }[] = [];

  for (const f of bloc.fets) {
    const concepteResultatId = concepteIdByNode.get(f.node);
    const periodId = periodIdByMes.get(f.mes);
    if (!concepteResultatId || !periodId) continue;

    const suma = sumaAltres.get(`${periodId}|${concepteResultatId}`) ?? 0;
    const residual = Math.round((f.valor - suma) * 100) / 100;
    if (residual === 0) continue;

    rows.push({
      periodId,
      concepteResultatId,
      centreId: desti.centreId,
      liniaNegociId: null,
      import_: residual,
      motiu: MOTIU_REGULARITZACIO,
      creatPer: imp.creatPer,
    });
  }

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.ajust.createMany({ data: rows.slice(i, i + BATCH) });
  }

  const mesosLabel = bloc.mesosDetectats.map((m) => MESOS_NOMS[m]).join(", ");
  const refPeriodId = periodIds[0] ?? imp.periodId;

  await db.importacio.update({
    where: { id: imp.id },
    data: {
      estat: "CLASSIFICAT",
      periodId: refPeriodId,
      liniaNegociId: desti.liniaNegociId,
      notes: [
        imp.nomFitxer,
        "Balanç total (residual)",
        `Centre ${desti.centreCodi}`,
        `${rows.length} ajustos Regularització`,
        mesosLabel ? `mesos ${mesosLabel}` : null,
        `exercici ${any}`,
      ]
        .filter(Boolean)
        .join(" · "),
    },
  });

  revalidateConsultesDades();
  revalidatePath(`/dades/${imp.id}`);
  revalidatePath("/dades");
  revalidatePath("/dades/ajustos");
  revalidatePath("/consultes/empresa");
  revalidatePath("/consultes/linia");
  revalidatePath("/consultes/centre");
  revalidatePath("/consultes/evolucio");
  revalidatePath("/consultes/comparativa");

  const avisos = [...multi.avisos, ...bloc.avisos].slice(0, 2).join(" ");
  return {
    ok: true,
    missatge: `Balanç total → ${desti.centreCodi} · ${desti.centreNom}: ${rows.length} ajustos residual Regularització (${mesosLabel || "—"}).${avisos ? ` ${avisos}` : ""}`,
  };
}
