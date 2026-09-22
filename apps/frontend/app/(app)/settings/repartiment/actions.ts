"use server";

import { auth } from "@/lib/auth";
import { revalidateConsultesDades } from "@/lib/consultes-cache";
import { parseNavExtra } from "@/lib/nav-catalog";
import { NODES_GESTIO_DETALL, NODE_COST_GESTIO } from "@/lib/repartiment/nodes";
import {
  ensureNormesRepartimentInicials,
  reiniciarAmbNormesSeed,
  resetNormesRepartiment,
} from "@/lib/repartiment/normes-default";
import { potConfigurar } from "@/lib/roles";
import { revalidatePath } from "next/cache";

async function requireEditor() {
  const session = await auth();
  if (!session?.user) return null;
  if (!potConfigurar(session.user.role, parseNavExtra(session.user.navExtra))) return null;
  return session.user;
}

function revalidateRepartiment() {
  revalidateConsultesDades();
  revalidatePath("/settings/repartiment");
  revalidatePath("/settings/repartiment/normes");
  revalidatePath("/dades/repartiment");
}

function percentValid(percent: number) {
  return Number.isFinite(percent) && percent >= 0 && percent <= 100;
}

export async function inicialitzarNormesAction() {
  const user = await requireEditor();
  if (!user) return { ok: false, missatge: "Sense permisos." };
  const res = await ensureNormesRepartimentInicials();
  revalidatePath("/settings/repartiment");
  revalidatePath("/settings/repartiment/normes");
  revalidatePath("/dades/repartiment");
  return res;
}

export async function carregarNormesSeedAction() {
  const user = await requireEditor();
  if (!user) return { ok: false, missatge: "Sense permisos." };
  const res = await reiniciarAmbNormesSeed();
  revalidatePath("/settings/repartiment");
  revalidatePath("/settings/repartiment/normes");
  revalidatePath("/dades/repartiment");
  return res;
}

export async function esborrarTotRepartimentAction() {
  const user = await requireEditor();
  if (!user) return { ok: false, missatge: "Sense permisos." };
  const res = await resetNormesRepartiment();
  revalidatePath("/settings/repartiment");
  revalidatePath("/settings/repartiment/normes");
  revalidatePath("/dades/repartiment");
  return res;
}

export async function toggleNormaAction(id: string, actiu: boolean) {
  const user = await requireEditor();
  if (!user) return { ok: false, missatge: "Sense permisos." };
  const { db } = await import("@/lib/db");
  await db.normaRepartiment.update({ where: { id }, data: { actiu } });
  revalidatePath("/settings/repartiment");
  revalidatePath("/settings/repartiment/normes");
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
  revalidatePath("/settings/repartiment/normes");
  revalidatePath("/dades/repartiment");
  return { ok: true, missatge: "Norma actualitzada." };
}

