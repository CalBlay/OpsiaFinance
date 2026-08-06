"use server";

import { auth } from "@/lib/auth";
import { generarMapeigDesDePayrollBuffer } from "@/lib/cost-personal-centre/auto-mapeig";
import {
  deleteMapeigCostPersonal,
  importarMapeigCostPersonalDesDeBuffer,
  upsertMapeigCostPersonal,
} from "@/lib/cost-personal-centre/service";
import type { DepartamentSalarial } from "@prisma/client";
import { revalidatePath } from "next/cache";

type Result = { ok: boolean; missatge: string };
const OK = (missatge = ""): Result => ({ ok: true, missatge });
const ERR = (missatge: string): Result => ({ ok: false, missatge });

async function requireEditor(): Promise<boolean> {
  const session = await auth();
  const role = session?.user?.role;
  return role === "ADMIN" || role === "EDICIO";
}

function refresh() {
  revalidatePath("/settings/cost-personal-centre");
  revalidatePath("/dades/cost-personal-centre");
  revalidatePath("/consultes/centre");
}

function parseDept(raw: string): DepartamentSalarial | null {
  if (raw === "SALA" || raw === "CUINA") return raw;
  if (!raw || raw === "_") return null;
  return null;
}

export async function createMapeigCostPersonalAction(
  codi: string,
  centreId: string,
  text: string,
  departament: string
): Promise<Result> {
  if (!(await requireEditor())) return ERR("No tens permisos.");
  const r = await upsertMapeigCostPersonal({
    codi,
    centreId,
    text,
    departamentSalarial: parseDept(departament),
  });
  if (r.ok) refresh();
  return r;
}

export async function updateMapeigCostPersonalAction(
  id: string,
  codi: string,
  centreId: string,
  text: string,
  departament: string
): Promise<Result> {
  if (!(await requireEditor())) return ERR("No tens permisos.");
  const r = await upsertMapeigCostPersonal({
    id,
    codi,
    centreId,
    text,
    departamentSalarial: parseDept(departament),
  });
  if (r.ok) refresh();
  return r;
}

export async function deleteMapeigCostPersonalAction(id: string): Promise<Result> {
  if (!(await requireEditor())) return ERR("No tens permisos.");
  const r = await deleteMapeigCostPersonal(id);
  refresh();
  return r;
}

export async function importarMapeigCostPersonalExcelAction(formData: FormData): Promise<Result> {
  if (!(await requireEditor())) return ERR("No tens permisos.");
  const file = formData.get("fitxer");
  if (!(file instanceof File)) return ERR("Cap fitxer seleccionat.");
  const substituirTot = formData.get("substituirTot") === "true";
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { importats, errors } = await importarMapeigCostPersonalDesDeBuffer(
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

/** Genera el mapeig creuant el llistat payroll amb els centres de Dimensions. */
export async function generarMapeigAutoDesDePayrollAction(formData: FormData): Promise<Result> {
  if (!(await requireEditor())) return ERR("No tens permisos.");
  const file = formData.get("fitxer");
  if (!(file instanceof File) || file.size === 0) {
    return ERR("Selecciona el fitxer Excel del llistat de costos (payroll).");
  }
  const substituirTot = formData.get("substituirTot") === "true";
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const r = await generarMapeigDesDePayrollBuffer(buffer, { substituirTot });
    refresh();
    if (!r.ok) {
      const extra = r.exemplesSenseMatch.length
        ? ` Exemples sense match: ${r.exemplesSenseMatch.slice(0, 5).join("; ")}`
        : "";
      return ERR(`${r.missatge}${extra}`);
    }
    const avis =
      r.exemplesSenseMatch.length > 0
        ? ` Sense match (ex.): ${r.exemplesSenseMatch.slice(0, 6).join("; ")}`
        : "";
    return OK(`${r.missatge}${avis}`);
  } catch (e) {
    return ERR(e instanceof Error ? e.message : "Error en generar el mapeig.");
  }
}

/** Genera des de Cost_Personal_*.xlsx al disc (sense pujar). */
export async function generarMapeigDesDeFitxerLocalAction(substituirTot = true): Promise<Result> {
  if (!(await requireEditor())) return ERR("No tens permisos.");
  try {
    const { generarMapeigDesDeFitxerLocal } = await import(
      "@/lib/cost-personal-centre/auto-mapeig"
    );
    const r = await generarMapeigDesDeFitxerLocal({ substituirTot });
    refresh();
    if (!r.ok) {
      const extra = r.exemplesSenseMatch.length
        ? ` Exemples sense match: ${r.exemplesSenseMatch.slice(0, 5).join("; ")}`
        : "";
      return ERR(`${r.missatge}${extra}`);
    }
    const avis =
      r.exemplesSenseMatch.length > 0
        ? ` Sense match (ex.): ${r.exemplesSenseMatch.slice(0, 6).join("; ")}`
        : "";
    return OK(`${r.missatge}${avis}`);
  } catch (e) {
    return ERR(e instanceof Error ? e.message : "Error en generar el mapeig.");
  }
}
