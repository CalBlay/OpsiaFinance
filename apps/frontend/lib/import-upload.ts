import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "@/lib/db";
import { FDLC_LN_CODI, ensureFdlcSetup } from "@/lib/fdlc/setup";
import { aliasLnDesDelNomFitxer, classificacioDesDelNomFitxer } from "@/lib/nom-fitxer";
import { processarImportExcel } from "@/lib/processar-import";
import { TIPUS_INFORME_LABELS, type TipusInforme } from "@/types";
import { revalidatePath } from "next/cache";

function esTipusExerciciAnual(tipus: TipusInforme | null | undefined): boolean {
  return tipus === "PYG_FDLC" || tipus === "PYG_EXERCICI_LN";
}

const MESOS: Record<number, string> = {
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

export type CreateImportState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; importId: string }
  | {
      status: "duplicate";
      existingId: string;
      existingName: string;
      existingPeriod: string;
      existingLn: string;
      suggestedName: string;
    };

export type BulkFileResult = {
  nom: string;
  periode: string;
  ln: string | null;
  ok: boolean;
  confirmat: boolean;
  missatge: string;
};

export type BulkImportState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; resultats: BulkFileResult[] };

const pad2 = (n: number) => String(n).padStart(2, "0");

function sufixLnDesDeCodi(codi: string): string {
  const digits = Number.parseInt(codi.replace(/\D/g, ""), 10);
  return String(digits).padStart(2, "0");
}

async function desarFitxer(id: string, ext: string, buffer: Buffer): Promise<string | undefined> {
  try {
    const uploadsDir = join(process.cwd(), "uploads");
    await mkdir(uploadsDir, { recursive: true });
    const filePath = join(uploadsDir, `${id}.${ext}`);
    await writeFile(filePath, buffer);
    return filePath;
  } catch {
    return undefined;
  }
}

async function nomFitxerUnic(desitjat: string): Promise<string> {
  const dot = desitjat.lastIndexOf(".");
  const base = dot > 0 ? desitjat.slice(0, dot) : desitjat;
  const ext = dot > 0 ? desitjat.slice(dot) : "";
  let candidat = desitjat;
  let n = 2;
  while (await db.importacio.findFirst({ where: { nomFitxer: candidat }, select: { id: true } })) {
    candidat = `${base} (${n})${ext}`;
    n++;
  }
  return candidat;
}

