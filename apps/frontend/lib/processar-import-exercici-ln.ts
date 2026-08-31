import { revalidateConsultesDades } from "@/lib/consultes-cache";
import { db } from "@/lib/db";
import { parsePygExerciciLn } from "@/lib/excel-parsers/pyg-exercici-ln";
import { ensureConceptesCompteBase } from "@/lib/fdlc/conceptes-base";
import { revalidatePath } from "next/cache";

const MESOS_NOMS: Record<number, string> = {
  1: "Gener",
  2: "Febrer",
  3: "Març",
  4: "Abril",
  5: "Maig",
  6: "Juny",
  7: "Juliol",
  8: "Agost",
  9: "Setembre",
  10: "Octubre",
  11: "Novembre",
  12: "Desembre",
};

type ImportWithRelations = {
  id: string;
  nomFitxer: string;
  rutaStorage: string | null;
  periodId: string | null;
  liniaNegociId: string | null;
  period: { mes: number; any: number } | null;
  liniaNegoci: { id: string; codi: string; nom: string } | null;
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
 * Importa un P&L històric anual per LN (Hoja1, Gener…Desembre) com a Directe.
 * No crea ni confirma repartiment.
 */
export async function processarImportExerciciLn(
  imp: ImportWithRelations,
  fitxer: Buffer
): Promise<{ ok: boolean; missatge: string }> {
  const anyMatch = imp.nomFitxer.match(/20\d{2}/)?.[0];
  const anyFallback = imp.period?.any ?? (anyMatch ? Number(anyMatch) : null);

  if (!imp.liniaNegociId) {
    return {
      ok: false,
      missatge:
        "Cal assignar la línia de negoci abans de processar (p.ex. Casaments LN00003 o Central LN00000).",
    };
  }
  const liniaNegociId = imp.liniaNegociId;

  await ensureConceptesCompteBase();

  const { fets, mesosDetectats, anyDetectat, titolBloc, errors, avisos, etiquetesNoMapades } =
    parsePygExerciciLn(fitxer, anyFallback);

  const any = anyDetectat ?? anyFallback;
  if (!any) {
    return {
      ok: false,
      missatge: "Cal indicar l'exercici (any) abans de processar un PyG històric LN.",
    };
  }

  if (fets.length === 0) {
    return { ok: false, missatge: errors.join(" ") || "No s'han trobat dades." };
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

  // Substitueix només fets d'aquest format + LN + mesos (no toca SAP mensual ni FDLC).
  await db.dadaResultat.deleteMany({
    where: {
      liniaNegociId,
      periodId: { in: periodIds },
      importacio: { formatInforme: { tipusInforme: "PYG_EXERCICI_LN" } },
    },
  });
  await db.dadaResultat.deleteMany({ where: { importacioId: imp.id } });

  const allRows = fets
    .map((f) => {
      const concepteResultatId = concepteIdByNode.get(f.node);
      const periodId = periodIdByMes.get(f.mes);
      if (!concepteResultatId || !periodId) return null;
      return {
        importacioId: imp.id,
        periodId,
        concepteResultatId,
        centreId: null,
        liniaNegociId,
        senseCentre: true,
        import_: f.valor,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const BATCH = 500;
  for (let i = 0; i < allRows.length; i += BATCH) {
    await db.dadaResultat.createMany({ data: allRows.slice(i, i + BATCH) });
  }

  const primerMes = mesosDetectats[0];
  const refPeriodId =
    (primerMes !== undefined ? periodIdByMes.get(primerMes) : null) ?? periodIds[0];

  await db.importacio.update({
    where: { id: imp.id },
    data: { estat: "CLASSIFICAT", periodId: refPeriodId },
  });

  revalidateConsultesDades();
  revalidatePath(`/dades/${imp.id}`);
  revalidatePath("/dades");
  revalidatePath("/consultes/empresa");
  revalidatePath("/consultes/linia");
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
  const lnLabel = imp.liniaNegoci
    ? `${imp.liniaNegoci.codi} · ${imp.liniaNegoci.nom}`
    : liniaNegociId;
  const bloc = titolBloc ? ` · bloc «${titolBloc}»` : "";

  return {
    ok: true,
    missatge: `${mesosDetectats.length} mesos (${mesosLabel}) · ${allRows.length} fets · exercici ${any} · ${lnLabel}${bloc}.${avis}`,
  };
}
