import { db } from "@/lib/db";
import { parsePygFdlc } from "@/lib/excel-parsers/pyg-fdlc";
import { FDLC_LN_CODI, ensureFdlcSetup } from "@/lib/fdlc/setup";
import { codiLnDelNomFitxer } from "@/lib/nom-fitxer";
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

export async function processarImportFdlc(
  imp: ImportWithRelations
): Promise<{ ok: boolean; missatge: string }> {
  if (!imp.rutaStorage)
    return { ok: false, missatge: "Fitxer no disponible al servidor. Puja'l de nou." };

  const anyMatch = imp.nomFitxer.match(/20\d{2}/)?.[0];
  const any = imp.period?.any ?? (anyMatch ? Number(anyMatch) : null);
  if (!any) {
    return { ok: false, missatge: "Cal indicar l'exercici (any) abans de processar un PyG FDLC." };
  }

  const { lnId } = await ensureFdlcSetup();

  let liniaNegociId = imp.liniaNegociId ?? lnId;
  if (imp.liniaNegociId && imp.liniaNegoci?.codi !== FDLC_LN_CODI) {
    return {
      ok: false,
      missatge: `El format PyG FDLC és només per a ${FDLC_LN_CODI}. Aquesta importació és de ${imp.liniaNegoci?.codi}.`,
    };
  }
  if (!imp.liniaNegociId) {
    liniaNegociId = lnId;
    await db.importacio.update({ where: { id: imp.id }, data: { liniaNegociId: lnId } });
  }

  const { fets, mesosDetectats, errors, avisos, comptesNoMapats } = parsePygFdlc(
    imp.rutaStorage,
    any
  );

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

  await db.dadaResultat.deleteMany({
    where: {
      liniaNegociId,
      periodId: { in: periodIds },
      importacio: { formatInforme: { tipusInforme: "PYG_FDLC" } },
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

  const primerMesDetectat = mesosDetectats[0];
  const refPeriodId =
    (primerMesDetectat !== undefined ? periodIdByMes.get(primerMesDetectat) : null) ?? periodIds[0];
  await db.importacio.update({
    where: { id: imp.id },
    data: { estat: "CLASSIFICAT", periodId: refPeriodId },
  });

  revalidatePath(`/dades/${imp.id}`);
  revalidatePath("/dades");
  revalidatePath("/consultes/empresa");
  revalidatePath("/consultes/centre");

  let avis = "";
  if (comptesNoMapats.length > 0) {
    const mostra = comptesNoMapats.slice(0, 5).join("; ");
    const extra = comptesNoMapats.length > 5 ? ` (+${comptesNoMapats.length - 5} més)` : "";
    avis += ` Comptes sense mapatge (ignorats): ${mostra}${extra}.`;
  }
  if (avisos.length > 0) avis += ` ${avisos.join(" ")}`;

  const codiLnNom = codiLnDelNomFitxer(imp.nomFitxer);
  if (codiLnNom && codiLnNom !== FDLC_LN_CODI) {
    avis += ` El nom del fitxer indica ${codiLnNom} (esperat ${FDLC_LN_CODI}).`;
  }

  const mesosLabel = mesosDetectats.map((m) => MESOS_NOMS[m]).join(", ");

  return {
    ok: true,
    missatge: `${mesosDetectats.length} mesos importats (${mesosLabel}) · ${allRows.length} conceptes · exercici ${any} · ${FDLC_LN_CODI}.${avis}`,
  };
}
