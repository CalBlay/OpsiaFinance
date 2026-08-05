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

  // Claus ja a BD: any-mes-centreId-departament (una sola query).
  const existents = await db.costSalarialRestaurant.findMany({
    select: {
      id: true,
      centreId: true,
      departament: true,
      period: { select: { any: true, mes: true } },
    },
  });
  const perClau = new Map(
    existents.map(
      (e) => [`${e.period.any}-${e.period.mes}-${e.centreId}-${e.departament}`, e.id] as const
    )
  );
  const clausEnAquestFitxer = new Set<string>();

  let creades = 0;
  let actualitzades = 0;
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

    const periodId = await resolPeriodId(l.any, l.mes);
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

    const data = {
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
      await db.costSalarialRestaurant.update({
        where: { id: existentId },
        data,
      });
      actualitzades++;
    } else {
      await db.costSalarialRestaurant.create({
        data: {
          periodId,
          centreId: centre.id,
          departament: l.departament,
          ...data,
        },
      });
      creades++;
    }
  }

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
    parsed.linies.length === 1
      ? await resolPeriodId(parsed.linies[0].any, parsed.linies[0].mes)
      : parsed.linies.every((l) => l.any === parsed.linies[0].any && l.mes === parsed.linies[0].mes)
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