export async function savePersonalMatrixAction(
  rows: {
    departamentId: string;
    percentByLn: { liniaNegociId: string; percent: number }[];
  }[]
) {
  const user = await requireEditor();
  if (!user) return { ok: false, missatge: "Sense permisos." };
  if (!rows.length) return { ok: false, missatge: "No hi ha departaments per desar." };

  const { db } = await import("@/lib/db");
  const lnIds = [...new Set(rows.flatMap((row) => row.percentByLn.map((cell) => cell.liniaNegociId)))];
  const validLnIds = new Set(
    (
      await db.liniaNegoci.findMany({
        where: { id: { in: lnIds }, isActive: true },
        select: { id: true },
      })
    ).map((ln) => ln.id)
  );
  if (validLnIds.size !== lnIds.length) {
    return { ok: false, missatge: "La matriu conté una línia de negoci no vàlida." };
  }

  for (const row of rows) {
    if (row.departamentId.startsWith("__sense__")) {
      return { ok: false, missatge: "Completeu el mapeig dels departaments abans de desar." };
    }
    if (
      row.percentByLn.length !== lnIds.length ||
      row.percentByLn.some((cell) => !percentValid(cell.percent))
    ) {
      return { ok: false, missatge: "Tots els percentatges han d'estar entre 0 i 100." };
    }
    const total = row.percentByLn.reduce((sum, cell) => sum + cell.percent, 0);
    if (Math.abs(total - 100) > 0.01) {
      return {
        ok: false,
        missatge: `Cada departament ha de sumar 100%. Hi ha una fila amb ${total.toFixed(2)}%.`,
      };
    }
  }

  const departamentIds = rows.map((row) => row.departamentId);
  await db.$transaction(async (tx) => {
    for (const liniaNegociId of lnIds) {
      await tx.configPersonalLn.upsert({
        where: { liniaNegociId },
        update: { mode: "PERCENT_DEPT", importFixTotal: null },
        create: { liniaNegociId, mode: "PERCENT_DEPT" },
      });
    }
    await tx.configPersonalDept.deleteMany({
      where: { departamentId: { in: departamentIds }, liniaNegociId: { in: lnIds } },
    });
    const cells = rows.flatMap((row) =>
      row.percentByLn
        .filter((cell) => cell.percent > 0)
        .map((cell) => ({
          departamentId: row.departamentId,
          liniaNegociId: cell.liniaNegociId,
          actiu: true,
          percentDept: cell.percent,
        }))
    );
    if (cells.length) await tx.configPersonalDept.createMany({ data: cells });
  });

  revalidateRepartiment();
  return { ok: true, missatge: "Repartiment de personal desat." };
}

export async function saveGestioMatrixAction(
  rows: {
    node: number;
    label: string;
    percentByLn: { liniaNegociId: string; percent: number }[];
  }[]
) {
  const user = await requireEditor();
  if (!user) return { ok: false, missatge: "Sense permisos." };
  if (!rows.length) return { ok: false, missatge: "No hi ha partides de gestió per desar." };

  const nodesPermesos = new Set<number>(NODES_GESTIO_DETALL);
  const lnIds = [...new Set(rows.flatMap((row) => row.percentByLn.map((cell) => cell.liniaNegociId)))];
  for (const row of rows) {
    if (!nodesPermesos.has(row.node)) {
      return { ok: false, missatge: `La partida ${row.node} no es pot repartir.` };
    }
    if (
      row.percentByLn.length !== lnIds.length ||
      row.percentByLn.some((cell) => !percentValid(cell.percent))
    ) {
      return { ok: false, missatge: "Tots els percentatges han d'estar entre 0 i 100." };
    }
    const total = row.percentByLn.reduce((sum, cell) => sum + cell.percent, 0);
    if (Math.abs(total - 100) > 0.01) {
      return {
        ok: false,
        missatge: `La partida «${row.label}» suma ${total.toFixed(2)}%; ha de sumar 100%.`,
      };
    }
  }

  const { db } = await import("@/lib/db");
  const [central, validLnCount] = await Promise.all([
    db.liniaNegoci.findUnique({ where: { codi: "LN00000" }, select: { id: true } }),
    db.liniaNegoci.count({ where: { id: { in: lnIds }, isActive: true } }),
  ]);
  if (!central || validLnCount !== lnIds.length) {
    return { ok: false, missatge: "No s'han pogut validar les línies de negoci." };
  }

  const nodes = rows.map((row) => row.node);
  await db.$transaction(async (tx) => {
    await tx.normaRepartiment.updateMany({
      where: {
        actiu: true,
        concepteNode: { in: [NODE_COST_GESTIO, ...nodes] },
        tipus: "PERCENT_POOL_CENTRAL",
      },
      data: { actiu: false },
    });
    await tx.normaRepartiment.createMany({
      data: rows.flatMap((row, rowIndex) =>
        row.percentByLn.map((cell, colIndex) => ({
          nom: `${row.label} · matriu de gestió`,
          tipus: "PERCENT_POOL_CENTRAL" as const,
          ordre: 7000 + rowIndex * 100 + colIndex,
          liniaNegociOrigenId: central.id,
          liniaNegociDestiId: cell.liniaNegociId,
          concepteNode: row.node,
          valorPercent: cell.percent,
        }))
      ),
    });
  });

  revalidateRepartiment();
  return { ok: true, missatge: "Repartiment de gestió desat." };
}