async function resoldreLiniaNegoci(
  liniaNegociId: string | null,
  nomFitxer: string,
  liniaNegociIdExistent: string | null = null,
  tipusInforme: TipusInforme | null = null
): Promise<{ id: string; label: string; codi: string } | { error: string }> {
  if (tipusInforme === "PYG_FDLC") {
    const { lnId } = await ensureFdlcSetup();
    const ln = await db.liniaNegoci.findUnique({
      where: { id: lnId },
      select: { id: true, codi: true, nom: true },
    });
    if (!ln) return { error: "No s'ha pogut preparar l'empresa FDLC." };

    const codiLnFitxer = classificacioDesDelNomFitxer(nomFitxer)?.codiLn ?? null;
    if (codiLnFitxer && codiLnFitxer !== FDLC_LN_CODI) {
      return {
        error: `El fitxer «${nomFitxer}» indica ${codiLnFitxer}, però PyG FDLC pertany a ${FDLC_LN_CODI} · ${ln.nom}.`,
      };
    }

    if (liniaNegociId && liniaNegociId !== lnId) {
      const seleccionada = await db.liniaNegoci.findUnique({
        where: { id: liniaNegociId },
        select: { codi: true, nom: true },
      });
      if (seleccionada && seleccionada.codi !== FDLC_LN_CODI) {
        return {
          error: `PyG FDLC és de l'empresa ${FDLC_LN_CODI} · ${ln.nom}, no de ${seleccionada.codi} · ${seleccionada.nom}.`,
        };
      }
    }

    return { id: ln.id, codi: ln.codi, label: `${ln.codi} · ${ln.nom}` };
  }

  const codiLnFitxer =
    classificacioDesDelNomFitxer(nomFitxer)?.codiLn ?? aliasLnDesDelNomFitxer(nomFitxer);

  let lnFromFile: { id: string; codi: string; nom: string } | null = null;
  if (codiLnFitxer) {
    lnFromFile = await db.liniaNegoci.findUnique({
      where: { codi: codiLnFitxer },
      select: { id: true, codi: true, nom: true },
    });
    if (!lnFromFile) {
      return {
        error: `No s'ha trobat «${codiLnFitxer}» (deduït de «${nomFitxer}») a l'arbre de dimensions.`,
      };
    }
  }

  let lnExistent: { id: string; codi: string; nom: string } | null = null;
  if (liniaNegociIdExistent) {
    lnExistent = await db.liniaNegoci.findUnique({
      where: { id: liniaNegociIdExistent },
      select: { id: true, codi: true, nom: true },
    });
  }

  if (liniaNegociId) {
    const ln = await db.liniaNegoci.findUnique({
      where: { id: liniaNegociId },
      select: { id: true, codi: true, nom: true },
    });
    if (!ln) return { error: "La línia de negoci seleccionada no existeix." };
    if (lnFromFile && lnFromFile.codi !== ln.codi) {
      return {
        error: `El fitxer «${nomFitxer}» indica ${lnFromFile.codi}, però has seleccionat ${ln.codi}. Reanomena el fitxer o corregeix la LN.`,
      };
    }
    return { id: ln.id, codi: ln.codi, label: `${ln.codi} · ${ln.nom}` };
  }

  if (lnFromFile && lnExistent && lnFromFile.codi !== lnExistent.codi) {
    return {
      error: `El fitxer «${nomFitxer}» és de ${lnFromFile.codi}, però aquesta importació és de ${lnExistent.codi}. Puja'l com a importació nova o assigna la LN correcta.`,
    };
  }

  if (lnFromFile) {
    return {
      id: lnFromFile.id,
      codi: lnFromFile.codi,
      label: `${lnFromFile.codi} · ${lnFromFile.nom}`,
    };
  }

  if (lnExistent) {
    return {
      id: lnExistent.id,
      codi: lnExistent.codi,
      label: `${lnExistent.codi} · ${lnExistent.nom}`,
    };
  }

  return {
    error:
      "Cal indicar la línia de negoci o incloure-la al nom del fitxer (p.ex. 01_2025_00 per a LN00000).",
  };
}

async function trobarImportDuplicada(
  periodId: string,
  liniaNegociId: string,
  formatInformeId: string
) {
  return db.importacio.findFirst({
    where: { periodId, liniaNegociId, formatInformeId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      nomFitxer: true,
      period: { select: { nom: true } },
      liniaNegoci: { select: { codi: true, nom: true } },
    },
  });
}

/** Importació anual (FDLC o històric LN): una per exercici. */
async function trobarImportExerciciPerAny(
  liniaNegociId: string,
  formatInformeId: string,
  any: number
) {
  return db.importacio.findFirst({
    where: {
      liniaNegociId,
      formatInformeId,
      OR: [{ period: { any } }, { dades: { some: { period: { any } } } }],
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      nomFitxer: true,
      period: { select: { nom: true, any: true } },
      liniaNegoci: { select: { codi: true, nom: true } },
    },
  });
}

