"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { MESOS_LLARGS } from "@/lib/periodes";
import { revalidatePath } from "next/cache";

type Result = { ok: boolean; missatge: string };
const OK = (m = ""): Result => ({ ok: true, missatge: m });
const ERR = (m: string): Result => ({ ok: false, missatge: m });

async function getEditor() {
  const session = await auth();
  const role = session?.user?.role;
  if (role === "ADMIN" || role === "EDICIO") return session!.user.id;
  return null;
}

function refresh() {
  revalidatePath("/dades/ajustos");
  revalidatePath("/consultes/centre");
  revalidatePath("/consultes/linia");
}

export interface AjustInput {
  any: number;
  mes: number;
  concepteResultatId: string;
  centreId: string | null;
  liniaNegociId: string | null;
  import_: number;
  motiu: string;
}

async function resolPeriodId(any: number, mes: number): Promise<string> {
  const period = await db.period.upsert({
    where: { any_mes: { any, mes } },
    update: {},
    create: { any, mes, nom: `${MESOS_LLARGS[mes - 1]} ${any}` },
  });
  return period.id;
}

function validar(input: AjustInput): string | null {
  if (!input.concepteResultatId) return "Cal seleccionar un concepte.";
  if (!input.centreId && !input.liniaNegociId)
    return "Cal seleccionar un centre o una línia de negoci.";
  if (!input.motiu.trim()) return "El motiu és obligatori.";
  if (Number.isNaN(input.import_)) return "L'import no és vàlid.";
  if (!input.mes || input.mes < 1 || input.mes > 12) return "Mes no vàlid.";
  return null;
}

export async function createAjustAction(input: AjustInput): Promise<Result> {
  const userId = await getEditor();
  if (!userId) return ERR("Sense permisos.");
  const err = validar(input);
  if (err) return ERR(err);

  const periodId = await resolPeriodId(input.any, input.mes);
  await db.ajust.create({
    data: {
      periodId,
      concepteResultatId: input.concepteResultatId,
      centreId: input.centreId,
      liniaNegociId: input.liniaNegociId,
      import_: input.import_,
      motiu: input.motiu.trim(),
      creatPer: userId,
    },
  });
  refresh();
  return OK("Ajust creat.");
}

export async function updateAjustAction(id: string, input: AjustInput): Promise<Result> {
  const userId = await getEditor();
  if (!userId) return ERR("Sense permisos.");
  const err = validar(input);
  if (err) return ERR(err);

  const periodId = await resolPeriodId(input.any, input.mes);
  await db.ajust.update({
    where: { id },
    data: {
      periodId,
      concepteResultatId: input.concepteResultatId,
      centreId: input.centreId,
      liniaNegociId: input.liniaNegociId,
      import_: input.import_,
      motiu: input.motiu.trim(),
    },
  });
  refresh();
  return OK("Ajust actualitzat.");
}

export async function deleteAjustAction(id: string): Promise<Result> {
  const userId = await getEditor();
  if (!userId) return ERR("Sense permisos.");
  await db.ajust.delete({ where: { id } });
  refresh();
  return OK("Ajust eliminat.");
}
