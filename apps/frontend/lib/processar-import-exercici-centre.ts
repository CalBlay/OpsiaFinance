import { resolCentreBalancEsdeveniments } from "@/lib/balanc-esdeveniments/mapeig";
import { MOTIU_REGULARITZACIO } from "@/lib/balanc-esdeveniments/nodes";
import { parseBalancEsdeveniments } from "@/lib/balanc-esdeveniments/parser";
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
 * Importa un balanç d'esdeveniments com a ajustos «Regularització» al centre mapejat.
 * No escriu DadaResultat; només capa Ajustos.
 */
export async function processarImportExerciciCentre(
  imp: ImportWithRelations,
  fitxer: Buffer
): Promise<{ ok: boolean; missatge: string }> {
  const anyMatch = imp.nomFitxer.match(/20\d{2}/)?.[0];
  const anyFallback = imp.period?.any ?? (anyMatch ? Number(anyMatch) : null);

  await ensureConceptesCompteBase();

  const parsed = parseBalancEsdeveniments(fitxer, anyFallback);
  const {
    centreText,
    anyDetectat,
    titolBloc,
    fets,
    mesosDetectats,
    errors,
    avisos,
    etiquetesNoMapades,
  } = parsed;

  const any = anyDetectat ?? anyFallback;
  if (!any) {
    return {
      ok: false,
      missatge: "Cal indicar l'exercici (any) abans de processar el balanç d'esdeveniments.",
    };
  }

  if (!centreText) {
    return {
      ok: false,
      missatge: errors.join(" ") || "Falta el nom del centre a la fila 2.",
    };
  }

  const desti = await resolCentreBalancEsdeveniments(centreText);
  if (!desti) {
    return {
      ok: false,
      missatge: `No hi ha mapeig per «${centreText}». Afegeix-lo a Configuració → Balanç esdeveniments.`,
    };
  }

  if (fets.length === 0) {
    return { ok: false, missatge: errors.join(" ") || "No s'han trobat dades de detall." };
  }

  const nodes = [...new Set(fets.map((f) => f.node))];
  const conceptes = await db.concepteResultat.findMany({
    where: { node: { in: nodes } },
    select: { id: true, node: true },
  });
  const concepteIdByNode = new Map(conceptes.map((c) => [c.node, c.id]));
  const nodesFaltants = nodes.filter((n) => !concepteIdByNode.has(n));
  if (nodesFaltants.length > 0) {
    return {
      ok: false,
      missatge: `Falten conceptes al compte de resultats: nodes ${nodesFaltants.join(", ")}.`,
    };
  }

  const periodIdByMes = new Map<number, string>();
  await Promise.all(
    mesosDetectats.map(async (mes) => {
      periodIdByMes.set(mes, await upsertPeriode(any, mes));
    })
  );
  const periodIds = [...periodIdByMes.values()];

  await db.ajust.deleteMany({
    where: {
      centreId: desti.centreId,
      liniaNegociId: null,
      periodId: { in: periodIds },
      motiu: MOTIU_REGULARITZACIO,
    },
  });

  const rows = fets
    .map((f) => {
      const concepteResultatId = concepteIdByNode.get(f.node);
      const periodId = periodIdByMes.get(f.mes);
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

  const primerMes = mesosDetectats[0];
  const refPeriodId =
    (primerMes !== undefined ? periodIdByMes.get(primerMes) : null) ?? periodIds[0] ?? null;

  await db.importacio.update({
    where: { id: imp.id },
    data: {
      estat: "CLASSIFICAT",
      periodId: refPeriodId,
      liniaNegociId: desti.liniaNegociId,
      notes: [
        imp.nomFitxer,
        `Centre ${desti.centreCodi} · ${desti.centreNom} (mapeig «${desti.textMapeig}»)`,
        titolBloc ? `bloc ${titolBloc}` : null,
        `${rows.length} ajustos Regularització`,
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
  if (etiquetesNoMapades.length > 0) {
    const mostra = etiquetesNoMapades.slice(0, 5).join("; ");
    const extra = etiquetesNoMapades.length > 5 ? ` (+${etiquetesNoMapades.length - 5} més)` : "";
    avis += ` Etiquetes ignorades: ${mostra}${extra}.`;
  }
  if (avisos.length > 0) avis += ` ${avisos.join(" ")}`;

  const mesosLabel = mesosDetectats.map((m) => MESOS_NOMS[m]).join(", ");

  return {
    ok: true,
    missatge: `${mesosDetectats.length} mesos (${mesosLabel}) · ${rows.length} ajustos Regularització · ${desti.centreCodi} · ${desti.centreNom} · exercici ${any}.${avis}`,
  };
}
