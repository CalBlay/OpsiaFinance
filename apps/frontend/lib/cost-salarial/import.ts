import { db } from "@/lib/db";
import {
  type CostSalarialLiniaParsed,
  parseCostSalarialRestaurantsBuffer,
} from "@/lib/excel-parsers/cost-salarial-restaurants";
import { MESOS_LLARGS } from "@/lib/periodes";

const CODI_LN_RESTAURANTS = "LN00001";

/** Aliases Excel → nom curt del centre (sense prefix RESTAURANT). */
const ALIASES_RESTAURANT: Record<string, string> = {
  origens: "origens",
  nautic: "nautic",
  "masia esplugues": "masia esplugues",
  "camp nou": "camp nou",
  "tarraco arena": "tarraco arena",
  mirador: "mirador",
  "juno house": "juno house",
  plural: "plural",
  soliver: "soliver",
  greenvita: "greenvita",
  "green vita": "greenvita",
};

export function normalitzaNomRestaurant(nom: string): string {
  const s = nom
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/^restaurant\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return ALIASES_RESTAURANT[s] ?? s;
}

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
    byNom.set(normalitzaNomRestaurant(c.nom), c);
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
  errors: string[];
}

export async function upsertLiniesCostSalarial(
  linies: CostSalarialLiniaParsed[],
  errorsPrev: string[] = []
): Promise<ImportCostSalarialResult> {
  const errors = [...errorsPrev];
  const { byNom } = await carregaCentresRestaurants();
  if (byNom.size === 0) {
    return {
      ok: false,
      missatge: "No s'han trobat centres de la LN Restaurants (LN00001).",
      creades: 0,
      actualitzades: 0,
      errors,
    };
  }

  let creades = 0;
  let actualitzades = 0;

  for (const l of linies) {
    const clau = normalitzaNomRestaurant(l.nomRestaurant);
    const centre = byNom.get(clau);
    if (!centre) {
      errors.push(
        `Fila ${l.filaExcel}: restaurant «${l.nomRestaurant}» no trobat als centres (clau «${clau}»).`
      );
      continue;
    }

    const periodId = await resolPeriodId(l.any, l.mes);
    const data = {
      totalSalari: l.totalSalari,
      incentiusMensual: l.incentiusMensual,
      incentiuTrimestral: l.incentiuTrimestral,
      horesExtres: l.horesExtres,
      altres: l.altres,
      baixes: l.baixes,
      indemnitzacions: l.indemnitzacions,
      foraCentre: l.foraCentre,
    };

    const existent = await db.costSalarialRestaurant.findUnique({
      where: {
        periodId_centreId_departament: {
          periodId,
          centreId: centre.id,
          departament: l.departament,
        },
      },
      select: { id: true },
    });

    if (existent) {
      await db.costSalarialRestaurant.update({
        where: { id: existent.id },
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
    return {
      ok: false,
      missatge: "Cap línia importada.",
      creades,
      actualitzades,
      errors,
    };
  }

  return {
    ok: true,
    missatge: `Importades ${creades} noves i actualitzades ${actualitzades}.${errors.length ? ` ${errors.length} avisos.` : ""}`,
    creades,
    actualitzades,
    errors,
  };
}

export async function importarCostSalarialDesDeBuffer(
  buffer: Buffer
): Promise<ImportCostSalarialResult> {
  const parsed = parseCostSalarialRestaurantsBuffer(buffer);
  if (!parsed.linies.length && parsed.errors.length) {
    return {
      ok: false,
      missatge: "No s'ha pogut processar l'Excel.",
      creades: 0,
      actualitzades: 0,
      errors: parsed.errors,
    };
  }
  return upsertLiniesCostSalarial(parsed.linies, parsed.errors);
}
