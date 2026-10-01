"use server";

import { eliminarCarregaFitxer } from "@/lib/carrega-fitxer";
import { revalidateConsultesDades } from "@/lib/consultes-cache";
import {
  importarJornadaPersonalDesDeBuffer,
  periodeDesDelNomFitxerJornada,
} from "@/lib/jornada-personal/service";
import { MESOS_LLARGS } from "@/lib/periodes";
import { requireDadesEditorId } from "@/lib/require-access";
import { revalidatePath } from "next/cache";

type Result = { ok: boolean; missatge: string; errors?: string[]; avisos?: string[] };
const OK = (m = "", extra?: Partial<Result>): Result => ({ ok: true, missatge: m, ...extra });
const ERR = (m: string, extra?: Partial<Result>): Result => ({ ok: false, missatge: m, ...extra });

async function getEditor() {
  return requireDadesEditorId();
}

function refresh() {
  revalidateConsultesDades();
  revalidatePath("/dades/jornada-personal");
  revalidatePath("/consultes/cost-personal");
  revalidatePath("/rrhh");
  revalidatePath("/rrhh/centre");
  revalidatePath("/rrhh/departament");
  revalidatePath("/rrhh/comparativa");
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

export async function uploadJornadaPersonalAction(formData: FormData): Promise<Result> {
  const userId = await getEditor();
  if (!userId) return ERR("Sense permisos.");

  const files = collectFiles(formData);
  if (!files.length) return ERR("Cal seleccionar com a mínim un fitxer Excel.");

  const fallbackAny = Number(formData.get("any"));
  const fallbackMes = Number(formData.get("mes"));
  const ara = new Date();
  const defAny =
    Number.isFinite(fallbackAny) && fallbackAny >= 2000 ? fallbackAny : ara.getFullYear();
  const defMes =
    Number.isFinite(fallbackMes) && fallbackMes >= 1 && fallbackMes <= 12
      ? fallbackMes
      : ara.getMonth() + 1;

  const okParts: string[] = [];
  const errors: string[] = [];
  const avisos: string[] = [];
  let okCount = 0;

  for (const file of files) {
    const periode = periodeDesDelNomFitxerJornada(file.name);
    const any = periode?.any ?? defAny;
    const mes = periode?.mes ?? defMes;
    if (!periode) {
      avisos.push(
        `«${file.name}»: període no detectat al nom; s'usa ${MESOS_LLARGS[mes - 1]} ${any}.`
      );
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await importarJornadaPersonalDesDeBuffer(buffer, {
        any,
        mes,
        nomFitxer: file.name,
        mida: file.size,
        creatPer: userId,
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

  refresh();

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

export async function deleteCarregaJornadaAction(carregaId: string): Promise<Result> {
  const userId = await getEditor();
  if (!userId) return ERR("Sense permisos.");
  const r = await eliminarCarregaFitxer(carregaId);
  refresh();
  return r.ok ? OK(r.missatge) : ERR(r.missatge);
}
