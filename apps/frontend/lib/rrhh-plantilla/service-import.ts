import { crearCarregaFitxer } from "@/lib/carrega-fitxer";
import { db } from "@/lib/db";
import { MESOS_LLARGS } from "@/lib/periodes";
import {
  indexarMapeigsOrgPlantilla,
  resoldreMapeigOrgPlantilla,
} from "@/lib/rrhh-plantilla/mapeig";
import { parseExcelPlantillaRrhh } from "@/lib/rrhh-plantilla/parser";

export type ImportPlantillaOpts = {
  nomFitxer: string;
  mida?: number | null;
  creatPer: string;
  /** Si true, també importa files pare (agregats). Per defecte només fulles. */
  inclourePares?: boolean;
};

export type ImportPlantillaResult = {
  ok: boolean;
  missatge: string;
  filesImportades: number;
  periodes: number;
  senseMapeig: number;
  errors: string[];
};

async function resolPeriodId(any: number, mes: number): Promise<string> {
  const period = await db.period.upsert({
    where: { any_mes: { any, mes } },
    update: {},
    create: { any, mes, nom: `${MESOS_LLARGS[mes - 1]} ${any}` },
  });
  return period.id;
}

/**
 * Importa la matriu ampla de plantilla RRHH.
 * Substitueix les dades dels mesos presents al fitxer.
 */
export async function importarPlantillaRrhhDesDeBuffer(
  buffer: Buffer,
  opts: ImportPlantillaOpts
): Promise<ImportPlantillaResult> {
  const errors: string[] = [];
  const parsed = parseExcelPlantillaRrhh(buffer);
  if (!parsed.files.length) {
    return {
      ok: false,
      missatge: parsed.diagnostica || "El fitxer no conté dades de plantilla.",
      filesImportades: 0,
      periodes: 0,
      senseMapeig: 0,
      errors,
    };
  }

  const mapeigs = await db.mapeigOrgPlantilla.findMany({
    where: { isActive: true },
    select: { text: true, centreId: true, departamentId: true, isActive: true },
  });
  if (!mapeigs.length) {
    return {
      ok: false,
      missatge: "No hi ha mapeigs d'organització. Configura'ls a Configuració → Plantilla RRHH.",
      filesImportades: 0,
      periodes: 0,
      senseMapeig: parsed.files.length,
      errors,
    };
  }

  const index = indexarMapeigsOrgPlantilla(mapeigs);
  const inclourePares = opts.inclourePares === true;

  type AgKey = string;
  type Ag = {
    any: number;
    mes: number;
    centreId: string;
    departamentId: string | null;
    nombrePersones: number;
    texts: Set<string>;
  };
  const agregats = new Map<AgKey, Ag>();
  let senseMapeig = 0;
  const avisSense = new Set<string>();

  for (const f of parsed.files) {
    if (!inclourePares && !f.esFulla) continue;
    const hit = resoldreMapeigOrgPlantilla(index, f.text);
    if (!hit) {
      senseMapeig++;
      if (avisSense.size < 20) avisSense.add(f.text);
      continue;
    }
    for (const v of f.valors) {
      const k = `${v.any}-${v.mes}::${hit.centreId}::${hit.departamentId ?? "_"}`;
      const prev = agregats.get(k);
      if (prev) {
        // Si dos texts mapegen al mateix centre/dept, ens quedem el màxim
        // (evita sumar pare+fill si ambdós s'han importat per error).
        prev.nombrePersones = Math.max(prev.nombrePersones, v.persones);
        prev.texts.add(f.text);
      } else {
        agregats.set(k, {
          any: v.any,
          mes: v.mes,
          centreId: hit.centreId,
          departamentId: hit.departamentId,
          nombrePersones: v.persones,
          texts: new Set([f.text]),
        });
      }
    }
  }

  if (avisSense.size) {
    errors.push(`Sense mapeig (exemples): ${[...avisSense].join(", ")}.`);
  }

  if (!agregats.size) {
    return {
      ok: false,
      missatge: "Cap fila mapejada amb valors. Revisa el mapeig a Configuració → Plantilla RRHH.",
      filesImportades: 0,
      periodes: 0,
      senseMapeig,
      errors,
    };
  }

  const periodKeys = [
    ...new Set([...agregats.values()].map((a) => `${a.any}-${String(a.mes).padStart(2, "0")}`)),
  ].sort();
  const periodIdByKey = new Map<string, string>();
  for (const key of periodKeys) {
    const [anyStr, mesStr] = key.split("-");
    const any = Number(anyStr);
    const mes = Number(mesStr);
    periodIdByKey.set(key, await resolPeriodId(any, mes));
  }

  // Substitueix només els mesos presents al fitxer
  const periodIds = [...periodIdByKey.values()];
  await db.plantillaRrhh.deleteMany({ where: { periodId: { in: periodIds } } });

  const mesosLabel = periodKeys
    .map((k) => {
      const [, mesStr] = k.split("-");
      const mes = Number(mesStr);
      const any = Number(k.slice(0, 4));
      return `${MESOS_LLARGS[mes - 1]?.slice(0, 3) ?? mes} ${any}`;
    })
    .join(", ");

  const carregaId = await crearCarregaFitxer({
    tipus: "PLANTILLA_RRHH",
    nomFitxer: opts.nomFitxer,
    mida: opts.mida,
    periodId: periodIds.length === 1 ? periodIds[0] : null,
    resum: `Plantilla RRHH · ${agregats.size} registres · ${periodKeys.length} mesos (${mesosLabel})`,
    creatPer: opts.creatPer,
  });

  const rows = [...agregats.values()].map((a) => {
    const key = `${a.any}-${String(a.mes).padStart(2, "0")}`;
    const periodId = periodIdByKey.get(key)!;
    const texts = [...a.texts];
    return {
      periodId,
      centreId: a.centreId,
      departamentId: a.departamentId,
      nombrePersones: a.nombrePersones,
      textOrigen: texts.length === 1 ? texts[0]! : texts.slice(0, 3).join(" · "),
      carregaId,
    };
  });

  // createMany en lots
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.plantillaRrhh.createMany({ data: rows.slice(i, i + CHUNK) });
  }

  return {
    ok: true,
    missatge: `Importat: ${rows.length} registres · ${periodKeys.length} mesos (${mesosLabel}).${
      senseMapeig ? ` ${senseMapeig} files sense mapeig.` : ""
    }`,
    filesImportades: rows.length,
    periodes: periodKeys.length,
    senseMapeig,
    errors,
  };
}

