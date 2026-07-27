"use server";

import { auth } from "@/lib/auth";
import {
  ensureNormesRepartimentInicials,
  reiniciarAmbNormesSeed,
  resetNormesRepartiment,
} from "@/lib/repartiment/normes-default";
import { revalidatePath } from "next/cache";

async function requireEditor() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "EDICIO")) {
    return null;
  }
  return session.user;
}

export async function inicialitzarNormesAction() {
  const user = await requireEditor();
  if (!user) return { ok: false, missatge: "Sense permisos." };
  const res = await ensureNormesRepartimentInicials();
  revalidatePath("/settings/repartiment");
  revalidatePath("/dades/repartiment");
  return res;
}

export async function carregarNormesSeedAction() {
  const user = await requireEditor();
  if (!user) return { ok: false, missatge: "Sense permisos." };
  const res = await reiniciarAmbNormesSeed();
  revalidatePath("/settings/repartiment");
  revalidatePath("/dades/repartiment");
  return res;
}

export async function esborrarTotRepartimentAction() {
  const user = await requireEditor();
  if (!user) return { ok: false, missatge: "Sense permisos." };
  const res = await resetNormesRepartiment();
  revalidatePath("/settings/repartiment");
  revalidatePath("/dades/repartiment");
  return res;
}

export async function toggleNormaAction(id: string, actiu: boolean) {
  const user = await requireEditor();
  if (!user) return { ok: false, missatge: "Sense permisos." };
  const { db } = await import("@/lib/db");
  await db.normaRepartiment.update({ where: { id }, data: { actiu } });
  revalidatePath("/settings/repartiment");
  return { ok: true, missatge: actiu ? "Norma activada." : "Norma desactivada." };
}

export async function updateNormaAction(
  id: string,
  data: {
    nom?: string | null;
    ordre?: number;
    valorPercent?: number | null;
    valorImport?: number | null;
  }
) {
  const user = await requireEditor();
  if (!user) return { ok: false, missatge: "Sense permisos." };

  const { db } = await import("@/lib/db");
  const norma = await db.normaRepartiment.findUnique({ where: { id } });
  if (!norma) return { ok: false, missatge: "Norma no trobada." };

  const patch: {
    nom?: string | null;
    ordre?: number;
    valorPercent?: number | null;
    valorImport?: number | null;
  } = {};

  if (data.nom !== undefined) {
    patch.nom = data.nom?.trim() || null;
  }
  if (data.ordre !== undefined) {
    if (!Number.isFinite(data.ordre)) {
      return { ok: false, missatge: "L'ordre ha de ser un número." };
    }
    patch.ordre = Math.round(data.ordre);
  }
  if (data.valorPercent !== undefined) {
    patch.valorPercent = data.valorPercent;
  }
  if (data.valorImport !== undefined) {
    patch.valorImport = data.valorImport;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: true, missatge: "Sense canvis." };
  }

  await db.normaRepartiment.update({ where: { id }, data: patch });
  revalidatePath("/settings/repartiment");
  revalidatePath("/dades/repartiment");
  return { ok: true, missatge: "Norma actualitzada." };
}
