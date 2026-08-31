"use server";

import { auth } from "@/lib/auth";
import { revalidateConsultesDades } from "@/lib/consultes-cache";
import { db } from "@/lib/db";
import type { ModeRepartimentPersonalLn } from "@prisma/client";
import { revalidatePath } from "next/cache";

async function requireEditor() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "EDICIO")) {
    return null;
  }
  return session.user;
}

function revalidateRepartimentPersonal() {
  revalidateConsultesDades();
  revalidatePath("/settings/repartiment");
  revalidatePath("/settings/repartiment/personal");
  revalidatePath("/dades/repartiment");
}

export async function updateConfigPersonalLnAction(
  liniaNegociId: string,
  data: { mode: ModeRepartimentPersonalLn; importFixTotal: number | null }
) {
  const user = await requireEditor();
  if (!user) return { ok: false, missatge: "Sense permisos." };

  await db.configPersonalLn.upsert({
    where: { liniaNegociId },
    update: {
      mode: data.mode,
      importFixTotal: data.importFixTotal,
    },
    create: {
      liniaNegociId,
      mode: data.mode,
      importFixTotal: data.importFixTotal,
    },
  });

  revalidateRepartimentPersonal();
  return { ok: true, missatge: "Configuració de LN desada." };
}

export async function updateConfigPersonalDeptAction(
  liniaNegociId: string,
  departamentId: string,
  data: {
    actiu: boolean;
    percentDept: number | null;
    pesInternFix: number | null;
  }
) {
  const user = await requireEditor();
  if (!user) return { ok: false, missatge: "Sense permisos." };

  if (departamentId.startsWith("__sense__")) {
    return { ok: false, missatge: "Completeu el mapeig de nòmina abans d'assignar aquest centre." };
  }

  if (!data.actiu) {
    await db.configPersonalDept.deleteMany({
      where: { liniaNegociId, departamentId },
    });
  } else {
    await db.configPersonalDept.upsert({
      where: { liniaNegociId_departamentId: { liniaNegociId, departamentId } },
      update: {
        actiu: true,
        percentDept: data.percentDept,
        pesInternFix: data.pesInternFix,
      },
      create: {
        liniaNegociId,
        departamentId,
        actiu: true,
        percentDept: data.percentDept,
        pesInternFix: data.pesInternFix,
      },
    });
  }

  revalidateRepartimentPersonal();
  return { ok: true };
}

/** Desa mode LN + totes les assignacions de departament en una sola operació. */
export async function saveConfigPersonalLnCompletaAction(
  liniaNegociId: string,
  data: {
    mode: ModeRepartimentPersonalLn;
    importFixTotal: number | null;
    departaments: {
      departamentId: string;
      actiu: boolean;
      percentDept: number | null;
      pesInternFix: number | null;
    }[];
  }
) {
  const user = await requireEditor();
  if (!user) return { ok: false, missatge: "Sense permisos." };

  await db.configPersonalLn.upsert({
    where: { liniaNegociId },
    update: {
      mode: data.mode,
      importFixTotal: data.importFixTotal,
    },
    create: {
      liniaNegociId,
      mode: data.mode,
      importFixTotal: data.importFixTotal,
    },
  });

  const actius = data.departaments.filter(
    (d) => d.actiu && !d.departamentId.startsWith("__sense__")
  );
  const actiuIds = actius.map((d) => d.departamentId);

  await db.configPersonalDept.deleteMany({
    where: {
      liniaNegociId,
      ...(actiuIds.length ? { departamentId: { notIn: actiuIds } } : {}),
    },
  });

  for (const d of actius) {
    await db.configPersonalDept.upsert({
      where: {
        liniaNegociId_departamentId: {
          liniaNegociId,
          departamentId: d.departamentId,
        },
      },
      update: {
        actiu: true,
        percentDept: data.mode === "PERCENT_DEPT" ? d.percentDept : null,
        pesInternFix: data.mode === "FIX_TOTAL" ? (d.pesInternFix ?? 1) : null,
      },
      create: {
        liniaNegociId,
        departamentId: d.departamentId,
        actiu: true,
        percentDept: data.mode === "PERCENT_DEPT" ? d.percentDept : null,
        pesInternFix: data.mode === "FIX_TOTAL" ? (d.pesInternFix ?? 1) : null,
      },
    });
  }

  revalidateRepartimentPersonal();
  return { ok: true, missatge: "Configuració desada." };
}

export async function updatePesDefecteComercialAction(liniaNegociId: string, pesDefecte: number) {
  const user = await requireEditor();
  if (!user) return { ok: false, missatge: "Sense permisos." };

  const pes = Math.min(1, Math.max(0, pesDefecte));
  await db.pesDefectePersonalComercial.upsert({
    where: { liniaNegociId },
    update: { pesDefecte: pes },
    create: { liniaNegociId, pesDefecte: pes },
  });

  revalidateRepartimentPersonal();
  return { ok: true, missatge: "Pes per defecte desat." };
}

export async function updateFraccioSobrantIgualsAction(fraccio: number) {
  const user = await requireEditor();
  if (!user) return { ok: false, missatge: "Sense permisos." };

  const { clampFraccio01, FRACCIO_SOBRANT_IGUALS_DEFECTE } = await import(
    "@/lib/repartiment/personal-departaments-constants"
  );
  const valor = clampFraccio01(Number.isFinite(fraccio) ? fraccio : FRACCIO_SOBRANT_IGUALS_DEFECTE);

  await db.configRepartimentPersonal.upsert({
    where: { id: "default" },
    update: { fraccioSobrantIguals: valor },
    create: { id: "default", fraccioSobrantIguals: valor },
  });

  revalidateRepartimentPersonal();
  return { ok: true, missatge: "Part a parts iguals desada." };
}
