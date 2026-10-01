"use server";

import { eliminarAjustosEtt, importarDespesesEttDesDeBuffer } from "@/lib/despeses-ett/service";
import { requireDadesEditorId } from "@/lib/require-access";

type Result = { ok: boolean; missatge: string; errors?: string[]; avisos?: string[] };
const OK = (m = "", extra?: { errors?: string[]; avisos?: string[] }): Result => ({
  ok: true,
  missatge: m,
  ...extra,
});
const ERR = (m: string, extra?: { errors?: string[]; avisos?: string[] }): Result => ({
  ok: false,
  missatge: m,
  ...extra,
});

async function getEditor() {
  return requireDadesEditorId();
}

function collectFiles(formData: FormData): File[] {
  const out: File[] = [];
  for (const v of formData.getAll("fitxers")) {
    if (v instanceof File && v.size > 0) out.push(v);
  }
  const single = formData.get("fitxer");
  if (single instanceof File && single.size > 0) out.push(single);
  return out;
}

export async function uploadDespesesEttAction(formData: FormData): Promise<Result> {
  const userId = await getEditor();
  if (!userId) return ERR("Sense permisos.");

  const files = collectFiles(formData);
  if (!files.length) return ERR("Cal seleccionar com a mínim un fitxer Excel.");

  const okParts: string[] = [];
  const errors: string[] = [];
  const avisos: string[] = [];
  let okCount = 0;

  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await importarDespesesEttDesDeBuffer(buffer, {
        creatPer: userId,
        nomFitxer: file.name,
      });
      if (result.ok) {
        okCount++;
        okParts.push(result.missatge);
        if (result.errors?.length) errors.push(...result.errors.map((e) => `${file.name}: ${e}`));
        if (result.avisos?.length) avisos.push(...result.avisos.map((a) => `${file.name}: ${a}`));
      } else {
        errors.push(`${file.name}: ${result.missatge}`);
        if (result.errors?.length) errors.push(...result.errors.map((e) => `${file.name}: ${e}`));
        if (result.avisos?.length) avisos.push(...result.avisos.map((a) => `${file.name}: ${a}`));
      }
    } catch (e) {
      errors.push(`${file.name}: ${e instanceof Error ? e.message : "Error en importar."}`);
    }
  }

  if (okCount === 0) {
    return ERR(
      files.length === 1
        ? (errors[0] ?? "Cap fitxer importat.")
        : `Cap dels ${files.length} fitxers s'ha importat.`,
      { errors, avisos: avisos.length ? avisos : undefined }
    );
  }

  const cap =
    files.length === 1
      ? (okParts[0] ?? "Importat.")
      : `${okCount}/${files.length} fitxers importats. ${okParts.join(" · ")}`;
  return OK(cap, {
    errors: errors.length ? errors : undefined,
    avisos: avisos.length ? avisos : undefined,
  });
}

export async function deleteAjustosEttAction(input: {
  any: number;
  mes: number;
  centreId?: string | null;
}): Promise<Result> {
  const userId = await getEditor();
  if (!userId) return ERR("Sense permisos.");
  if (!input.any || !input.mes || input.mes < 1 || input.mes > 12) {
    return ERR("Període no vàlid.");
  }
  const r = await eliminarAjustosEtt(input);
  return r.ok ? OK(r.missatge) : ERR(r.missatge);
}