export async function llistaPlantillaRrhh(any: number | null, mes: number | null) {
  const rows = await db.plantillaRrhh.findMany({
    where: {
      ...(any != null || mes != null
        ? {
            period: {
              ...(any != null ? { any } : {}),
              ...(mes != null ? { mes } : {}),
            },
          }
        : {}),
    },
    orderBy: [
      { period: { any: "desc" } },
      { period: { mes: "desc" } },
      { centre: { codi: "asc" } },
    ],
    select: {
      id: true,
      nombrePersones: true,
      textOrigen: true,
      centre: { select: { codi: true, nom: true } },
      departament: { select: { codi: true, nom: true } },
      period: { select: { any: true, mes: true, nom: true } },
    },
    take: 5000,
  });

  return rows.map((r) => ({
    id: r.id,
    nombrePersones: r.nombrePersones,
    textOrigen: r.textOrigen,
    centreLabel: `${r.centre.codi} · ${r.centre.nom}`,
    centreCodi: r.centre.codi,
    dept: r.departament ? `${r.departament.codi} · ${r.departament.nom}` : "— (centre)",
    periodNom: r.period.nom,
    periodAny: r.period.any,
    periodMes: r.period.mes,
  }));
}

export async function getAnysAmbPlantillaRrhh(): Promise<number[]> {
  const rows = await db.period.findMany({
    where: { plantillesRrhh: { some: {} } },
    select: { any: true },
    distinct: ["any"],
    orderBy: { any: "desc" },
  });
  return rows.map((r) => r.any);
}
