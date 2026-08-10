"use server";

import { auth } from "@/lib/auth";
import { generarMapeigDesDePayrollBuffer } from "@/lib/cost-personal-centre/auto-mapeig";
import { inferDeptSalarialDesDeText } from "@/lib/cost-personal-centre/parser";
import {
  deleteMapeigCostPersonal,
  esborrarTotMapeigCostPersonal,
  importarMapeigCostPersonalDesDeBuffer,
  upsertMapeigCostPersonal,
} from "@/lib/cost-personal-centre/service";
import { db } from "@/lib/db";
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

/** Valida LN → centre → departament i desa el mapeig. */
async function desarMapeig(input: {
  id?: string;
  codi: string;
  text: string;
  liniaNegociId: string;
  centreId: string;
  departamentId: string | null;
}): Promise<Result> {
  if (!input.codi.trim()) return ERR("El codi és obligatori.");
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

  const departamentId: string | null = input.departamentId?.trim() || null;
  let departamentSalarial = null as ReturnType<typeof inferDeptSalarialDesDeText>;

  if (departamentId) {
    const dept = await db.departament.findUnique({
      where: { id: departamentId },
      select: { id: true, centreId: true, nom: true, isActive: true },
    });
    if (!dept?.isActive) return ERR("Departament no trobat a l'arbre de dimensions.");
    if (dept.centreId !== input.centreId) {
      return ERR("El departament no pertany al centre seleccionat.");
    }
    departamentSalarial = inferDeptSalarialDesDeText(dept.nom);
  }

  const r = await upsertMapeigCostPersonal({
    id: input.id,
    codi: input.codi,
    text: input.text,
    centreId: input.centreId,
    departamentId,
    departamentSalarial,
  });
  if (r.ok) refresh();
  return r;
}

export async function createMapeigCostPersonalAction(input: {
  codi: string;
  text: string;
  liniaNegociId: string;
  centreId: string;
  departamentId: string | null;
}): Promise<Result> {
  if (!(await requireEditor())) return ERR("No tens permisos.");
  return desarMapeig(input);
}

export async function updateMapeigCostPersonalAction(input: {
  id: string;
  codi: string;
  text: string;
  liniaNegociId: string;
  centreId: string;
  departamentId: string | null;
}): Promise<Result> {
  if (!(await requireEditor())) return ERR("No tens permisos.");
  return desarMapeig(input);
}

export async function deleteMapeigCostPersonalAction(id: string): Promise<Result> {
  if (!(await requireEditor())) return ERR("No tens permisos.");
  const r = await deleteMapeigCostPersonal(id);
  refresh();
  return r;
}

/** Esborra tots els mapeigs (per refer-los manualment). */
export async function esborrarTotMapeigCostPersonalAction(): Promise<Result> {
  if (!(await requireEditor())) return ERR("No tens permisos.");
  const r = await esborrarTotMapeigCostPersonal();
  refresh();
  return { ok: r.ok, missatge: r.missatge };
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
