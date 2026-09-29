"use server";

import { eliminarCarregaFitxer } from "@/lib/carrega-fitxer";
import { revalidateConsultesDades } from "@/lib/consultes-cache";
import { requireDadesEditorId } from "@/lib/require-access";
import { importarPlantillaRrhhDesDeBuffer } from "@/lib/rrhh-plantilla/service-import";
import { revalidatePath } from "next/cache";

type Result = { ok: boolean; missatge: string; errors?: string[] };
const OK = (m = "", errors?: string[]): Result => ({ ok: true, missatge: m, errors });
const ERR = (m: string, errors?: string[]): Result => ({ ok: false, missatge: m, errors });

function refresh() {
  revalidateConsultesDades();
  revalidatePath("/dades/plantilla-rrhh");
  revalidatePath("/settings/plantilla-rrhh");
}

export async function uploadPlantillaRrhhAction(formData: FormData): Promise<Result> {
  const userId = await requireDadesEditorId();
  if (!userId) return ERR("Sense permisos.");

  const file = formData.get("fitxer");
  if (!(file instanceof File) || file.size <= 0) {
    return ERR("Cal seleccionar un fitxer Excel de plantilla.");
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importarPlantillaRrhhDesDeBuffer(buffer, {
      nomFitxer: file.name,
      mida: file.size,
      creatPer: userId,
    });
    refresh();
    if (!result.ok) return ERR(result.missatge, result.errors);
    return OK(result.missatge, result.errors.length ? result.errors : undefined);
  } catch (e) {
    return ERR(e instanceof Error ? e.message : "Error en importar.");
  }
}

export async function deleteCarregaPlantillaRrhhAction(id: string): Promise<Result> {
  const userId = await requireDadesEditorId();
  if (!userId) return ERR("Sense permisos.");
  const r = await eliminarCarregaFitxer(id);
  refresh();
  return r.ok ? OK(r.missatge) : ERR(r.missatge);
}