export async function handleSingleImport(
  formData: FormData,
  userId: string
): Promise<CreateImportState> {
  const file = formData.get("file") as File | null;
  const tipusEnum = formData.get("formatInformeId") as TipusInforme | null;
  const anyStr = formData.get("any") as string;
  const mesStr = formData.get("mes") as string;
  const notes = formData.get("notes") as string | null;
  const mode = (formData.get("mode") as string) || "auto";
  const targetId = formData.get("targetId") as string | null;
  const newName = ((formData.get("newName") as string | null) ?? "").trim();
  const liniaNegociId = ((formData.get("liniaNegociId") as string | null) ?? "").trim() || null;

  if (!file || file.size === 0)
    return { status: "error", message: "Has de seleccionar un fitxer Excel." };
  if (!tipusEnum) return { status: "error", message: "Has de seleccionar el tipus d'informe." };
  if (!anyStr) return { status: "error", message: "Has d'indicar l'any (exercici)." };

  const esExerciciAnual = esTipusExerciciAnual(tipusEnum);
  const esFdlc = tipusEnum === "PYG_FDLC";
  if (!esExerciciAnual && !mesStr) {
    return { status: "error", message: "Has d'indicar l'any i el mes." };
  }

  const any = Number.parseInt(anyStr, 10);
  const mes = esExerciciAnual ? 1 : Number.parseInt(mesStr, 10);
  if (Number.isNaN(any) || Number.isNaN(mes) || mes < 1 || mes > 12)
    return { status: "error", message: "Any o mes no vàlids." };

  const extRaw = file.name.split(".").pop()?.toLowerCase();
  const ext = extRaw === "xlsx" || extRaw === "xls" ? extRaw : null;
  if (!ext) return { status: "error", message: "Només s'accepten fitxers Excel (.xlsx o .xls)." };

  const lnRes = await resoldreLiniaNegoci(liniaNegociId, file.name, null, tipusEnum);
  if ("error" in lnRes) return { status: "error", message: lnRes.error };

  const nomFormat = TIPUS_INFORME_LABELS[tipusEnum] ?? tipusEnum;
  const formatInforme = await db.formatInforme.upsert({
    where: { nom: nomFormat },
    update: {},
    create: { nom: nomFormat, tipusInforme: tipusEnum },
  });
  const period = await db.period.upsert({
    where: { any_mes: { any, mes } },
    update: {},
    create: { any, mes, nom: `${MESOS[mes]} ${any}` },
  });

  if (mode === "auto") {
    const existent = esExerciciAnual
      ? await trobarImportExerciciPerAny(lnRes.id, formatInforme.id, any)
      : await trobarImportDuplicada(period.id, lnRes.id, formatInforme.id);
    if (existent) {
      const suggestedName = await nomFitxerUnic(
        esFdlc
          ? `fdlc_${any}_${sufixLnDesDeCodi(lnRes.codi)}.${ext}`
          : esExerciciAnual
            ? `historic_${any}_${sufixLnDesDeCodi(lnRes.codi)}.${ext}`
            : `${pad2(mes)}_${any}_${sufixLnDesDeCodi(lnRes.codi)}.${ext}`
      );
      return {
        status: "duplicate",
        existingId: existent.id,
        existingName: existent.nomFitxer,
        existingPeriod: esExerciciAnual
          ? `Exercici ${any}`
          : (existent.period?.nom ?? "sense període"),
        existingLn: existent.liniaNegoci
          ? `${existent.liniaNegoci.codi} · ${existent.liniaNegoci.nom}`
          : "sense LN",
        suggestedName,
      };
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (mode === "update" && targetId) {
    const existent = await db.importacio.findUnique({
      where: { id: targetId },
      select: { id: true, liniaNegociId: true },
    });
    if (!existent)
      return { status: "error", message: "La importació que vols actualitzar ja no existeix." };

    const lnResUpdate = await resoldreLiniaNegoci(
      liniaNegociId,
      file.name,
      existent.liniaNegociId,
      tipusEnum
    );
    if ("error" in lnResUpdate) return { status: "error", message: lnResUpdate.error };

    await db.dadaResultat.deleteMany({ where: { importacioId: targetId } });
    const filePath = await desarFitxer(targetId, ext, buffer);

    await db.importacio.update({
      where: { id: targetId },
      data: {
        nomFitxer: file.name,
        mida: file.size,
        estat: "PENDENT",
        notes: notes || null,
        formatInformeId: formatInforme.id,
        periodId: period.id,
        liniaNegociId: lnResUpdate.id,
        ...(filePath ? { rutaStorage: filePath } : {}),
      },
    });

    revalidatePath("/dades");
    return { status: "success", importId: targetId };
  }

  let nomFitxer = file.name;
  if (mode === "create") {
    nomFitxer = await nomFitxerUnic(
      newName ||
        (esFdlc
          ? `fdlc_${any}_${sufixLnDesDeCodi(lnRes.codi)}.${ext}`
          : esExerciciAnual
            ? `historic_${any}_${sufixLnDesDeCodi(lnRes.codi)}.${ext}`
            : `${pad2(mes)}_${any}_${sufixLnDesDeCodi(lnRes.codi)}.${ext}`)
    );
  }

  const newImport = await db.importacio.create({
    data: {
      nomFitxer,
      mida: file.size,
      estat: "PENDENT",
      notes: notes || null,
      formatInformeId: formatInforme.id,
      periodId: period.id,
      liniaNegociId: lnRes.id,
      creatPer: userId,
    },
  });

  const filePath = await desarFitxer(newImport.id, ext, buffer);
  if (filePath) {
    await db.importacio.update({ where: { id: newImport.id }, data: { rutaStorage: filePath } });
  }

  revalidatePath("/dades");
  return { status: "success", importId: newImport.id };
}

export async function handleBulkFileItem(
  file: File,
  userId: string,
  tipusEnum: TipusInforme,
  politica: string,
  notes: string | null,
  liniaNegociIdFallback: string | null,
  autoConfirmar = true
): Promise<BulkFileResult> {
  try {
    const extRaw = file.name.split(".").pop()?.toLowerCase();
    const ext = extRaw === "xlsx" || extRaw === "xls" ? extRaw : null;
    if (!ext) {
      return {
        nom: file.name,
        periode: "—",
        ln: null,
        ok: false,
        confirmat: false,
        missatge: "Format no vàlid (només .xlsx/.xls).",
      };
    }

    const esExerciciAnual = esTipusExerciciAnual(tipusEnum);
    const parsed = classificacioDesDelNomFitxer(file.name);
    const anyMatch = file.name.match(/20\d{2}/)?.[0];
    const anyFitxer = parsed?.any ?? (anyMatch ? Number(anyMatch) : null);
    const mesFitxer = esExerciciAnual ? 1 : (parsed?.mes ?? null);

    if (
      !anyFitxer ||
      mesFitxer === null ||
      mesFitxer < 1 ||
      mesFitxer > 12 ||
      (!esExerciciAnual && !parsed)
    ) {
      return {
        nom: file.name,
        periode: "—",
        ln: null,
        ok: false,
        confirmat: false,
        missatge: esExerciciAnual
          ? "No s'ha pogut deduir l'any del nom. Inclou l'exercici (p.ex. 2024)."
          : "No s'ha pogut deduir el mes/any del nom. Reanomena'l (p.ex. 01_2026_00).",
      };
    }

    const lnRes =
      parsed?.codiLn || aliasLnDesDelNomFitxer(file.name)
        ? await resoldreLiniaNegoci(null, file.name, null, tipusEnum)
        : await resoldreLiniaNegoci(liniaNegociIdFallback, file.name, null, tipusEnum);
    if ("error" in lnRes) {
      return {
        nom: file.name,
        periode: "—",
        ln: null,
        ok: false,
        confirmat: false,
        missatge: lnRes.error,
      };
    }

    const nomFormat = TIPUS_INFORME_LABELS[tipusEnum] ?? tipusEnum;
    const formatInforme = await db.formatInforme.upsert({
      where: { nom: nomFormat },
      update: {},
      create: { nom: nomFormat, tipusInforme: tipusEnum },
    });

    const period = await db.period.upsert({
      where: { any_mes: { any: anyFitxer, mes: mesFitxer } },
      update: {},
      create: {
        any: anyFitxer,
        mes: mesFitxer,
        nom: `${MESOS[mesFitxer]} ${anyFitxer}`,
      },
    });
    const periodeLabel = esExerciciAnual
      ? `Exercici ${anyFitxer}`
      : `${MESOS[mesFitxer]} ${anyFitxer}`;

    const existent = esExerciciAnual
      ? await trobarImportExerciciPerAny(lnRes.id, formatInforme.id, anyFitxer)
      : await trobarImportDuplicada(period.id, lnRes.id, formatInforme.id);

    if (existent && politica === "ometre") {
      return {
        nom: file.name,
        periode: periodeLabel,
        ln: lnRes.label,
        ok: false,
        confirmat: false,
        missatge: `Omès: ja existia una importació per ${periodeLabel} · ${lnRes.label}.`,
      };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let importId: string;

    if (existent && politica === "actualitzar") {
      importId = existent.id;
      const lnResUpdate = await resoldreLiniaNegoci(
        parsed?.codiLn || aliasLnDesDelNomFitxer(file.name) ? null : liniaNegociIdFallback,
        file.name,
        (
          await db.importacio.findUnique({
            where: { id: importId },
            select: { liniaNegociId: true },
          })
        )?.liniaNegociId ?? null,
        tipusEnum
      );
      if ("error" in lnResUpdate) {
        return {
          nom: file.name,
          periode: periodeLabel,
          ln: lnRes.label,
          ok: false,
          confirmat: false,
          missatge: lnResUpdate.error,
        };
      }
      await db.dadaResultat.deleteMany({ where: { importacioId: importId } });
      const filePath = await desarFitxer(importId, ext, buffer);
      await db.importacio.update({
        where: { id: importId },
        data: {
          nomFitxer: file.name,
          mida: file.size,
          estat: "PENDENT",
          notes,
          formatInformeId: formatInforme.id,
          periodId: period.id,
          liniaNegociId: lnResUpdate.id,
          ...(filePath ? { rutaStorage: filePath } : {}),
        },
      });
    } else {
      const nomFitxer = existent ? await nomFitxerUnic(file.name) : file.name;
      const nova = await db.importacio.create({
        data: {
          nomFitxer,
          mida: file.size,
          estat: "PENDENT",
          notes,
          formatInformeId: formatInforme.id,
          periodId: period.id,
          liniaNegociId: lnRes.id,
          creatPer: userId,
        },
      });
      importId = nova.id;
      const filePath = await desarFitxer(importId, ext, buffer);
      if (filePath)
        await db.importacio.update({ where: { id: importId }, data: { rutaStorage: filePath } });
    }

    let res: { ok: boolean; missatge: string };
    try {
      res = await processarImportExcel(importId);
    } catch {
      res = { ok: false, missatge: "Error processant el fitxer." };
    }

    let confirmat = false;
    if (res.ok && autoConfirmar) {
      await db.importacio.update({
        where: { id: importId },
        data: { estat: "CONFIRMAT", confirmatAt: new Date() },
      });
      confirmat = true;
      revalidatePath(`/dades/${importId}`);
    }

    revalidatePath("/dades");
    const missatge = confirmat ? `${res.missatge} Importació confirmada.` : res.missatge;
    return {
      nom: file.name,
      periode: periodeLabel,
      ln: lnRes.label,
      ok: res.ok,
      confirmat,
      missatge,
    };
  } catch (err) {
    console.error(`handleBulkFileItem(${file.name}):`, err);
    return {
      nom: file.name,
      periode: "—",
      ln: null,
      ok: false,
      confirmat: false,
      missatge: "Error inesperat en pujar o processar aquest fitxer.",
    };
  }
}

export async function handleBulkImport(
  formData: FormData,
  userId: string
): Promise<BulkImportState> {
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const tipusEnum = formData.get("formatInformeId") as TipusInforme | null;
  const politica = (formData.get("politica") as string) || "versio";
  const notes = ((formData.get("notes") as string | null) ?? "").trim() || null;
  const liniaNegociIdFallback =
    ((formData.get("liniaNegociId") as string | null) ?? "").trim() || null;
  const autoConfirmar = formData.get("autoConfirmar") !== "false";

  if (files.length === 0)
    return { status: "error", message: "Has de seleccionar almenys un fitxer." };
  if (!tipusEnum) return { status: "error", message: "Has de seleccionar el tipus d'informe." };

  const resultats: BulkFileResult[] = [];
  for (const file of files) {
    resultats.push(
      await handleBulkFileItem(
        file,
        userId,
        tipusEnum,
        politica,
        notes,
        liniaNegociIdFallback,
        autoConfirmar
      )
    );
  }

  return { status: "done", resultats };
}
