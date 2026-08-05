import { crearCarregaFitxer } from "@/lib/carrega-fitxer";
import { indexaCentrePerNom, normalitzaNomRestaurant } from "@/lib/cost-salarial/restaurant-noms";
import { db } from "@/lib/db";
import {
  type CostSalarialLiniaParsed,
  parseCostSalarialRestaurantsBuffer,
} from "@/lib/excel-parsers/cost-salarial-restaurants";
import { MESOS_LLARGS } from "@/lib/periodes";

export {
  normalitzaNomRestaurant,
  clauRestaurant,
  ALIASES_RESTAURANT,
  RESTAURANTS_FITXER_COST_SALARIAL,
} from "@/lib/cost-salarial/restaurant-noms";

const CODI_LN_RESTAURANTS = "LN00001";
const CREATE_BATCH = 500;
const UPDATE_CHUNK = 50;

export function costTotalLinia(l: {
  totalSalari: number;
  incentiusMensual: number;
  incentiuTrimestral: number;
  horesExtres: number;
  altres: number;
  baixes: number;
  indemnitzacions: number;
  foraCentre: number;
}): number {
  return (
    l.totalSalari +
    l.incentiusMensual +
    l.incentiuTrimestral +
    l.horesExtres +
    l.altres +
    l.baixes +
    l.indemnitzacions +
    l.foraCentre
  );
}

async function carregaCentresRestaurants() {
  const ln = await db.liniaNegoci.findUnique({
    where: { codi: CODI_LN_RESTAURANTS },
    select: {
      id: true,
      centres: {
        where: { isActive: true },
        select: { id: true, codi: true, nom: true },
      },
    },
  });
  if (!ln) {
    return {
      lnId: null as string | null,
      byNom: new Map<string, { id: string; codi: string; nom: string }>(),
    };
  }

  const byNom = new Map<string, { id: string; codi: string; nom: string }>();
  for (const c of ln.centres) {
    indexaCentrePerNom(byNom, c);
  }
  return { lnId: ln.id, byNom };
}

async function resolPeriodId(any: number, mes: number): Promise<string> {
  const period = await db.period.upsert({
    where: { any_mes: { any, mes } },
    update: {},
    create: { any, mes, nom: `${MESOS_LLARGS[mes - 1]} ${any}` },
  });
  return period.id;
}

/** Upsert de períodes distints en paral·lel. */
async function resolPeriodIds(claus: { any: number; mes: number }[]): Promise<Map<string, string>> {
  const uniq = new Map<string, { any: number; mes: number }>();
  for (const c of claus) uniq.set(`${c.any}-${c.mes}`, c);
  const out = new Map<string, string>();
  await Promise.all(
    [...uniq.entries()].map(async ([k, { any, mes }]) => {
      out.set(k, await resolPeriodId(any, mes));
    })
  );
  return out;
}

export interface ImportCostSalarialResult {
  ok: boolean;
  missatge: string;
  creades: number;
  actualitzades: number;
  ignorades: number;
  errors: string[];
  carregaId?: string;
}

export type ModeImportCostSalarial = "nomes_nous" | "actualitzar";

type CostData = {
  totalSalari: number;
  incentiusMensual: number;
  incentiuTrimestral: number;
  horesExtres: number;
  altres: number;
  baixes: number;
  indemnitzacions: number;
  foraCentre: number;
  carregaId?: string;
};

