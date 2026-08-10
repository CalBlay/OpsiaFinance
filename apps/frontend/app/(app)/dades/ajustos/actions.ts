"use server";

import {
  type BasePctVendes,
  motiuPctVendes,
  previsualitzaAjustPctVendes,
  whereAmbitAjust,
} from "@/lib/ajustos/pct-vendes";
import { auth } from "@/lib/auth";
import { revalidateConsultesDades } from "@/lib/consultes-cache";
import { db } from "@/lib/db";
import { MESOS_LLARGS } from "@/lib/periodes";
import { revalidatePath } from "next/cache";

type Result = { ok: boolean; missatge: string };
const OK = (m = ""): Result => ({ ok: true, missatge: m });
const ERR = (m: string): Result => ({ ok: false, missatge: m });

async function getEditor() {
  const session = await auth();
  const role = session?.user?.role;
  if (role === "ADMIN" || role === "EDICIO") return session?.user?.id ?? null;
  return null;
}

function refresh() {
  revalidateConsultesDades();
  revalidatePath("/dades/ajustos");
  revalidatePath("/consultes/centre");
  revalidatePath("/consultes/linia");
  revalidatePath("/consultes/empresa");
  revalidatePath("/consultes/evolucio");
  revalidatePath("/consultes/comparativa");
  revalidatePath("/dades/repartiment");
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

export interface CreateAjustMultiInput {
  any: number;
  mesos: number[]; // 1..12
  concepteResultatId: string;
  centreId: string | null; // si és mode centre
  liniaNegociId: string | null; // si és mode línia
  import_: number;
  motiu: string;
}

export async function createAjustMultiAction(
  input: CreateAjustMultiInput
): Promise<Result & { creats?: number; omesos?: number }> {
  const userId = await getEditor();
  if (!userId) return ERR("Sense permisos.");

  const motiu = input.motiu.trim();
  if (!motiu) return ERR("El motiu és obligatori.");
  if (!input.concepteResultatId) return ERR("Cal seleccionar un concepte.");
  if ((!input.centreId && !input.liniaNegociId) || (input.centreId && input.liniaNegociId)) {
    return ERR("Cal seleccionar un centre o una línia de negoci (no ambdós).");
  }
  if (!Number.isFinite(input.import_)) return ERR("L'import no és vàlid.");
  if (!Array.isArray(input.mesos) || input.mesos.length === 0)
    return ERR("Selecciona com a mínim un mes.");

  const mesos = [...new Set(input.mesos)]
    .map((m) => Number(m))
    .filter((m) => Number.isFinite(m) && m >= 1 && m <= 12);

  if (mesos.length === 0) return ERR("Selecciona mesos vàlids.");

  let creats = 0;
  let omesos = 0;

  for (const mes of mesos) {
    const periodId = await resolPeriodId(input.any, mes);
    const existeix = await db.ajust.findFirst({
      where: {
        periodId,
        concepteResultatId: input.concepteResultatId,
        centreId: input.centreId,
        liniaNegociId: input.liniaNegociId,
        motiu,
      },
      select: { id: true },
    });

    if (existeix) {
      omesos++;
      continue;
    }

    await db.ajust.create({
      data: {
        periodId,
        concepteResultatId: input.concepteResultatId,
        centreId: input.centreId,
        liniaNegociId: input.liniaNegociId,
        import_: input.import_,
        motiu,
        creatPer: userId,
      },
    });
    creats++;
  }

  refresh();
  const missatge = `Creats: ${creats} · Omèsos (ja existents): ${omesos}`;
  return { ok: true, missatge, creats, omesos };
}

export type PreviewAjustPctInput = {
  any: number;
  mesos: number[];
  concepteResultatId: string;
  centreId: string | null;
  liniaNegociId: string | null;
  percent: number;
  basePct: BasePctVendes;
};

export async function previsualitzaAjustPctVendesAction(input: PreviewAjustPctInput) {
  const userId = await getEditor();
  if (!userId) return { ok: false as const, missatge: "Sense permisos." };
  return previsualitzaAjustPctVendes(input);
}

export type CreateAjustPctInput = PreviewAjustPctInput & {
  /** Si es deixa buit, es genera automàticament. */
  motiu?: string;
};

/**
 * Crea (o actualitza) un ajust per mes: objectiu(−%×|base|) − SAP.
 * Upsert per període + concepte + àmbit + motiu.
 */
export async function createAjustPctVendesMultiAction(
  input: CreateAjustPctInput
): Promise<Result & { creats?: number; actualitzats?: number; omesos?: number }> {
  const userId = await getEditor();
  if (!userId) return ERR("Sense permisos.");

  const preview = await previsualitzaAjustPctVendes(input);
  if (!preview.ok) return ERR(preview.missatge);

  const motiu = (
    input.motiu?.trim() || motiuPctVendes(input.percent, input.basePct, input.any)
  ).trim();
  const ambit = whereAmbitAjust({
    centreId: input.centreId,
    liniaNegociId: input.liniaNegociId,
  });
  if (!ambit) return ERR("Cal seleccionar un centre o una línia de negoci.");

  let creats = 0;
  let actualitzats = 0;
  let omesos = 0;

  for (const fila of preview.files) {
    if (Math.abs(fila.importAjust) < 0.005) {
      omesos++;
      continue;
    }

    const periodId = await resolPeriodId(input.any, fila.mes);
    const existent = await db.ajust.findFirst({
      where: {
        periodId,
        concepteResultatId: input.concepteResultatId,
        centreId: ambit.centreId,
        liniaNegociId: ambit.liniaNegociId,
        motiu,
      },
      select: { id: true },
    });

    if (existent) {
      await db.ajust.update({
        where: { id: existent.id },
        data: { import_: fila.importAjust },
      });
      actualitzats++;
    } else {
      await db.ajust.create({
        data: {
          periodId,
          concepteResultatId: input.concepteResultatId,
          centreId: ambit.centreId,
          liniaNegociId: ambit.liniaNegociId,
          import_: fila.importAjust,
          motiu,
          creatPer: userId,
        },
      });
      creats++;
    }
  }

  refresh();
  return {
    ok: true,
    missatge: `Creats: ${creats} · Actualitzats: ${actualitzats} · Omèsos (Δ≈0): ${omesos}`,
    creats,
    actualitzats,
    omesos,
  };
}
