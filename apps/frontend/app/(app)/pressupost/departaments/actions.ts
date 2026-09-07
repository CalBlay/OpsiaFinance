"use server";

import { auth } from "@/lib/auth";
import { revalidateConsultesDades } from "@/lib/consultes-cache";
import { db } from "@/lib/db";
import { regenerarCelsDesDeLinies } from "@/lib/pressupost/pressupost-dept";
import {
  type PeriodicitatTipusB,
  esPeriodicitatTipusB,
  mesosPerDefecte,
  normalitzaMesos,
} from "@/lib/pressupost/tipus-b";
import { potEditarPressupost } from "@/lib/roles";
import { revalidatePath } from "next/cache";

type Result = { ok: boolean; missatge: string; id?: string };
const OK = (m = "", id?: string): Result => ({ ok: true, missatge: m, id });
const ERR = (m: string): Result => ({ ok: false, missatge: m });

async function requireEditor(): Promise<{ ok: true; userId: string } | { ok: false }> {
  const session = await auth();
  const role = session?.user?.role;
  const userId = session?.user?.id;
  if (!potEditarPressupost(role) || !userId) return { ok: false };
  return { ok: true, userId };
}

function refresh(departamentId?: string) {
  revalidateConsultesDades();
  revalidatePath("/pressupost");
  revalidatePath("/pressupost/departaments");
  if (departamentId) {
    revalidatePath(`/pressupost/departaments/${departamentId}`);
  }
}

async function requirePressupostEditable(pressupostId: string) {
  const cap = await db.pressupostDept.findUnique({
    where: { id: pressupostId },
    select: { id: true, estat: true, departamentId: true },
  });
  if (!cap) return { ok: false as const, missatge: "Pressupost no trobat." };
  if (cap.estat === "CONFIRMAT") {
    return {
      ok: false as const,
      missatge: "El pressupost està confirmat; desbloqueja’l per editar.",
    };
  }
  return { ok: true as const, cap };
}

function resolveMesos(
  periodicitat: PeriodicitatTipusB,
  mesosInput: number[] | undefined,
  mesAncora: number
): number[] {
  if (periodicitat === "PERSONALITZAT") {
    const m = normalitzaMesos(mesosInput ?? []);
    return m.length ? m : mesosPerDefecte(periodicitat, mesAncora);
  }
  // MENSUAL / TRIMESTRAL / ANUAL / PUNTUAL: calendari determinat per la regla + àncora.
  return mesosPerDefecte(periodicitat, mesAncora);
}

export async function crearPressupostDeptAction(
  any: number,
  departamentId: string
): Promise<Result> {
  const authz = await requireEditor();
  if (!authz.ok) return ERR("Sense permisos.");
  if (!Number.isInteger(any) || any < 2000 || any > 2100) return ERR("Any no vàlid.");
  if (!departamentId) return ERR("Cal seleccionar un departament.");

  const dept = await db.departament.findFirst({
    where: { id: departamentId, isActive: true },
    select: { id: true },
  });
  if (!dept) return ERR("Departament no trobat.");

  const existent = await db.pressupostDept.findUnique({
    where: { any_departamentId: { any, departamentId } },
    select: { id: true },
  });
  if (existent) return OK("Ja existia.", existent.id);

  const creat = await db.pressupostDept.create({
    data: {
      any,
      departamentId,
      creatPer: authz.userId,
      estat: "ESBORRANY",
    },
    select: { id: true },
  });
  refresh(departamentId);
  return OK("Pressupost creat.", creat.id);
}

export type UpsertLiniaDeptInput = {
  pressupostId: string;
  liniaId?: string;
  /** Id de la categoria del catàleg (taula PressupostPartidaCatalog). */
  categoriaCatalogId: string;
  descripcio: string;
  premissa?: string;
  periodicitat: string;
  importUnitari: number;
  mesos?: number[];
  mesAncora?: number;
};

