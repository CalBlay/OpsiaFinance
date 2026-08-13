"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { inferDepartamentSalarial } from "@/lib/traspass-personal/departament";
import {
  ensureConfigTraspassPersonal,
  importarMapeigCentresDesDeBuffer,
} from "@/lib/traspass-personal/service";
import type { DepartamentSalarial } from "@prisma/client";
import { revalidatePath } from "next/cache";

type Result = { ok: boolean; missatge: string };
const OK = (missatge = ""): Result => ({ ok: true, missatge });
const ERR = (missatge: string): Result => ({ ok: false, missatge });

export type MapeigTraspassInput = {
  id?: string;
  text: string;
  liniaNegociId: string;
  centreId: string;
  departamentId: string | null;
};

async function requireEditor(): Promise<boolean> {
  const session = await auth();
  const role = session?.user?.role;
  return role === "ADMIN" || role === "EDICIO";
}

function refresh() {
  revalidatePath("/settings/traspass-personal");
  revalidatePath("/dades/traspass-personal");
}

/** Valida LN → centre → departament i desa el mapeig (igual que cost personal). */
async function desarMapeig(input: MapeigTraspassInput): Promise<Result> {
  const t = input.text.trim();
  if (!t) return ERR("El text és obligatori.");
  if (!input.liniaNegociId) return ERR("Selecciona una línia de negoci.");
  if (!input.centreId) return ERR("Selecciona un centre.");

  const centre = await db.centre.findUnique({
    where: { id: input.centreId },
    select: { id: true, liniaNegociId: true, isActive: true },
  });
  if (!centre?.isActive) return ERR("Centre no trobat.");
  if (centre.liniaNegociId !== input.liniaNegociId) {
    return ERR("El centre no pertany a la línia seleccionada.");
  }

  const departamentId = input.departamentId?.trim() || null;
  let departament: DepartamentSalarial | null = inferDepartamentSalarial(t);

  if (departamentId) {
    const dept = await db.departament.findUnique({
      where: { id: departamentId },
      select: { id: true, centreId: true, nom: true, isActive: true },
    });
    if (!dept?.isActive) return ERR("Departament no trobat a l'arbre de dimensions.");
    if (dept.centreId !== input.centreId) {
      return ERR("El departament no pertany al centre seleccionat.");
    }
    departament = inferDepartamentSalarial(dept.nom) ?? departament;
  }

  if (!departament) departament = "SALA";

  try {
    if (input.id) {
      await db.mapeigTextCentreTreball.update({
        where: { id: input.id },
        data: { text: t, centreId: input.centreId, departamentId, departament },
      });
      refresh();
      return OK("Mapeig actualitzat.");
    }
    await db.mapeigTextCentreTreball.create({
      data: { text: t, centreId: input.centreId, departamentId, departament },
    });
    refresh();
    return OK("Mapeig afegit.");
  } catch {
    return ERR(
      input.id ? "No s'ha pogut actualitzar (text duplicat?)." : "Aquest text ja existeix."
    );
  }
}

export async function updateTarifaHoraAction(
  tarifaHora: number,
  aplicarA: "tots" | "nous" = "nous"
): Promise<Result> {
  if (!(await requireEditor())) return ERR("No tens permisos.");
  if (!Number.isFinite(tarifaHora) || tarifaHora <= 0) return ERR("Tarifa no vàlida.");

  const tarifa = Math.round(tarifaHora * 100) / 100;
  await ensureConfigTraspassPersonal();
  await db.configTraspassPersonal.update({
    where: { id: "default" },
    data: { tarifaHora: tarifa },
  });

  let actualitzats = 0;
  if (aplicarA === "tots") {
    const moviments = await db.movimentTraspassPersonal.findMany({
      select: { id: true, hores: true },
    });
    for (const m of moviments) {
      const hores = Number(m.hores);
      const import_ = Math.round(hores * tarifa * 100) / 100;
      await db.movimentTraspassPersonal.update({
        where: { id: m.id },
        data: { tarifaHora: tarifa, import_ },
      });
      actualitzats++;
    }
  }

  refresh();
  revalidatePath("/consultes/cost-salarial");
  revalidatePath("/dades/cost-salarial");

  if (aplicarA === "tots") {
    return OK(
      `Tarifa ${tarifa.toFixed(2).replace(".", ",")} €/h desada i aplicada a ${actualitzats} moviment(s) ja carregats.`
    );
  }
  return OK(
    `Tarifa ${tarifa.toFixed(2).replace(".", ",")} €/h desada. Només s'aplicarà als nous fitxers.`
  );
}

export async function createMapeigAction(input: MapeigTraspassInput): Promise<Result> {
  if (!(await requireEditor())) return ERR("No tens permisos.");
  return desarMapeig(input);
}

export async function updateMapeigAction(input: MapeigTraspassInput): Promise<Result> {
  if (!(await requireEditor())) return ERR("No tens permisos.");
  if (!input.id) return ERR("Falta l'identificador.");
  return desarMapeig(input);
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
