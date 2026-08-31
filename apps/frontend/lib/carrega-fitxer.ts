import { db } from "@/lib/db";
import { formatDateShort } from "@/lib/utils";

export type TipusCarregaFitxer =
  | "COST_SALARIAL"
  | "COST_PERSONAL_CENTRE"
  | "COST_PERSONAL_MILLORES"
  | "VENDES_V"
  | "VENDES_DETALL"
  | "VENDES_PACK";

export const TIPUS_CARREGA_LABELS: Record<TipusCarregaFitxer, string> = {
  COST_SALARIAL: "Cost salarial",
  COST_PERSONAL_CENTRE: "Cost personal (nòmina)",
  COST_PERSONAL_MILLORES: "Cost personal (millores)",
  VENDES_V: "Vendes diàries (V)",
  VENDES_DETALL: "Vendes detall",
  VENDES_PACK: "Vendes pack",
};

export type CarregaFitxerLlistaItem = {
  id: string;
  tipus: TipusCarregaFitxer;
  tipusLabel: string;
  nomFitxer: string;
  mida: number | null;
  resum: string | null;
  notes: string | null;
  createdAt: string;
  createdAtLabel: string;
  usuari: string;
  periodLabel: string | null;
  periodAny: number | null;
  periodMes: number | null;
  registres: number;
};

/** Delegate del model; undefined si cal `prisma generate` / migrate. */
function carregaFitxerDelegate(): typeof db.carregaFitxer | undefined {
  // Runtime pot no tenir el model si el client no s'ha regenerat després del schema.
  return (db as { carregaFitxer?: typeof db.carregaFitxer }).carregaFitxer;
}

export async function llistaCarreguesFitxer(
  tipus: TipusCarregaFitxer | TipusCarregaFitxer[]
): Promise<CarregaFitxerLlistaItem[]> {
  const { getCarreguesFitxerLlista } = await import("@/lib/dades-list");
  return getCarreguesFitxerLlista(tipus);
}

/** Consulta directa (sense cache) — només per a dades-list. */
export async function llistaCarreguesFitxerUncached(
  tipus: TipusCarregaFitxer | TipusCarregaFitxer[]
): Promise<CarregaFitxerLlistaItem[]> {
  const carrega = carregaFitxerDelegate();
  if (!carrega) return [];

  const tipusList = Array.isArray(tipus) ? tipus : [tipus];
  const rows = await carrega.findMany({
    where: { tipus: { in: tipusList } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      tipus: true,
      nomFitxer: true,
      mida: true,
      resum: true,
      notes: true,
      createdAt: true,
      creatPerUser: { select: { name: true } },
      period: { select: { nom: true, any: true, mes: true } },
      _count: {
        select: {
          costsSalarials: true,
          costsPersonalsCentre: true,
          vendesDiaries: true,
          vendesArticles: true,
        },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    tipus: r.tipus as TipusCarregaFitxer,
    tipusLabel: TIPUS_CARREGA_LABELS[r.tipus as TipusCarregaFitxer] ?? r.tipus,
    nomFitxer: r.nomFitxer,
    mida: r.mida,
    resum: r.resum,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
    createdAtLabel: formatDateShort(r.createdAt),
    usuari: r.creatPerUser.name,
    periodLabel: r.period?.nom ?? null,
    periodAny: r.period?.any ?? null,
    periodMes: r.period?.mes ?? null,
    registres:
      r._count.costsSalarials +
      (r._count.costsPersonalsCentre ?? 0) +
      r._count.vendesDiaries +
      r._count.vendesArticles,
  }));
}

export async function crearCarregaFitxer(input: {
  tipus: TipusCarregaFitxer;
  nomFitxer: string;
  mida?: number | null;
  periodId?: string | null;
  resum?: string | null;
  creatPer: string;
}): Promise<string> {
  const carrega = carregaFitxerDelegate();
  if (!carrega) {
    throw new Error(
      "El model CarregaFitxer no està disponible. Executa `npx prisma generate` i `npx prisma migrate deploy` a l'arrel del repo, i reinicia el servidor."
    );
  }
  const row = await carrega.create({
    data: {
      tipus: input.tipus,
      nomFitxer: input.nomFitxer,
      mida: input.mida ?? null,
      periodId: input.periodId ?? null,
      resum: input.resum ?? null,
      creatPer: input.creatPer,
    },
    select: { id: true },
  });
  return row.id;
}

/** Elimina la càrrega i les dades vinculades (cascade). */
export async function eliminarCarregaFitxer(id: string): Promise<{
  ok: boolean;
  missatge: string;
}> {
  const carrega = carregaFitxerDelegate();
  if (!carrega) {
    return {
      ok: false,
      missatge:
        "El model CarregaFitxer no està disponible. Executa prisma generate + migrate deploy.",
    };
  }
  const exists = await carrega.findUnique({
    where: { id },
    select: { id: true, nomFitxer: true },
  });
  if (!exists) return { ok: false, missatge: "Càrrega no trobada." };

  await carrega.delete({ where: { id } });
  return { ok: true, missatge: `S'ha eliminat «${exists.nomFitxer}» i les seves dades.` };
}

export async function actualitzarNotesCarrega(
  id: string,
  notes: string | null
): Promise<{ ok: boolean; missatge: string }> {
  const carrega = carregaFitxerDelegate();
  if (!carrega) {
    return {
      ok: false,
      missatge:
        "El model CarregaFitxer no està disponible. Executa prisma generate + migrate deploy.",
    };
  }
  const exists = await carrega.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return { ok: false, missatge: "Càrrega no trobada." };
  await carrega.update({
    where: { id },
    data: { notes: notes?.trim() || null },
  });
  return { ok: true, missatge: "Notes actualitzades." };
}
