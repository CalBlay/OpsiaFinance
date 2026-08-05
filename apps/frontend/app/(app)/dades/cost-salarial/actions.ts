"use server";

import { auth } from "@/lib/auth";
import { importarCostSalarialDesDeBuffer } from "@/lib/cost-salarial/import";
import { db } from "@/lib/db";
import { MESOS_LLARGS } from "@/lib/periodes";
import { revalidatePath } from "next/cache";

type Result = { ok: boolean; missatge: string; errors?: string[] };
const OK = (m = "", errors?: string[]): Result => ({ ok: true, missatge: m, errors });
const ERR = (m: string, errors?: string[]): Result => ({ ok: false, missatge: m, errors });

async function getEditor() {
  const session = await auth();
  const role = session?.user?.role;
  if ((role === "ADMIN" || role === "EDICIO") && session?.user) return session.user.id;
  return null;
}

function refresh() {
  revalidatePath("/dades/cost-salarial");
  revalidatePath("/consultes/cost-salarial");
}

export interface CostSalarialInput {
  any: number;
  mes: number;
  centreId: string;
  departament: "SALA" | "CUINA";
  totalSalari: number;
  incentiusMensual: number;
  incentiuTrimestral: number;
  horesExtres: number;
  altres: number;
  baixes: number;
  indemnitzacions: number;
  foraCentre: number;
  notes?: string;
}

async function resolPeriodId(any: number, mes: number): Promise<string> {
  const period = await db.period.upsert({
    where: { any_mes: { any, mes } },
    update: {},
    create: { any, mes, nom: `${MESOS_LLARGS[mes - 1]} ${any}` },
  });
  return period.id;
}

function parseNum(v: number): number {
  return Number.isFinite(v) ? v : Number.NaN;
}

function validar(input: CostSalarialInput): string | null {
  if (!input.centreId) return "Cal seleccionar un restaurant.";
  if (input.departament !== "SALA" && input.departament !== "CUINA") return "Departament no vàlid.";
  if (!input.mes || input.mes < 1 || input.mes > 12) return "Mes no vàlid.";
  const camps = [
    input.totalSalari,
    input.incentiusMensual,
    input.incentiuTrimestral,
    input.horesExtres,
    input.altres,
    input.baixes,
    input.indemnitzacions,
    input.foraCentre,
  ];
  if (camps.some((c) => Number.isNaN(parseNum(c)))) return "Hi ha imports no vàlids.";
  return null;
}

export async function uploadCostSalarialAction(formData: FormData): Promise<Result> {
  const userId = await getEditor();
  if (!userId) return ERR("Sense permisos.");

  const file = formData.get("fitxer");
  if (!(file instanceof File) || file.size === 0) return ERR("Cal seleccionar un fitxer Excel.");

  const modeRaw = String(formData.get("mode") ?? "nomes_nous");
  const mode = modeRaw === "actualitzar" ? "actualitzar" : "nomes_nous";

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await importarCostSalarialDesDeBuffer(buffer, {
    nomFitxer: file.name,
    mida: file.size,
    creatPer: userId,
    mode,
  });
  refresh();
  if (!result.ok) return ERR(result.missatge, result.errors);
  return OK(result.missatge, result.errors);
}

export async function upsertCostSalarialAction(
  input: CostSalarialInput,
  id?: string | null
): Promise<Result> {
  const userId = await getEditor();
  if (!userId) return ERR("Sense permisos.");
  const err = validar(input);
  if (err) return ERR(err);

  const periodId = await resolPeriodId(input.any, input.mes);
  const data = {
    totalSalari: input.totalSalari,
    incentiusMensual: input.incentiusMensual,
    incentiuTrimestral: input.incentiuTrimestral,
    horesExtres: input.horesExtres,
    altres: input.altres,
    baixes: input.baixes,
    indemnitzacions: input.indemnitzacions,
    foraCentre: input.foraCentre,
    notes: input.notes?.trim() || null,
  };

  if (id) {
    await db.costSalarialRestaurant.update({
      where: { id },
      data: {
        periodId,
        centreId: input.centreId,
        departament: input.departament,
        ...data,
      },
    });
  } else {
    await db.costSalarialRestaurant.upsert({
      where: {
        periodId_centreId_departament: {
          periodId,
          centreId: input.centreId,
          departament: input.departament,
        },
      },
      create: {
        periodId,
        centreId: input.centreId,
        departament: input.departament,
        ...data,
      },
      update: data,
    });
  }
  refresh();
  return OK("Registre desat.");
}

export async function deleteCostSalarialAction(id: string): Promise<Result> {
  const userId = await getEditor();
  if (!userId) return ERR("Sense permisos.");
  await db.costSalarialRestaurant.delete({ where: { id } });
  refresh();
  return OK("Registre eliminat.");
}

export async function deleteCarregaCostSalarialAction(carregaId: string): Promise<Result> {
  const userId = await getEditor();
  if (!userId) return ERR("Sense permisos.");
  const { eliminarCarregaFitxer } = await import("@/lib/carrega-fitxer");
  const r = await eliminarCarregaFitxer(carregaId);
  refresh();
  return r.ok ? OK(r.missatge) : ERR(r.missatge);
}

export async function updateNotesCarregaCostAction(
  carregaId: string,
  notes: string
): Promise<Result> {
  const userId = await getEditor();
  if (!userId) return ERR("Sense permisos.");
  const { actualitzarNotesCarrega } = await import("@/lib/carrega-fitxer");
  const r = await actualitzarNotesCarrega(carregaId, notes);
  refresh();
  return r.ok ? OK(r.missatge) : ERR(r.missatge);
}
