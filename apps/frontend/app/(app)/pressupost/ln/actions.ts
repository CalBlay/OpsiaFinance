"use server";

import { auth } from "@/lib/auth";
import { revalidateConsultesDades } from "@/lib/consultes-cache";
import { db } from "@/lib/db";
import { lnSuportaDetallCentres } from "@/lib/pressupost/detall-centres";
import { calcularEbitdaTipusA } from "@/lib/pressupost/tipus-a";
import { sumaCelsCentres } from "@/lib/pressupost/tipus-a-data";
import {
  NODE_COMPRES,
  NODE_COST_GESTIO,
  NODE_COST_SALARIAL,
  NODE_EBITDA,
  NODE_VENDES,
} from "@/lib/repartiment/nodes";
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

function refresh() {
  revalidateConsultesDades();
  revalidatePath("/pressupost");
  revalidatePath("/pressupost/ln");
  revalidatePath("/pressupost/departaments");
  revalidatePath("/pressupost/aprovacio");
}

export async function crearPressupostLnAction(any: number, liniaNegociId: string): Promise<Result> {
  const authz = await requireEditor();
  if (!authz.ok) return ERR("Sense permisos.");
  if (!Number.isInteger(any) || any < 2000 || any > 2100) return ERR("Any no vàlid.");
  if (!liniaNegociId) return ERR("Cal seleccionar una línia de negoci.");

  const ln = await db.liniaNegoci.findFirst({
    where: { id: liniaNegociId, isActive: true },
    select: { id: true },
  });
  if (!ln) return ERR("Línia de negoci no trobada.");

  const existent = await db.pressupostLn.findUnique({
    where: { any_liniaNegociId: { any, liniaNegociId } },
    select: { id: true },
  });
  if (existent) return OK("Ja existia.", existent.id);

  const creat = await db.pressupostLn.create({
    data: {
      any,
      liniaNegociId,
      creatPer: authz.userId,
      estat: "ESBORRANY",
    },
    select: { id: true },
  });
  refresh();
  return OK("Pressupost creat.", creat.id);
}

export async function upsertPressupostCelAction(
  pressupostId: string,
  mes: number,
  concepteResultatId: string,
  importValor: number
): Promise<Result> {
  const authz = await requireEditor();
  if (!authz.ok) return ERR("Sense permisos.");
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return ERR("Mes no vàlid.");
  if (!Number.isFinite(importValor)) return ERR("Import no vàlid.");

  const cap = await db.pressupostLn.findUnique({
    where: { id: pressupostId },
    select: { id: true, estat: true },
  });
  if (!cap) return ERR("Pressupost no trobat.");
  if (cap.estat === "CONFIRMAT") {
    return ERR("El pressupost està confirmat; desbloqueja’l per editar.");
  }

  const rounded = Math.round(importValor * 100) / 100;

  if (rounded === 0) {
    await db.pressupostCelLn.deleteMany({
      where: { pressupostId, mes, concepteResultatId },
    });
  } else {
    await db.pressupostCelLn.upsert({
      where: {
        pressupostId_mes_concepteResultatId: {
          pressupostId,
          mes,
          concepteResultatId,
        },
      },
      create: {
        pressupostId,
        mes,
        concepteResultatId,
        import_: rounded,
      },
      update: { import_: rounded },
    });
  }

  // Editar el general el desvincula de la suma de centres.
  await db.pressupostLn.update({
    where: { id: pressupostId },
    data: { updatedAt: new Date(), generalDesDeCentres: false },
  });

  refresh();
  return OK();
}

export async function upsertPressupostCelCentreAction(
  pressupostId: string,
  centreId: string,
  mes: number,
  concepteResultatId: string,
  importValor: number
): Promise<Result> {
  const authz = await requireEditor();
  if (!authz.ok) return ERR("Sense permisos.");
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return ERR("Mes no vàlid.");
  if (!Number.isFinite(importValor)) return ERR("Import no vàlid.");
  if (!centreId) return ERR("Cal seleccionar un centre.");

  const cap = await db.pressupostLn.findUnique({
    where: { id: pressupostId },
    select: {
      id: true,
      estat: true,
      liniaNegociId: true,
      liniaNegoci: { select: { codi: true } },
    },
  });
  if (!cap) return ERR("Pressupost no trobat.");
  if (cap.estat === "CONFIRMAT") {
    return ERR("El pressupost està confirmat; desbloqueja’l per editar.");
  }
  if (!lnSuportaDetallCentres(cap.liniaNegoci.codi)) {
    return ERR("Aquesta LN no admet detall per centre.");
  }

  const centre = await db.centre.findFirst({
    where: {
      id: centreId,
      liniaNegociId: cap.liniaNegociId,
      isActive: true,
    },
    select: { id: true },
  });
  if (!centre) return ERR("Centre no vàlid per a aquesta LN.");

  const rounded = Math.round(importValor * 100) / 100;

  if (rounded === 0) {
    await db.pressupostCelCentre.deleteMany({
      where: { pressupostId, centreId, mes, concepteResultatId },
    });
  } else {
    await db.pressupostCelCentre.upsert({
      where: {
        pressupostId_centreId_mes_concepteResultatId: {
          pressupostId,
          centreId,
          mes,
          concepteResultatId,
        },
      },
      create: {
        pressupostId,
        centreId,
        mes,
        concepteResultatId,
        import_: rounded,
      },
      update: { import_: rounded },
    });
  }

  await db.pressupostLn.update({
    where: { id: pressupostId },
    data: { updatedAt: new Date() },
  });

  refresh();
  return OK();
}