export async function upsertLiniesCostSalarial(
  linies: CostSalarialLiniaParsed[],
  errorsPrev: string[] = [],
  opts?: { carregaId?: string; mode?: ModeImportCostSalarial }
): Promise<ImportCostSalarialResult> {
  const mode = opts?.mode ?? "nomes_nous";
  const errors = [...errorsPrev];
  const { byNom } = await carregaCentresRestaurants();
  if (byNom.size === 0) {
    return {
      ok: false,
      missatge: "No s'han trobat centres de la LN Restaurants (LN00001).",
      creades: 0,
      actualitzades: 0,
      ignorades: 0,
      errors,
    };
  }

  // 1) Períodes del fitxer en batch
  const periodIdByAnyMes = await resolPeriodIds(linies.map((l) => ({ any: l.any, mes: l.mes })));
  const periodIds = [...new Set(periodIdByAnyMes.values())];

  // 2) Existents només dels períodes implicats (no tota la taula)
  const existents = periodIds.length
    ? await db.costSalarialRestaurant.findMany({
        where: { periodId: { in: periodIds } },
        select: {
          id: true,
          centreId: true,
          departament: true,
          period: { select: { any: true, mes: true } },
        },
      })
    : [];
  const perClau = new Map<string, string>(
    existents.map((e) => [`${e.period.any}-${e.period.mes}-${e.centreId}-${e.departament}`, e.id])
  );

  const clausEnAquestFitxer = new Set<string>();
  type CreateRow = {
    periodId: string;
    centreId: string;
    departament: "SALA" | "CUINA";
  } & CostData;
  const creates: CreateRow[] = [];
  const updates: { id: string; data: CostData }[] = [];

  let ignorades = 0;

  for (const l of linies) {
    const clauNom = normalitzaNomRestaurant(l.nomRestaurant);
    const centre = byNom.get(clauNom);
    if (!centre) {
      const disponibles = [
        ...new Set([...byNom.values()].map((c) => c.nom.replace(/^Restaurant\s+/i, ""))),
      ].sort((a, b) => a.localeCompare(b, "ca"));
      errors.push(
        `Fila ${l.filaExcel}: restaurant «${l.nomRestaurant}» no trobat (clau «${clauNom}»). Centres LN: ${disponibles.join(", ")}.`
      );
      continue;
    }

    const periodId = periodIdByAnyMes.get(`${l.any}-${l.mes}`);
    if (!periodId) continue;

    const clau = `${l.any}-${l.mes}-${centre.id}-${l.departament}`;
    if (clausEnAquestFitxer.has(clau)) {
      errors.push(
        `Fila ${l.filaExcel}: línia duplicada al fitxer (${l.any}-${l.mes}, ${l.nomRestaurant}, ${l.departament}).`
      );
      continue;
    }
    clausEnAquestFitxer.add(clau);

    const existentId = perClau.get(clau);
    if (existentId && mode === "nomes_nous") {
      ignorades++;
      continue;
    }

    const data: CostData = {
      totalSalari: l.totalSalari,
      incentiusMensual: l.incentiusMensual,
      incentiuTrimestral: l.incentiuTrimestral,
      horesExtres: l.horesExtres,
      altres: l.altres,
      baixes: l.baixes,
      indemnitzacions: l.indemnitzacions,
      foraCentre: l.foraCentre,
      ...(opts?.carregaId ? { carregaId: opts.carregaId } : {}),
    };

    if (existentId) {
      updates.push({ id: existentId, data });
    } else {
      creates.push({
        periodId,
        centreId: centre.id,
        departament: l.departament,
        ...data,
      });
    }
  }

  // 3) Writes en batch
  for (let i = 0; i < creates.length; i += CREATE_BATCH) {
    await db.costSalarialRestaurant.createMany({
      data: creates.slice(i, i + CREATE_BATCH),
    });
  }
  for (let i = 0; i < updates.length; i += UPDATE_CHUNK) {
    await Promise.all(
      updates
        .slice(i, i + UPDATE_CHUNK)
        .map((u) => db.costSalarialRestaurant.update({ where: { id: u.id }, data: u.data }))
    );
  }

  const creades = creates.length;
  const actualitzades = updates.length;
  const processades = creades + actualitzades;

  if (processades === 0) {
    if (ignorades > 0) {
      return {
        ok: true,
        missatge: `Cap línia nova: ${ignorades} ja eren a la base de dades (fitxer acumulatiu). Afegeix el mes nou a l'Excel o activa «Actualitzar existents».`,
        creades,
        actualitzades,
        ignorades,
        errors,
        carregaId: opts?.carregaId,
      };
    }
    return {
      ok: false,
      missatge: "Cap línia importada.",
      creades,
      actualitzades,
      ignorades,
      errors,
      carregaId: opts?.carregaId,
    };
  }

  const parts = [
    creades ? `${creades} noves` : null,
    actualitzades ? `${actualitzades} actualitzades` : null,
    ignorades ? `${ignorades} ja existien (ignorades)` : null,
  ].filter(Boolean);

  return {
    ok: true,
    missatge: `Importació: ${parts.join(" · ")}.${errors.length ? ` ${errors.length} avisos.` : ""}`,
    creades,
    actualitzades,
    ignorades,
    errors,
    carregaId: opts?.carregaId,
  };
}

export async function importarCostSalarialDesDeBuffer(
  buffer: Buffer,
  opts: {
    nomFitxer: string;
    mida?: number;
    creatPer: string;
    mode?: ModeImportCostSalarial;
  }
): Promise<ImportCostSalarialResult> {
  const mode = opts.mode ?? "nomes_nous";
  const parsed = parseCostSalarialRestaurantsBuffer(buffer);
  if (!parsed.linies.length && parsed.errors.length) {
    return {
      ok: false,
      missatge: "No s'ha pogut processar l'Excel.",
      creades: 0,
      actualitzades: 0,
      ignorades: 0,
      errors: parsed.errors,
    };
  }

  const periodes = [...new Set(parsed.linies.map((l) => `${MESOS_LLARGS[l.mes - 1]} ${l.any}`))];
  const restaurants = new Set(parsed.linies.map((l) => l.nomRestaurant));
  const periodId =
    parsed.linies.length >= 1 &&
    parsed.linies.every((l) => l.any === parsed.linies[0].any && l.mes === parsed.linies[0].mes)
      ? await resolPeriodId(parsed.linies[0].any, parsed.linies[0].mes)
      : null;

  const modeLabel = mode === "nomes_nous" ? "només noves" : "amb actualització";
  const carregaId = await crearCarregaFitxer({
    tipus: "COST_SALARIAL",
    nomFitxer: opts.nomFitxer,
    mida: opts.mida ?? buffer.length,
    periodId,
    resum: `${restaurants.size} restaurant${restaurants.size !== 1 ? "s" : ""} · ${periodes.join(", ")} · ${modeLabel}`,
    creatPer: opts.creatPer,
  });

  const result = await upsertLiniesCostSalarial(parsed.linies, parsed.errors, {
    carregaId,
    mode,
  });
  // Si no s'ha creat ni actualitzat res, esborra l'entrada d'historial buida.
  if (result.creades + result.actualitzades === 0) {
    await db.carregaFitxer.delete({ where: { id: carregaId } }).catch(() => undefined);
    return { ...result, carregaId: undefined };
  }
  return result;
}
