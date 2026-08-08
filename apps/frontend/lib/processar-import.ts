import { revalidateConsultesDades } from "@/lib/consultes-cache";
import { db } from "@/lib/db";
import { parseCompteResultats, periodeDesDelNomFitxer } from "@/lib/excel-parsers/compte-resultats";
import { resolveLiniaNegociImport } from "@/lib/linia-informe";
import { codiLnDelNomFitxer } from "@/lib/nom-fitxer";
import { processarImportFdlc } from "@/lib/processar-import-fdlc";
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

/** Processa un Excel ja desat al disc i carrega les dades a la BBDD. */
export async function processarImportExcel(
  importId: string
): Promise<{ ok: boolean; missatge: string }> {
  const imp = await db.importacio.findUnique({
    where: { id: importId },
    include: {
      period: true,
      liniaNegoci: { select: { id: true, codi: true, nom: true } },
      formatInforme: { select: { tipusInforme: true } },
    },
  });

  if (!imp) return { ok: false, missatge: "Importació no trobada." };
  if (!imp.rutaStorage)
    return { ok: false, missatge: "Fitxer no disponible al servidor. Puja'l de nou." };

  const liniaNegociIdImport = imp.liniaNegociId;

  if (imp.formatInforme?.tipusInforme === "PYG_FDLC") {
    return processarImportFdlc(imp);
  }

  let periodId = imp.periodId;
  if (!periodId) {
    const p = periodeDesDelNomFitxer(imp.nomFitxer);
    if (!p)
      return {
        ok: false,
        missatge: "Sense període assignat i no s'ha pogut deduir del nom del fitxer.",
      };
    const period = await db.period.upsert({
      where: { any_mes: { any: p.any, mes: p.mes } },
      update: {},
      create: { any: p.any, mes: p.mes, nom: `${MESOS_NOMS[p.mes]} ${p.any}` },
    });
    periodId = period.id;
    await db.importacio.update({ where: { id: importId }, data: { periodId } });
  }

  const { concepts, columnes, fets, errors } = parseCompteResultats(imp.rutaStorage);
  if (fets.length === 0) {
    return { ok: false, missatge: `No s'han trobat dades. ${errors.join(" ")}` };
  }

  const concepteIdByNode = new Map<number, string>();
  await Promise.all(
    concepts.map(async (c) => {
      const cr = await db.concepteResultat.upsert({
        where: { node: c.node },
        update: { descripcio: c.descripcio, esSubtotal: c.esSubtotal, ordre: c.ordre },
        create: {
          node: c.node,
          descripcio: c.descripcio,
          esSubtotal: c.esSubtotal,
          ordre: c.ordre,
        },
      });
      concepteIdByNode.set(c.node, cr.id);
    })
  );

  interface ColMap {
    centreId: string | null;
    liniaNegociId: string | null;
    senseCentre: boolean;
    isLnColumna: boolean;
    codi: string | null;
  }
  const colMap = new Map<number, ColMap>();
  const codisNoTrobats: string[] = [];

  const codisCol = [
    ...new Set(columnes.filter((c) => !c.senseCentre && c.codi).map((c) => c.codi as string)),
  ];

  const [centres, lns] = await Promise.all([
    codisCol.length
      ? db.centre.findMany({
          where: { codi: { in: codisCol } },
          select: { id: true, codi: true, liniaNegociId: true },
        })
      : Promise.resolve([] as { id: string; codi: string; liniaNegociId: string }[]),
    codisCol.length
      ? db.liniaNegoci.findMany({
          where: { codi: { in: codisCol } },
          select: { id: true, codi: true },
        })
      : Promise.resolve([] as { id: string; codi: string }[]),
  ]);

  // Preferència: centre de la LN de l'informe si n'hi ha diversos amb el mateix codi.
  const centreByCodi = new Map<string, { id: string; liniaNegociId: string }>();
  for (const c of centres) {
    const prev = centreByCodi.get(c.codi);
    if (!prev) {
      centreByCodi.set(c.codi, c);
    } else if (liniaNegociIdImport && c.liniaNegociId === liniaNegociIdImport) {
      centreByCodi.set(c.codi, c);
    }
  }
  const lnByCodi = new Map(lns.map((l) => [l.codi, l.id]));

  for (const col of columnes) {
    if (col.senseCentre || !col.codi) {
      colMap.set(col.colIdx, {
        centreId: null,
        liniaNegociId: null,
        senseCentre: true,
        isLnColumna: false,
        codi: col.codi,
      });
      continue;
    }
    const centre = centreByCodi.get(col.codi);
    if (centre) {
      colMap.set(col.colIdx, {
        centreId: centre.id,
        liniaNegociId: centre.liniaNegociId,
        senseCentre: false,
        isLnColumna: false,
        codi: col.codi,
      });
      continue;
    }
    const lnId = lnByCodi.get(col.codi);
    if (lnId) {
      colMap.set(col.colIdx, {
        centreId: null,
        liniaNegociId: lnId,
        senseCentre: false,
        isLnColumna: true,
        codi: col.codi,
      });
      continue;
    }
    codisNoTrobats.push(col.codi);
    colMap.set(col.colIdx, {
      centreId: null,
      liniaNegociId: null,
      senseCentre: false,
      isLnColumna: false,
      codi: col.codi,
    });
  }

  await db.dadaResultat.deleteMany({ where: { importacioId: importId } });

  const allRows = fets
    .map((f) => {
      const concepteResultatId = concepteIdByNode.get(f.node);
      const col = colMap.get(f.colIdx);
      if (!concepteResultatId || !col || !periodId) return null;
      return {
        importacioId: importId,
        periodId,
        concepteResultatId,
        centreId: col.centreId,
        liniaNegociId: resolveLiniaNegociImport(col, imp.liniaNegociId),
        senseCentre: col.senseCentre,
        import_: f.valor,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const BATCH = 500;
  for (let i = 0; i < allRows.length; i += BATCH) {
    await db.dadaResultat.createMany({ data: allRows.slice(i, i + BATCH) });
  }

  await db.importacio.update({ where: { id: importId }, data: { estat: "CLASSIFICAT" } });
  revalidateConsultesDades();
  revalidatePath(`/dades/${importId}`);
  revalidatePath("/dades");
  revalidatePath("/consultes/empresa");
  revalidatePath("/consultes/linia");
  revalidatePath("/consultes/centre");
  revalidatePath("/consultes/evolucio");
  revalidatePath("/consultes/comparativa");

  const avis = codisNoTrobats.length
    ? ` Atenció: ${codisNoTrobats.length} codis de columna no s'han trobat a l'arbre (${[...new Set(codisNoTrobats)].join(", ")}). Importa l'arbre de dimensions o actualitza l'Excel; les dades es compten a la LN de l'informe però no es desglossen per centre.`
    : "";

  const lnComptador = new Map<string, number>();
  if (imp.liniaNegociId) {
    const colsCentre = columnes.filter((col) => !col.senseCentre && col.codi).length;
    if (colsCentre > 0) lnComptador.set(imp.liniaNegociId, colsCentre);
  } else {
    for (const col of columnes) {
      if (col.senseCentre || !col.codi) continue;
      const m = colMap.get(col.colIdx);
      if (m?.liniaNegociId) {
        lnComptador.set(m.liniaNegociId, (lnComptador.get(m.liniaNegociId) ?? 0) + 1);
      }
    }
  }
  let lnDominantId: string | null = null;
  let maxCols = 0;
  for (const [id, count] of lnComptador) {
    if (count > maxCols) {
      maxCols = count;
      lnDominantId = id;
    }
  }

  let avisLn = "";
  if (!imp.liniaNegociId && lnDominantId) {
    const dominant = await db.liniaNegoci.findUnique({
      where: { id: lnDominantId },
      select: { codi: true, nom: true },
    });
    if (dominant) {
      avisLn = ` Assigneu la línia de negoci de l'informe (${dominant.codi} · ${dominant.nom}) a la fitxa de classificació.`;
    }
  }

  const codiLnNom = codiLnDelNomFitxer(imp.nomFitxer);
  if (codiLnNom && imp.liniaNegoci && codiLnNom !== imp.liniaNegoci.codi) {
    avisLn += ` El nom del fitxer («${imp.nomFitxer}») indica ${codiLnNom}.`;
  }

  return {
    ok: true,
    missatge: `${allRows.length} dades importades · ${concepts.length} conceptes · ${columnes.length} columnes.${avis}${avisLn}`,
  };
}