export async function upsertLiniaDeptAction(input: UpsertLiniaDeptInput): Promise<Result> {
  const authz = await requireEditor();
  if (!authz.ok) return ERR("Sense permisos.");

  if (!input.categoriaCatalogId) return ERR("Cal triar una categoria.");
  const descripcio = input.descripcio.trim();
  if (!descripcio) return ERR("Cal una descripció de la partida.");
  if (!esPeriodicitatTipusB(input.periodicitat)) return ERR("Periodicitat no vàlida.");
  if (!Number.isFinite(input.importUnitari) || input.importUnitari < 0) {
    return ERR("Import no vàlid.");
  }

  const gate = await requirePressupostEditable(input.pressupostId);
  if (!gate.ok) return ERR(gate.missatge);

  const capFull = await db.pressupostDept.findUnique({
    where: { id: input.pressupostId },
    select: { departamentId: true },
  });
  if (!capFull) return ERR("Pressupost no trobat.");

  const categoria = await db.pressupostPartidaCatalog.findFirst({
    where: {
      id: input.categoriaCatalogId,
      isActive: true,
      OR: [
        { totsDepartaments: true },
        { depts: { some: { departamentId: capFull.departamentId } } },
      ],
    },
    select: { id: true, nom: true, categoria: true },
  });
  if (!categoria) {
    return ERR("Categoria no disponible per a aquest departament.");
  }

  const mesAncora =
    input.mesAncora && input.mesAncora >= 1 && input.mesAncora <= 12 ? input.mesAncora : 1;
  const mesos = resolveMesos(input.periodicitat, input.mesos, mesAncora);
  if (!mesos.length) return ERR("Cal almenys un mes al calendari.");

  const rounded = Math.round(Math.abs(input.importUnitari) * 100) / 100;
  const data = {
    partidaCatalogId: categoria.id,
    categoria: categoria.categoria,
    descripcio,
    premissa: input.premissa?.trim() || null,
    periodicitat: input.periodicitat,
    importUnitari: rounded,
    mesos,
  };

  let id = input.liniaId;
  if (id) {
    const existent = await db.pressupostLiniaDept.findFirst({
      where: { id, pressupostId: input.pressupostId },
      select: { id: true },
    });
    if (!existent) return ERR("Línia no trobada.");
    await db.pressupostLiniaDept.update({ where: { id }, data });
  } else {
    const maxOrdre = await db.pressupostLiniaDept.aggregate({
      where: { pressupostId: input.pressupostId },
      _max: { ordre: true },
    });
    const creat = await db.pressupostLiniaDept.create({
      data: {
        pressupostId: input.pressupostId,
        ...data,
        ordre: (maxOrdre._max.ordre ?? 0) + 1,
      },
      select: { id: true },
    });
    id = creat.id;
  }

  await regenerarCelsDesDeLinies(input.pressupostId);
  refresh(gate.cap.departamentId);
  return OK(input.liniaId ? "Partida actualitzada." : "Partida afegida.", id);
}

export async function deleteLiniaDeptAction(
  pressupostId: string,
  liniaId: string
): Promise<Result> {
  const authz = await requireEditor();
  if (!authz.ok) return ERR("Sense permisos.");

  const gate = await requirePressupostEditable(pressupostId);
  if (!gate.ok) return ERR(gate.missatge);

  await db.pressupostLiniaDept.deleteMany({
    where: { id: liniaId, pressupostId },
  });
  await regenerarCelsDesDeLinies(pressupostId);
  refresh(gate.cap.departamentId);
  return OK("Partida eliminada.");
}

export async function setEstatPressupostDeptAction(
  pressupostId: string,
  estat: "ESBORRANY" | "CONFIRMAT"
): Promise<Result> {
  const authz = await requireEditor();
  if (!authz.ok) return ERR("Sense permisos.");

  const cap = await db.pressupostDept.findUnique({
    where: { id: pressupostId },
    select: { id: true, departamentId: true },
  });
  if (!cap) return ERR("Pressupost no trobat.");

  await db.pressupostDept.update({
    where: { id: pressupostId },
    data: { estat },
  });
  refresh(cap.departamentId);
  return OK(estat === "CONFIRMAT" ? "Pressupost confirmat." : "Pressupost en esborrany.");
}

export async function updateNotesPressupostDeptAction(
  pressupostId: string,
  notes: string
): Promise<Result> {
  const authz = await requireEditor();
  if (!authz.ok) return ERR("Sense permisos.");

  const gate = await requirePressupostEditable(pressupostId);
  if (!gate.ok) return ERR(gate.missatge);

  await db.pressupostDept.update({
    where: { id: pressupostId },
    data: { notes: notes.trim() || null },
  });
  refresh(gate.cap.departamentId);
  return OK();
}
