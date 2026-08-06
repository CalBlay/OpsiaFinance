"use server";

import { auth } from "@/lib/auth";
import { eliminarCarregaFitxer } from "@/lib/carrega-fitxer";
import { periodeDesDelNomFitxerCostPersonal } from "@/lib/cost-personal-centre/nom-fitxer";
import { importarCostPersonalCentreDesDeBuffer } from "@/lib/cost-personal-centre/service";
import { MESOS_LLARGS } from "@/lib/periodes";
import { revalidatePath } from "next/cache";

type Result = { ok: boolean; missatge: string; errors?: string[] };
const OK = (m = "", errors?: string[]): Result => ({ ok: true, missatge: m, errors });
const ERR = (m: string, errors?: string[]): Result => ({ ok: false, missatge: m, errors });

async function getEditor() {
  const session = await auth();
  const role = session?.user?.role;
  if ((role === "ADMIN" || role === "EDICIO") && session?.user) return session.user.id;
  return null;
}

function refresh() {
  revalidatePath("/dades/cost-personal-centre");
  revalidatePath("/dades/cost-salarial");
  revalidatePath("/consultes/centre");
  revalidatePath("/consultes/cost-personal");
  revalidatePath("/consultes/cost-salarial");
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

export async function uploadCostPersonalCentreAction(formData: FormData): Promise<Result> {
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
  let okCount = 0;

  for (const file of files) {
    const periode = periodeDesDelNomFitxerCostPersonal(file.name);
    const any = periode?.any ?? defAny;
    const mes = periode?.mes ?? defMes;
    if (!periode) {
      errors.push(
        `«${file.name}»: no s'ha pogut llegir el període del nom (ex. Cost_Personal_07_26.xlsx); s'usa ${MESOS_LLARGS[mes - 1]} ${any}.`
      );
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await importarCostPersonalCentreDesDeBuffer(buffer, {
        any,
        mes,
        nomFitxer: file.name,
        mida: file.size,
        creatPer: userId,
      });
      if (result.ok) {
        okCount++;
        okParts.push(`${file.name}: ${result.missatge}`);
        if (result.errors?.length) errors.push(...result.errors.map((e) => `${file.name}: ${e}`));
      } else {
        errors.push(`${file.name}: ${result.missatge}`);
        if (result.errors?.length) errors.push(...result.errors.map((e) => `${file.name}: ${e}`));
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
      errors
    );
  }

  const cap =
    files.length === 1
      ? (okParts[0] ?? "Importat.")
      : `${okCount}/${files.length} fitxers importats.`;
  return OK(cap + (okParts.length > 1 ? ` ${okParts.join(" · ")}` : ""), errors);
}

export async function deleteCarregaCostPersonalAction(carregaId: string): Promise<Result> {
  const userId = await getEditor();
  if (!userId) return ERR("Sense permisos.");
  const r = await eliminarCarregaFitxer(carregaId);
  refresh();
  return r.ok ? OK(r.missatge) : ERR(r.missatge);
}

export async function updateNotesCarregaCostPersonalAction(
  carregaId: string,
  notes: string
): Promise<Result> {
  const userId = await getEditor();
  if (!userId) return ERR("Sense permisos.");
  const { actualitzarNotesCarrega } = await import("@/lib/carrega-fitxer");
  const r = await actualitzarNotesCarrega(carregaId, notes);
  refresh();
  return r.ok ? OK(r.missatge) : ERR(r.missatge);
}
