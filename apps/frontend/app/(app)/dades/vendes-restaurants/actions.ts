"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { importarVendesDesDeBuffer } from "@/lib/vendes-restaurants/import";
import { teTaxonomiaVendesArticle } from "@/lib/vendes-restaurants/prisma-fields";
import { revalidatePath } from "next/cache";

type Result = {
  ok: boolean;
  missatge: string;
  errors?: string[];
  detalls?: string[];
};

const ERR = (m: string, errors?: string[]): Result => ({ ok: false, missatge: m, errors });
const OK = (m: string): Result => ({ ok: true, missatge: m });

async function getEditor() {
  const session = await auth();
  const role = session?.user?.role;
  if (role === "ADMIN" || role === "EDICIO") return session?.user?.id ?? null;
  return null;
}

function refresh() {
  revalidatePath("/dades/vendes-restaurants");
  revalidatePath("/consultes/vendes-restaurants");
}

export async function uploadVendesRestaurantsAction(formData: FormData): Promise<Result> {
  const userId = await getEditor();
  if (!userId) return ERR("Sense permisos.");

  const files = formData
    .getAll("fitxers")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) {
    const single = formData.get("fitxer");
    if (single instanceof File && single.size > 0) files.push(single);
  }
  if (!files.length) return ERR("Cal seleccionar un o més fitxers Excel.");

  const detalls: string[] = [];
  const errors: string[] = [];
  let okCount = 0;

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importarVendesDesDeBuffer(buffer, file.name, {
      creatPer: userId,
      mida: file.size,
    });
    if (result.ok) {
      okCount++;
      detalls.push(result.missatge);
    } else {
      errors.push(`${file.name}: ${result.missatge}`);
    }
    for (const e of result.errors) errors.push(`${file.name}: ${e}`);
  }

  refresh();

  if (okCount === 0) {
    return ERR("Cap fitxer importat.", errors.slice(0, 20));
  }

  return {
    ok: true,
    missatge: `Importats ${okCount} de ${files.length} fitxer${files.length !== 1 ? "s" : ""}.`,
    detalls,
    errors: errors.length ? errors.slice(0, 20) : undefined,
  };
}

export type AmbitVendes = "TOT" | "V" | "DETALL" | "PACK";

export async function deleteVendesBlocAction(input: {
  centreId: string;
  any: number;
  mes: number;
  ambit: AmbitVendes;
}): Promise<Result> {
  const userId = await getEditor();
  if (!userId) return ERR("Sense permisos.");
  if (!input.centreId || !input.any || !input.mes) return ERR("Paràmetres incomplets.");

  const period = await db.period.findUnique({
    where: { any_mes: { any: input.any, mes: input.mes } },
    select: { id: true },
  });
  if (!period) return ERR("Període no trobat.");

  let n = 0;
  if (input.ambit === "TOT" || input.ambit === "V") {
    const r = await db.vendaDiariaRestaurant.deleteMany({
      where: { periodId: period.id, centreId: input.centreId },
    });
    n += r.count;
  }
  if (input.ambit === "TOT" || input.ambit === "DETALL") {
    const r = await db.vendaArticleRestaurant.deleteMany({
      where: { periodId: period.id, centreId: input.centreId, origen: "DETALL" },
    });
    n += r.count;
  }
  if (input.ambit === "TOT" || input.ambit === "PACK") {
    const r = await db.vendaArticleRestaurant.deleteMany({
      where: { periodId: period.id, centreId: input.centreId, origen: "PACK" },
    });
    n += r.count;
  }

  refresh();
  const label =
    input.ambit === "TOT"
      ? "totes les vendes"
      : input.ambit === "V"
        ? "el fitxer V (dies)"
        : input.ambit === "DETALL"
          ? "el Detall (productes)"
          : "els Packs";
  return OK(`Eliminat ${label}: ${n} registre${n !== 1 ? "s" : ""}.`);
}

