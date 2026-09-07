"use server";

import { auth } from "@/lib/auth";
import { revalidateConsultesDades } from "@/lib/consultes-cache";
import { db } from "@/lib/db";
import { generaCodiCategoria } from "@/lib/pressupost/partida-catalog";
import { slugCategoria } from "@/lib/pressupost/tipus-b";
import { potEditar } from "@/lib/roles";
import { revalidatePath } from "next/cache";

type Result = { ok: boolean; missatge: string; id?: string };
const OK = (m = "", id?: string): Result => ({ ok: true, missatge: m, id });
const ERR = (m: string): Result => ({ ok: false, missatge: m });

async function requireEditor() {
  const session = await auth();
  const role = session?.user?.role;
  if (!potEditar(role)) return null;
  return session;
}

function refresh() {
  revalidateConsultesDades();
  revalidatePath("/dades/pressupost-categories");
  revalidatePath("/dades/pressupost-partides");
  revalidatePath("/pressupost/departaments");
}

export type UpsertCategoriaCatalogInput = {
  id?: string;
  codi?: string;
  nom: string;
  notes?: string;
  totsDepartaments: boolean;
  isActive: boolean;
  departamentIds: string[];
};

export async function upsertCategoriaCatalogAction(
  input: UpsertCategoriaCatalogInput
): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");

  const nom = input.nom.trim();
  if (!nom) return ERR("Cal un nom de categoria.");

  let codi = (input.codi?.trim() || generaCodiCategoria(nom)).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{0,47}$/.test(codi)) {
    return ERR("Codi no vàlid (lletres, números, - _).");
  }

  // Clau estable d’agregació a les línies de pressupost
  const key = slugCategoria(codi);

  if (!input.totsDepartaments && input.departamentIds.length === 0) {
    return ERR("Marca «Tots els departaments» o selecciona’n almenys un.");
  }

  const deptIds = input.totsDepartaments ? [] : [...new Set(input.departamentIds.filter(Boolean))];

  if (deptIds.length) {
    const n = await db.departament.count({
      where: { id: { in: deptIds }, isActive: true },
    });
    if (n !== deptIds.length) return ERR("Algun departament no és vàlid.");
  }

  try {
    if (input.id) {
      const existent = await db.pressupostPartidaCatalog.findUnique({
        where: { id: input.id },
        select: { id: true },
      });
      if (!existent) return ERR("Categoria no trobada.");

      const partidaId = input.id;
      await db.$transaction(async (tx) => {
        await tx.pressupostPartidaCatalog.update({
          where: { id: partidaId },
          data: {
            codi,
            nom,
            categoria: key,
            notes: input.notes?.trim() || null,
            totsDepartaments: input.totsDepartaments,
            isActive: input.isActive,
          },
        });
        await tx.pressupostPartidaCatalogDept.deleteMany({
          where: { partidaId },
        });
        if (deptIds.length) {
          await tx.pressupostPartidaCatalogDept.createMany({
            data: deptIds.map((departamentId) => ({
              partidaId,
              departamentId,
            })),
          });
        }
      });
      refresh();
      return OK("Categoria actualitzada.", partidaId);
    }

    const xoc = await db.pressupostPartidaCatalog.findUnique({
      where: { codi },
      select: { id: true },
    });
    if (xoc) {
      codi = `${codi}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    }

    const maxOrdre = await db.pressupostPartidaCatalog.aggregate({
      _max: { ordre: true },
    });

    const creat = await db.pressupostPartidaCatalog.create({
      data: {
        codi,
        nom,
        categoria: slugCategoria(codi),
        notes: input.notes?.trim() || null,
        totsDepartaments: input.totsDepartaments,
        isActive: input.isActive,
        ordre: (maxOrdre._max.ordre ?? 0) + 1,
        depts: deptIds.length
          ? { create: deptIds.map((departamentId) => ({ departamentId })) }
          : undefined,
      },
      select: { id: true },
    });
    refresh();
    return OK("Categoria creada.", creat.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desant.";
    if (msg.includes("Unique") || msg.includes("unique")) {
      return ERR("Aquest codi ja existeix.");
    }
    return ERR(msg);
  }
}

export async function setActivaCategoriaCatalogAction(
  id: string,
  isActive: boolean
): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");
  await db.pressupostPartidaCatalog.update({
    where: { id },
    data: { isActive },
  });
  refresh();
  return OK(isActive ? "Categoria activada." : "Categoria desactivada.");
}

export async function deleteCategoriaCatalogAction(id: string): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");

  const enUs = await db.pressupostLiniaDept.findFirst({
    where: { partidaCatalogId: id },
    select: { id: true },
  });
  if (enUs) {
    return ERR("La categoria s’usa en pressupostos; desactiva-la en lloc d’eliminar-la.");
  }

  await db.pressupostPartidaCatalog.delete({ where: { id } });
  refresh();
  return OK("Categoria eliminada.");
}