/** Copia la suma dels centres al general (sobreescriu cel·les generals Tipus A). */
export async function aplicarSumaCentresAlGeneralAction(pressupostId: string): Promise<Result> {
  const authz = await requireEditor();
  if (!authz.ok) return ERR("Sense permisos.");

  const cap = await db.pressupostLn.findUnique({
    where: { id: pressupostId },
    select: {
      id: true,
      estat: true,
      liniaNegoci: { select: { codi: true } },
    },
  });
  if (!cap) return ERR("Pressupost no trobat.");
  if (cap.estat === "CONFIRMAT") {
    return ERR("El pressupost està confirmat; desbloqueja’l per editar.");
  }
  if (!lnSuportaDetallCentres(cap.liniaNegoci.codi)) {
    return ERR("Aquesta LN no admet detall per centre.");
  }

  const suma = await sumaCelsCentres(pressupostId);
  if (suma.size === 0) {
    return ERR("No hi ha cap xifra als centres per aplicar.");
  }

  const conceptes = await db.concepteResultat.findMany({
    where: {
      node: {
        in: [NODE_VENDES, NODE_COMPRES, NODE_COST_SALARIAL, NODE_COST_GESTIO, NODE_EBITDA],
      },
    },
    select: { id: true, node: true },
  });
  const idByNode = new Map(conceptes.map((c) => [c.node, c.id]));
  const idV = idByNode.get(NODE_VENDES);
  const idC = idByNode.get(NODE_COMPRES);
  const idP = idByNode.get(NODE_COST_SALARIAL);
  const idG = idByNode.get(NODE_COST_GESTIO);
  const idE = idByNode.get(NODE_EBITDA);

  // Recalcular EBITDA del general a partir de la suma de partides (no suma d’EBITDAs).
  if (idV && idC && idP && idG && idE) {
    for (let mes = 1; mes <= 12; mes++) {
      const ebitda = calcularEbitdaTipusA(
        suma.get(`${idV}:${mes}`) ?? 0,
        suma.get(`${idC}:${mes}`) ?? 0,
        suma.get(`${idP}:${mes}`) ?? 0,
        suma.get(`${idG}:${mes}`) ?? 0
      );
      suma.set(`${idE}:${mes}`, ebitda);
    }
  }

  await db.$transaction(async (tx) => {
    for (const [key, import_] of suma) {
      const [concepteResultatId, mesStr] = key.split(":");
      const mes = Number(mesStr);
      const rounded = Math.round(import_ * 100) / 100;
      if (rounded === 0) {
        await tx.pressupostCelLn.deleteMany({
          where: { pressupostId, mes, concepteResultatId },
        });
      } else {
        await tx.pressupostCelLn.upsert({
          where: {
            pressupostId_mes_concepteResultatId: {
              pressupostId,
              mes,
              concepteResultatId,
            },
          },
          create: {
            pressupostId,
            mes,
            concepteResultatId,
            import_: rounded,
          },
          update: { import_: rounded },
        });
      }
    }

    await tx.pressupostLn.update({
      where: { id: pressupostId },
      data: { generalDesDeCentres: true, updatedAt: new Date() },
    });
  });

  refresh();
  return OK("Suma dels centres aplicada al pressupost general.");
}

export async function desvincularGeneralDeCentresAction(pressupostId: string): Promise<Result> {
  const authz = await requireEditor();
  if (!authz.ok) return ERR("Sense permisos.");

  const cap = await db.pressupostLn.findUnique({
    where: { id: pressupostId },
    select: { id: true, estat: true },
  });
  if (!cap) return ERR("Pressupost no trobat.");
  if (cap.estat === "CONFIRMAT") {
    return ERR("El pressupost està confirmat; desbloqueja’l per editar.");
  }

  await db.pressupostLn.update({
    where: { id: pressupostId },
    data: { generalDesDeCentres: false },
  });
  refresh();
  return OK("General desvinculat (les xifres es mantenen).");
}

export async function setEstatPressupostLnAction(
  pressupostId: string,
  estat: "ESBORRANY" | "CONFIRMAT"
): Promise<Result> {
  const authz = await requireEditor();
  if (!authz.ok) return ERR("Sense permisos.");

  const cap = await db.pressupostLn.findUnique({
    where: { id: pressupostId },
    select: { id: true },
  });
  if (!cap) return ERR("Pressupost no trobat.");

  await db.pressupostLn.update({
    where: { id: pressupostId },
    data: { estat },
  });
  refresh();
  return OK(estat === "CONFIRMAT" ? "Pressupost confirmat." : "Pressupost en esborrany.");
}

export async function updateNotesPressupostLnAction(
  pressupostId: string,
  notes: string
): Promise<Result> {
  const authz = await requireEditor();
  if (!authz.ok) return ERR("Sense permisos.");

  const cap = await db.pressupostLn.findUnique({
    where: { id: pressupostId },
    select: { id: true, estat: true },
  });
  if (!cap) return ERR("Pressupost no trobat.");
  if (cap.estat === "CONFIRMAT") {
    return ERR("El pressupost està confirmat; desbloqueja’l per editar.");
  }

  await db.pressupostLn.update({
    where: { id: pressupostId },
    data: { notes: notes.trim() || null },
  });
  refresh();
  return OK();
}
