"use server";

import { auth } from "@/lib/auth";
import { parseNavExtra } from "@/lib/nav-catalog";
import { potConfigurar } from "@/lib/roles";
import { generarMapeigOrgPlantillaAuto } from "@/lib/rrhh-plantilla/auto-mapeig";
import {
  type MapeigOrgPlantillaInput,
  deleteMapeigOrgPlantilla,
  esborrarTotMapeigOrgPlantilla,
  importarMapeigOrgPlantillaDesDeBuffer,
  upsertMapeigOrgPlantilla,
} from "@/lib/rrhh-plantilla/service";
import { revalidatePath } from "next/cache";

type Result = { ok: boolean; missatge: string };
const OK = (missatge = ""): Result => ({ ok: true, missatge });
const ERR = (missatge: string): Result => ({ ok: false, missatge });

async function requireEditor(): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;
  return potConfigurar(session.user.role, parseNavExtra(session.user.navExtra));
}

function refresh() {
  revalidatePath("/settings/plantilla-rrhh");
}

export async function createMapeigOrgPlantillaAction(
  input: MapeigOrgPlantillaInput
): Promise<Result> {
  if (!(await requireEditor())) return ERR("No tens permisos.");
  const r = await upsertMapeigOrgPlantilla(input);
  if (!r.ok) return ERR(r.missatge);
  refresh();
  return OK("Mapeig afegit.");
}

export async function updateMapeigOrgPlantillaAction(
  input: MapeigOrgPlantillaInput
): Promise<Result> {
  if (!(await requireEditor())) return ERR("No tens permisos.");
  if (!input.id) return ERR("Falta l'identificador.");
  const r = await upsertMapeigOrgPlantilla(input);
  if (!r.ok) return ERR(r.missatge);
  refresh();
  return OK("Mapeig actualitzat.");
}

export async function deleteMapeigOrgPlantillaAction(id: string): Promise<Result> {
  if (!(await requireEditor())) return ERR("No tens permisos.");
  await deleteMapeigOrgPlantilla(id);
  refresh();
  return OK("Mapeig eliminat.");
}

export async function esborrarTotMapeigOrgPlantillaAction(): Promise<Result> {
  if (!(await requireEditor())) return ERR("No tens permisos.");
  const n = await esborrarTotMapeigOrgPlantilla();
  refresh();
  return OK(n ? `S'han eliminat ${n} mapeigs.` : "No hi havia mapeigs.");
}

export async function generarMapeigAutoPlantillaAction(substituirTot = false): Promise<Result> {
  if (!(await requireEditor())) return ERR("No tens permisos.");
  try {
    const r = await generarMapeigOrgPlantillaAuto({ substituirTot });
    refresh();
    const base = `Auto-mapeig: ${r.creats} nous · ${r.actualitzats} actualitzats · ${r.aplicades.length}/${r.propostes} propostes.`;
    if (!r.senseMatch.length) return OK(base);
    const mostra = r.senseMatch.slice(0, 8).join(", ");
    const extra = r.senseMatch.length > 8 ? ` (+${r.senseMatch.length - 8} més)` : "";
    return OK(`${base} Sense match: ${mostra}${extra}.`);
  } catch (e) {
    return ERR(e instanceof Error ? e.message : "Error en generar l'auto-mapeig.");
  }
}

export async function importarMapeigOrgPlantillaExcelAction(formData: FormData): Promise<Result> {
  if (!(await requireEditor())) return ERR("No tens permisos.");

  const file = formData.get("fitxer");
  if (!(file instanceof File)) return ERR("Cap fitxer seleccionat.");

  const substituirTot = formData.get("substituirTot") === "true";

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { importats, errors } = await importarMapeigOrgPlantillaDesDeBuffer(
      buffer,
      substituirTot
    );
    refresh();

    const base = `${importats} mapeigs importats/actualitzats.`;
    if (!errors.length) return OK(base);
    const mostra = errors.slice(0, 5).join(" ");
    const extra = errors.length > 5 ? ` (+${errors.length - 5} més)` : "";
    return OK(`${base} ${errors.length} avís(s): ${mostra}${extra}`);
  } catch (e) {
    return ERR(e instanceof Error ? e.message : "Error en importar.");
  }
}
