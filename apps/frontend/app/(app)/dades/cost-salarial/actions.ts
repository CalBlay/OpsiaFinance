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

  const carrega = await db.carregaFitxer.findUnique({
    where: { id: carregaId },
    select: {
      id: true,
      nomFitxer: true,
      periodId: true,
      costsSalarials: { select: { periodId: true } },
    },
  });
  if (!carrega) return ERR("Càrrega no trobada.");

  // Períodes tocats per aquesta càrrega (el fitxer pot ser acumulatiu multi-mes).
  const periodIds = new Set<string>();
  if (carrega.periodId) periodIds.add(carrega.periodId);
  for (const r of carrega.costsSalarials) periodIds.add(r.periodId);

  // Cascade esborra les files amb aquest carregaId.
  await db.carregaFitxer.delete({ where: { id: carregaId } });

  // Registres orfes del mateix període (sense carregaId: manuals antics o imports
  // anteriors a l’historial) — en esborrar el fitxer, l’usuari espera netejar el període.
  let orfes = 0;
  if (periodIds.size) {
    const r = await db.costSalarialRestaurant.deleteMany({
      where: { carregaId: null, periodId: { in: [...periodIds] } },
    });
    orfes = r.count;
  }

  refresh();
  const extra = orfes
    ? ` · ${orfes} registre${orfes === 1 ? "" : "s"} orfe${orfes === 1 ? "" : "s"}`
    : "";
  return OK(`S'ha eliminat «${carrega.nomFitxer}» i les seves dades${extra}.`);
}

/** Esborra TOTS els registres de Cost salarial restaurants (tots els períodes). */
export async function deleteTotsCostSalarialAction(): Promise<Result> {
  const userId = await getEditor();
  if (!userId) return ERR("Sense permisos.");

  const r = await db.costSalarialRestaurant.deleteMany({});
  // Historial de càrregues sense dades vinculades
  await db.carregaFitxer.deleteMany({ where: { tipus: "COST_SALARIAL" } });
  refresh();
  if (!r.count) return OK("No hi havia registres a esborrar.");
  return OK(`S'han eliminat tots els registres (${r.count}).`);
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
