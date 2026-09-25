import { resolCentreBalancEsdeveniments } from "@/lib/balanc-esdeveniments/mapeig";
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
  rutaStorage: string | null;
  periodId: string | null;
  liniaNegociId: string | null;
  period: { mes: number; any: number } | null;
  liniaNegoci: { id: string; codi: string; nom: string } | null;
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
 * Importa un balanç d'esdeveniments (totes les pestanyes = centres) com a ajustos
 * «Regularització». No escriu DadaResultat.
 */
export async function processarImportExerciciCentre(
  imp: ImportWithRelations,
  fitxer: Buffer
): Promise<{ ok: boolean; missatge: string }> {
  const anyMatch = imp.nomFitxer.match(/20\d{2}/)?.[0];
  const anyFallback = imp.period?.any ?? (anyMatch ? Number(anyMatch) : null);

  await ensureConceptesCompteBase();

  const multi = parseBalancEsdevenimentsTots(fitxer, anyFallback);
  if (multi.blocs.length === 0) {
    return {
      ok: false,
      missatge: [...multi.errors, ...multi.avisos].join(" ") || "No s'han trobat dades.",
    };
  }

  const resums: string[] = [];
  const errorsGlobals: string[] = [];
  const avisosGlobals = [...multi.avisos];
  let totalAjustos = 0;
  let centresOk = 0;
  const centreCodis: string[] = [];
  let refPeriodId: string | null = null;
  let liniaNegociIdFinal: string | null = imp.liniaNegociId;
  let anyUsat: number | null = anyFallback;

  const periodIdByMesGlobal = new Map<number, string>();

  for (const bloc of multi.blocs) {
    const any = bloc.anyDetectat ?? anyFallback;
    if (!any) {
      errorsGlobals.push(`Full «${bloc.full}»: falta l'exercici (any).`);
      continue;
    }
    anyUsat = any;

    if (!bloc.centreText) {
      errorsGlobals.push(...bloc.errors);
      continue;
    }

    const desti = await resolCentreBalancEsdeveniments(bloc.centreText);
    if (!desti) {
      errorsGlobals.push(
        `Full «${bloc.full}»: no hi ha mapeig per «${bloc.centreText}». Afegeix-lo a Configuració → Balanç esdeveniments.`
      );
      continue;
    }

    if (bloc.fets.length === 0) {
      errorsGlobals.push(...bloc.errors);
      avisosGlobals.push(...bloc.avisos);
      continue;
    }

    const nodes = [...new Set(bloc.fets.map((f) => f.node))];
    const conceptes = await db.concepteResultat.findMany({
      where: { node: { in: nodes } },
      select: { id: true, node: true },
    });
    const concepteIdByNode = new Map(conceptes.map((c) => [c.node, c.id]));
    const nodesFaltants = nodes.filter((n) => !concepteIdByNode.has(n));
    if (nodesFaltants.length > 0) {
      errorsGlobals.push(
        `Full «${bloc.full}»: falten conceptes (nodes ${nodesFaltants.join(", ")}).`
      );
      continue;
    }

    for (const mes of bloc.mesosDetectats) {
      if (!periodIdByMesGlobal.has(mes)) {
        periodIdByMesGlobal.set(mes, await upsertPeriode(any, mes));
      }
    }
    const periodIds = bloc.mesosDetectats
      .map((m) => periodIdByMesGlobal.get(m))
      .filter((id): id is string => Boolean(id));

    await db.ajust.deleteMany({
      where: {
        centreId: desti.centreId,
        liniaNegociId: null,
        periodId: { in: periodIds },
        motiu: MOTIU_REGULARITZACIO,
      },
    });

    const rows = bloc.fets
      .map((f) => {
        const concepteResultatId = concepteIdByNode.get(f.node);
        const periodId = periodIdByMesGlobal.get(f.mes);
        if (!concepteResultatId || !periodId) return null;
        return {
          periodId,
          concepteResultatId,
          centreId: desti.centreId,
          liniaNegociId: null as string | null,
          import_: f.valor,
          motiu: MOTIU_REGULARITZACIO,
          creatPer: imp.creatPer,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
      await db.ajust.createMany({ data: rows.slice(i, i + BATCH) });
    }

    totalAjustos += rows.length;
    centresOk += 1;
    centreCodis.push(desti.centreCodi);
    liniaNegociIdFinal = desti.liniaNegociId;
    if (!refPeriodId && periodIds[0]) refPeriodId = periodIds[0];

    avisosGlobals.push(...bloc.avisos);
    if (bloc.etiquetesNoMapades.length > 0) {
      const mostra = bloc.etiquetesNoMapades.slice(0, 3).join("; ");
      avisosGlobals.push(`Full «${bloc.full}»: etiquetes ignorades (${mostra}…).`);
    }

    const mesosLabel = bloc.mesosDetectats.map((m) => MESOS_NOMS[m]).join(", ");
    resums.push(
      `${desti.centreCodi} · ${desti.centreNom}: ${rows.length} ajustos (${mesosLabel || "—"})`
    );
  }

  if (centresOk === 0) {
    return {
      ok: false,
      missatge:
        errorsGlobals.join(" ") ||
        multi.errors.join(" ") ||
        "No s'ha pogut importar cap centre (revisa mapeigs i pestanyes).",
    };
  }

  const notesCentres = centreCodis.map((c) => `Centre ${c}`).join(" · ");

  await db.importacio.update({
    where: { id: imp.id },
    data: {
      estat: "CLASSIFICAT",
      periodId: refPeriodId,
      liniaNegociId: liniaNegociIdFinal,
      notes: [
        imp.nomFitxer,
        notesCentres,
        `${centresOk} centre(s)`,
        `${totalAjustos} ajustos Regularització`,
        anyUsat ? `exercici ${anyUsat}` : null,
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

  let avis = "";
  if (errorsGlobals.length > 0) {
    avis += ` Amb avisos: ${errorsGlobals.slice(0, 3).join(" | ")}`;
    if (errorsGlobals.length > 3) avis += ` (+${errorsGlobals.length - 3})`;
  }
  if (avisosGlobals.length > 0) {
    avis += ` ${avisosGlobals.slice(0, 2).join(" ")}`;
  }

  return {
    ok: true,
    missatge: `${centresOk} centre(s) · ${totalAjustos} ajustos Regularització · ${resums.join(" · ")}.${avis}`,
  };
}
