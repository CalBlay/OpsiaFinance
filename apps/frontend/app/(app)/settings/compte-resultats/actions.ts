"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

type Result = { ok: boolean; missatge: string };
const OK = (m = ""): Result => ({ ok: true, missatge: m });
const ERR = (m: string): Result => ({ ok: false, missatge: m });

async function requireEditor(): Promise<boolean> {
  const session = await auth();
  const role = session?.user?.role;
  return role === "ADMIN" || role === "EDICIO";
}

function refresh() {
  revalidatePath("/settings/compte-resultats");
  revalidatePath("/consultes/centre");
  revalidatePath("/consultes/linia");
}

export async function createConcepteAction(
  node: number,
  descripcio: string,
  esSubtotal: boolean
): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");
  if (!Number.isInteger(node)) return ERR("El node ha de ser un número enter.");
  const desc = descripcio.trim();
  if (!desc) return ERR("La descripció és obligatòria.");
  const max = await db.concepteResultat.aggregate({ _max: { ordre: true } });
  try {
    await db.concepteResultat.create({
      data: { node, descripcio: desc, esSubtotal, ordre: (max._max.ordre ?? -1) + 1 },
    });
  } catch {
    return ERR(`Ja existeix un concepte amb el node ${node}.`);
  }
  refresh();
  return OK();
}

export async function updateConcepteAction(
  id: string,
  descripcio: string,
  esSubtotal: boolean
): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");
  await db.concepteResultat.update({
    where: { id },
    data: { descripcio: descripcio.trim(), esSubtotal },
  });
  refresh();
  return OK();
}

export async function toggleConcepteAction(id: string, isActive: boolean): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");
  await db.concepteResultat.update({ where: { id }, data: { isActive } });
  refresh();
  return OK();
}

export async function moveConcepteAction(id: string, direccio: "up" | "down"): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");
  const tots = await db.concepteResultat.findMany({
    orderBy: { ordre: "asc" },
    select: { id: true, ordre: true },
  });
  const idx = tots.findIndex((c) => c.id === id);
  if (idx === -1) return ERR("Concepte no trobat.");
  const swapIdx = direccio === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= tots.length) return OK();

  const a = tots[idx];
  const b = tots[swapIdx];
  await db.$transaction([
    db.concepteResultat.update({ where: { id: a.id }, data: { ordre: b.ordre } }),
    db.concepteResultat.update({ where: { id: b.id }, data: { ordre: a.ordre } }),
  ]);
  refresh();
  return OK();
}

export async function deleteConcepteAction(id: string): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");
  const dades = await db.dadaResultat.count({ where: { concepteResultatId: id } });
  if (dades > 0) return ERR("No es pot eliminar: té dades associades. Desactiva'l millor.");
  await db.concepteResultat.delete({ where: { id } });
  refresh();
  return OK();
}
