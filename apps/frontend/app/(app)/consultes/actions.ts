"use server";

import { auth } from "@/lib/auth";
import { esSubtotalPresentacio } from "@/lib/compte-subtotals";
import { type DetallCellaParams, type DetallCellaResult, getDetallCella } from "@/lib/consultes";
import { revalidateConsultesDades } from "@/lib/consultes-cache";
import { db } from "@/lib/db";
import { MESOS_LLARGS } from "@/lib/periodes";
import { revalidatePath } from "next/cache";

export async function fetchDetallCellaAction(
  params: DetallCellaParams
): Promise<DetallCellaResult> {
  return getDetallCella(params);
}

type Result = { ok: boolean; missatge: string };
const OK = (m = ""): Result => ({ ok: true, missatge: m });
const ERR = (m: string): Result => ({ ok: false, missatge: m });

export interface AjustarImportConsultaInput {
  centreId?: string;
  liniaNegociId?: string;
  any: number;
  mes: number;
  concepteResultatId: string;
  valorActual: number;
  valorObjectiu: number;
  motiu: string;
}

function refreshConsultes() {
  revalidateConsultesDades();
  revalidatePath("/consultes/centre");
  revalidatePath("/consultes/linia");
  revalidatePath("/consultes/empresa");
  revalidatePath("/consultes/evolucio");
  revalidatePath("/consultes/comparativa");
  revalidatePath("/dades/ajustos");
  revalidatePath("/");
}

/** Crea un ajust des del detall d'una cel·la (centre i/o LN). */
export async function ajustarImportConsultaAction(
  input: AjustarImportConsultaInput
): Promise<Result> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || session?.user?.role !== "ADMIN") {
    return ERR("Sense permisos. Cal rol ADMIN.");
  }

  const motiu = input.motiu.trim();
  if (!motiu) return ERR("El motiu és obligatori.");
  if (!input.centreId && !input.liniaNegociId) {
    return ERR("Cal un centre o una línia de negoci.");
  }
  if (!input.concepteResultatId) return ERR("Cal un concepte.");
  if (!input.mes || input.mes < 1 || input.mes > 12) return ERR("Mes no vàlid.");
  if (!Number.isFinite(input.valorObjectiu) || !Number.isFinite(input.valorActual)) {
    return ERR("L'import no és vàlid.");
  }

  const delta = Math.round((input.valorObjectiu - input.valorActual) * 100) / 100;
  if (delta === 0) return OK("Sense canvis.");

  const centreId = input.centreId ?? null;
  let liniaNegociId = input.liniaNegociId ?? null;

  if (centreId) {
    const centre = await db.centre.findUnique({
      where: { id: centreId },
      select: { id: true, liniaNegociId: true },
    });
    if (!centre) return ERR("Centre no trobat.");
    liniaNegociId = liniaNegociId ?? centre.liniaNegociId;
  } else if (liniaNegociId) {
    const ln = await db.liniaNegoci.findUnique({
      where: { id: liniaNegociId },
      select: { id: true },
    });
    if (!ln) return ERR("Línia de negoci no trobada.");
  }

  const concepte = await db.concepteResultat.findUnique({
    where: { id: input.concepteResultatId },
    select: { id: true, node: true, esSubtotal: true },
  });
  if (!concepte) return ERR("Concepte no trobat.");
  if (esSubtotalPresentacio(concepte.node, concepte.esSubtotal)) {
    return ERR("No es poden ajustar subtotals des de consultes.");
  }

  const period = await db.period.upsert({
    where: { any_mes: { any: input.any, mes: input.mes } },
    update: {},
    create: {
      any: input.any,
      mes: input.mes,
      nom: `${MESOS_LLARGS[input.mes - 1]} ${input.any}`,
    },
  });

  await db.ajust.create({
    data: {
      periodId: period.id,
      concepteResultatId: input.concepteResultatId,
      centreId,
      liniaNegociId,
      import_: delta,
      motiu,
      creatPer: userId,
    },
  });

  refreshConsultes();
  return OK("Ajust creat.");
}
