"use server";

import { unlink } from "node:fs/promises";
import { auth } from "@/lib/auth";
import { revalidateConsultesDades } from "@/lib/consultes-cache";
import { db } from "@/lib/db";
import { processarImportExcel } from "@/lib/processar-import";
import type { EstatImport } from "@/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/** Corregeix el valor import_ d'una DadaResultat concreta. */
export async function updateDadaResultatImportAction(
  dadaId: string,
  nouValor: number
): Promise<{ ok: boolean; missatge: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, missatge: "No autenticat." };
  if (!["ADMIN", "EDICIO"].includes(session.user.role ?? ""))
    return { ok: false, missatge: "Sense permís." };
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

export async function eliminarImportAction(
  importId: string,
  options: { redirect: boolean } = { redirect: true }
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;

  const imp = await db.importacio.findUnique({
    where: { id: importId },
    select: { rutaStorage: true },
  });

  if (!imp) return;

  if (imp.rutaStorage) {
    try {
      await unlink(imp.rutaStorage);
    } catch {
      /* ja no existia */
    }
  }

  await db.importacio.delete({ where: { id: importId } });

  revalidatePath("/dades");
  if (options.redirect) redirect("/dades");
}

export async function updateEstatImportAction(
  importId: string,
  nouEstat: EstatImport
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;

  const data: Record<string, unknown> = { estat: nouEstat };
  if (nouEstat === "CONFIRMAT") data.confirmatAt = new Date();

  await db.importacio.update({ where: { id: importId }, data });
  revalidatePath(`/dades/${importId}`);
  revalidatePath("/dades");
}

export async function processarExcelAction(
  importId: string
): Promise<{ ok: boolean; missatge: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, missatge: "No autenticat." };
  if (!["ADMIN", "EDICIO"].includes(session.user.role ?? ""))
    return { ok: false, missatge: "Sense permís." };
  return processarImportExcel(importId);
}
