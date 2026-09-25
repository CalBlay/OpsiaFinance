"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseNavExtra } from "@/lib/nav-catalog";
import { potConfigurar } from "@/lib/roles";
import { revalidatePath } from "next/cache";

type Result = { ok: boolean; missatge: string };
const OK = (missatge = ""): Result => ({ ok: true, missatge });
const ERR = (missatge: string): Result => ({ ok: false, missatge });

export type MapeigBalancEsdevenimentsInput = {
  id?: string;
  text: string;
  liniaNegociId: string;
  centreId: string;
};

async function requireEditor(): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;
  return potConfigurar(session.user.role, parseNavExtra(session.user.navExtra));
}

function refresh() {
  revalidatePath("/settings/balanc-esdeveniments");
}

async function desarMapeig(input: MapeigBalancEsdevenimentsInput): Promise<Result> {
  const t = input.text.trim();
  if (!t) return ERR("El text és obligatori (valor A2 del balanç, p.ex. ESPAIS).");
  if (!input.liniaNegociId) return ERR("Selecciona una línia de negoci.");
  if (!input.centreId) return ERR("Selecciona un centre.");

  const centre = await db.centre.findUnique({
    where: { id: input.centreId },
    select: { id: true, liniaNegociId: true, isActive: true },
  });
  if (!centre?.isActive) return ERR("Centre no trobat.");
  if (centre.liniaNegociId !== input.liniaNegociId) {
    return ERR("El centre no pertany a la línia seleccionada.");
  }

  try {
    if (input.id) {
      await db.mapeigCentreBalancEsdeveniments.update({
        where: { id: input.id },
        data: { text: t, centreId: input.centreId },
      });
      refresh();
      return OK("Mapeig actualitzat.");
    }
    await db.mapeigCentreBalancEsdeveniments.create({
      data: { text: t, centreId: input.centreId },
    });
    refresh();
    return OK("Mapeig afegit.");
  } catch {
    return ERR(
      input.id ? "No s'ha pogut actualitzar (text duplicat?)." : "Aquest text ja existeix."
    );
  }
}

export async function createMapeigBalancEsdevenimentsAction(
  input: MapeigBalancEsdevenimentsInput
): Promise<Result> {
  if (!(await requireEditor())) return ERR("No tens permisos.");
  return desarMapeig(input);
}

export async function updateMapeigBalancEsdevenimentsAction(
  input: MapeigBalancEsdevenimentsInput
): Promise<Result> {
  if (!(await requireEditor())) return ERR("No tens permisos.");
  if (!input.id) return ERR("Falta l'id del mapeig.");
  return desarMapeig(input);
}

export async function deleteMapeigBalancEsdevenimentsAction(id: string): Promise<Result> {
  if (!(await requireEditor())) return ERR("No tens permisos.");
  if (!id) return ERR("Falta l'id.");
  await db.mapeigCentreBalancEsdeveniments.delete({ where: { id } });
  refresh();
  return OK("Mapeig eliminat.");
}