export async function getDetallVendesAction(input: {
  centreId: string;
  any: number;
  mes: number;
}): Promise<{
  ok: boolean;
  missatge?: string;
  dies: Array<{
    id: string;
    dia: number;
    dataIso: string;
    unitats: number;
    base: number;
    formaPagament: string;
  }>;
  productes: Array<{
    id: string;
    article: string;
    categoria: string | null;
    grup: string | null;
    unitats: number;
    base: number;
  }>;
  packs: Array<{
    id: string;
    article: string;
    categoria: string | null;
    grup: string | null;
    unitats: number;
    base: number;
  }>;
}> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, missatge: "Sense sessió.", dies: [], productes: [], packs: [] };
  }

  const period = await db.period.findUnique({
    where: { any_mes: { any: input.any, mes: input.mes } },
    select: { id: true },
  });
  if (!period) {
    return { ok: false, missatge: "Període no trobat.", dies: [], productes: [], packs: [] };
  }

  const ambTaxonomia = teTaxonomiaVendesArticle();
  const selectArticle = {
    id: true,
    article: true,
    unitats: true,
    base: true,
    ...(ambTaxonomia ? { categoria: true as const, grup: true as const } : {}),
  };

  const [dies, productes, packs] = await Promise.all([
    db.vendaDiariaRestaurant.findMany({
      where: { periodId: period.id, centreId: input.centreId },
      orderBy: [{ dia: "asc" }, { formaPagament: "asc" }],
      select: { id: true, dia: true, data: true, unitats: true, base: true, formaPagament: true },
    }),
    db.vendaArticleRestaurant.findMany({
      where: { periodId: period.id, centreId: input.centreId, origen: "DETALL" },
      orderBy: { base: "desc" },
      select: selectArticle,
    }),
    db.vendaArticleRestaurant.findMany({
      where: { periodId: period.id, centreId: input.centreId, origen: "PACK" },
      orderBy: { base: "desc" },
      select: selectArticle,
    }),
  ]);

  type ArtRow = {
    id: string;
    article: string;
    unitats: unknown;
    base: unknown;
    categoria?: string | null;
    grup?: string | null;
  };

  const mapArt = (p: ArtRow) => ({
    id: p.id,
    article: p.article,
    categoria: p.categoria ?? null,
    grup: p.grup ?? null,
    unitats: Number(p.unitats),
    base: Number(p.base),
  });

  return {
    ok: true,
    dies: dies.map((d) => ({
      id: d.id,
      dia: d.dia,
      dataIso: d.data.toISOString().slice(0, 10),
      unitats: Number(d.unitats),
      base: Number(d.base),
      formaPagament: d.formaPagament,
    })),
    productes: (productes as ArtRow[]).map(mapArt),
    packs: (packs as ArtRow[]).map(mapArt),
  };
}

export async function updateVendaDiariaAction(input: {
  id: string;
  unitats: number;
  base: number;
}): Promise<Result> {
  const userId = await getEditor();
  if (!userId) return ERR("Sense permisos.");
  if (!input.id) return ERR("Registre no vàlid.");
  if (!Number.isFinite(input.unitats) || !Number.isFinite(input.base)) {
    return ERR("Imports no vàlids.");
  }

  await db.vendaDiariaRestaurant.update({
    where: { id: input.id },
    data: { unitats: input.unitats, base: input.base },
  });
  refresh();
  return OK("Dia actualitzat.");
}

export async function updateVendaArticleAction(input: {
  id: string;
  unitats: number;
  base: number;
}): Promise<Result> {
  const userId = await getEditor();
  if (!userId) return ERR("Sense permisos.");
  if (!input.id) return ERR("Registre no vàlid.");
  if (!Number.isFinite(input.unitats) || !Number.isFinite(input.base)) {
    return ERR("Imports no vàlids.");
  }

  await db.vendaArticleRestaurant.update({
    where: { id: input.id },
    data: { unitats: input.unitats, base: input.base },
  });
  refresh();
  return OK("Article actualitzat.");
}

export async function deleteVendaDiariaAction(id: string): Promise<Result> {
  const userId = await getEditor();
  if (!userId) return ERR("Sense permisos.");
  await db.vendaDiariaRestaurant.delete({ where: { id } });
  refresh();
  return OK("Dia eliminat.");
}

export async function deleteVendaArticleAction(id: string): Promise<Result> {
  const userId = await getEditor();
  if (!userId) return ERR("Sense permisos.");
  await db.vendaArticleRestaurant.delete({ where: { id } });
  refresh();
  return OK("Article eliminat.");
}

export async function deleteCarregaVendesAction(carregaId: string): Promise<Result> {
  const userId = await getEditor();
  if (!userId) return ERR("Sense permisos.");
  const { eliminarCarregaFitxer } = await import("@/lib/carrega-fitxer");
  const r = await eliminarCarregaFitxer(carregaId);
  refresh();
  return r.ok ? OK(r.missatge) : ERR(r.missatge);
}

export async function updateNotesCarregaVendesAction(
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
