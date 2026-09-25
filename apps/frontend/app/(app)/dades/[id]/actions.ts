"use server";

import { MOTIU_REGULARITZACIO } from "@/lib/balanc-esdeveniments/nodes";
import { revalidateConsultesDades } from "@/lib/consultes-cache";
import { db } from "@/lib/db";
import { esborrarFitxerDisc } from "@/lib/import-file-storage";
import { processarImportExcel } from "@/lib/processar-import";
import { requireDadesEditor } from "@/lib/require-access";
import type { EstatImport } from "@/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/** Corregeix el valor import_ d'una DadaResultat concreta. */
export async function updateDadaResultatImportAction(
  dadaId: string,
  nouValor: number
): Promise<{ ok: boolean; missatge: string }> {
  const user = await requireDadesEditor();
  if (!user) return { ok: false, missatge: "Sense permís." };
  if (!Number.isFinite(nouValor)) return { ok: false, missatge: "Valor no vàlid." };

  const dada = await db.dadaResultat.findUnique({
    where: { id: dadaId },
    select: { id: true, importacioId: true },
  });
  if (!dada) return { ok: false, missatge: "Registre no trobat." };

  await db.dadaResultat.update({
    where: { id: dadaId },
    data: { import_: nouValor },
  });

  revalidateConsultesDades();
  revalidatePath(`/dades/${dada.importacioId}`);
  revalidatePath("/consultes/empresa");
  revalidatePath("/consultes/linia");
  revalidatePath("/consultes/centre");
  return { ok: true, missatge: "Valor actualitzat." };
}

function centreCodisDesDeNotes(notes: string | null | undefined): string[] {
  if (!notes) return [];
  return [
    ...new Set(
      [...notes.matchAll(/Centre\s+([A-Z]{2,3}\d+)/gi)]
        .map((m) => m[1]?.toUpperCase())
        .filter((c): c is string => Boolean(c))
    ),
  ];
}

export async function eliminarImportAction(
  importId: string,
  options: { redirect: boolean } = { redirect: true }
): Promise<void> {
  const user = await requireDadesEditor();
  if (!user) return;

  const imp = await db.importacio.findUnique({
    where: { id: importId },
    select: {
      rutaStorage: true,
      notes: true,
      period: { select: { any: true } },
      formatInforme: { select: { tipusInforme: true } },
    },
  });

  if (!imp) return;

  // Balanç esdeveniments: els ajustos no penjen de la importació → cal esborrar-los explícitament
  if (imp.formatInforme?.tipusInforme === "PYG_EXERCICI_CENTRE" && imp.period?.any) {
    const codis = centreCodisDesDeNotes(imp.notes);
    if (codis.length > 0) {
      await db.ajust.deleteMany({
        where: {
          motiu: MOTIU_REGULARITZACIO,
          centre: { codi: { in: codis } },
          period: { any: imp.period.any },
        },
      });
    }
  }

  if (imp.rutaStorage) {
    await esborrarFitxerDisc(imp.rutaStorage);
  }

  await db.importacio.delete({ where: { id: importId } });

  revalidatePath("/dades");
  revalidatePath("/dades/ajustos");
  revalidateConsultesDades();
  if (options.redirect) redirect("/dades");
}

export async function updateEstatImportAction(
  importId: string,
  nouEstat: EstatImport
): Promise<void> {
  const user = await requireDadesEditor();
  if (!user) return;

  const data: Record<string, unknown> = { estat: nouEstat };
  if (nouEstat === "CONFIRMAT") data.confirmatAt = new Date();

  await db.importacio.update({ where: { id: importId }, data });
  revalidatePath(`/dades/${importId}`);
  revalidatePath("/dades");
}

export async function processarExcelAction(
  importId: string
): Promise<{ ok: boolean; missatge: string }> {
  const user = await requireDadesEditor();
  if (!user) return { ok: false, missatge: "Sense permís." };
  return processarImportExcel(importId);
}
