"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  ensureConfigTraspassPersonal,
  importarMapeigCentresDesDeBuffer,
} from "@/lib/traspass-personal/service";
import { revalidatePath } from "next/cache";

type Result = { ok: boolean; missatge: string };
const OK = (missatge = ""): Result => ({ ok: true, missatge });
const ERR = (missatge: string): Result => ({ ok: false, missatge });

async function requireEditor(): Promise<boolean> {
  const session = await auth();
  const role = session?.user?.role;
  return role === "ADMIN" || role === "EDICIO";
}

function refresh() {
  revalidatePath("/settings/traspass-personal");
  revalidatePath("/dades/traspass-personal");
}

export async function updateTarifaHoraAction(tarifaHora: number): Promise<Result> {
  if (!(await requireEditor())) return ERR("No tens permisos.");
  if (!Number.isFinite(tarifaHora) || tarifaHora <= 0) return ERR("Tarifa no vàlida.");
  await ensureConfigTraspassPersonal();
  await db.configTraspassPersonal.update({
    where: { id: "default" },
    data: { tarifaHora },
  });
  refresh();
  return OK("Tarifa actualitzada.");
}

export async function createMapeigAction(text: string, centreId: string): Promise<Result> {
  if (!(await requireEditor())) return ERR("No tens permisos.");
  const t = text.trim();
  if (!t) return ERR("El text és obligatori.");
  if (!centreId) return ERR("Selecciona un centre.");
  try {
    await db.mapeigTextCentreTreball.create({ data: { text: t, centreId } });
    refresh();
    return OK("Mapeig afegit.");
  } catch {
    return ERR("Aquest text ja existeix.");
  }
}

export async function updateMapeigAction(
  id: string,
  text: string,
  centreId: string
): Promise<Result> {
  if (!(await requireEditor())) return ERR("No tens permisos.");
  const t = text.trim();
  if (!t || !centreId) return ERR("Omple tots els camps.");
  try {
    await db.mapeigTextCentreTreball.update({
      where: { id },
      data: { text: t, centreId },
    });
    refresh();
    return OK("Mapeig actualitzat.");
  } catch {
    return ERR("No s'ha pogut actualitzar (text duplicat?).");
  }
}

export async function deleteMapeigAction(id: string): Promise<Result> {
  if (!(await requireEditor())) return ERR("No tens permisos.");
  await db.mapeigTextCentreTreball.delete({ where: { id } });
  refresh();
  return OK("Mapeig eliminat.");
}

export async function importarMapeigExcelAction(formData: FormData): Promise<Result> {
  if (!(await requireEditor())) return ERR("No tens permisos.");

  const file = formData.get("fitxer");
  if (!(file instanceof File)) return ERR("Cap fitxer seleccionat.");

  const substituirTot = formData.get("substituirTot") === "true";

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { importats, errors } = await importarMapeigCentresDesDeBuffer(buffer, substituirTot);
    refresh();

    const base = `${importats} mapeigs importats/actualitzats.`;
    if (!errors.length) return OK(base);
    const mostra = errors.slice(0, 5).join(" ");
    const extra = errors.length > 5 ? ` (+${errors.length - 5} més)` : "";
    return OK(`${base} ${errors.length} avís(s): ${mostra}${extra}`);
  } catch (e) {
    return ERR(e instanceof Error ? e.message : "Error en importar.");
  }
}
