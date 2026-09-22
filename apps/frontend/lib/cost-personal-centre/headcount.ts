export type HeadcountRow = {
  centreId: string;
  departamentId: string | null;
  origen: "NOMINA" | "MILLORES";
  nombrePersones: number;
  period: { mes: number };
};

export type HeadcountAgregat = {
  perClau: Map<string, number>;
  total: number | null;
  esMitjana: boolean;
};

/**
 * Agrega persones sense duplicar nòmina + millores.
 * En vista anual retorna la mitjana dels mesos amb headcount disponible.
 */
export function agregarHeadcount(
  rows: HeadcountRow[],
  mes: number | null,
  keyFor: (row: HeadcountRow) => string | null
): HeadcountAgregat {
  const perUnitat = new Map<
    string,
    { key: string; mes: number; nomina: number; millores: number }
  >();

  for (const row of rows) {
    if (row.nombrePersones <= 0) continue;
    const key = keyFor(row);
    if (!key) continue;
    const unitat = `${row.period.mes}::${row.centreId}::${row.departamentId ?? "_"}::${key}`;
    const prev = perUnitat.get(unitat) ?? {
      key,
      mes: row.period.mes,
      nomina: 0,
      millores: 0,
    };
    if (row.origen === "NOMINA") prev.nomina += row.nombrePersones;
    else prev.millores += row.nombrePersones;
    perUnitat.set(unitat, prev);
  }

  const mesos = new Set([...perUnitat.values()].map((row) => row.mes));
  if (!mesos.size) return { perClau: new Map(), total: null, esMitjana: mes == null };

  const divisor = mes == null ? mesos.size : 1;
  const perClau = new Map<string, number>();
  for (const row of perUnitat.values()) {
    const persones = row.nomina || row.millores;
    perClau.set(row.key, (perClau.get(row.key) ?? 0) + persones / divisor);
  }

  return {
    perClau,
    total: [...perClau.values()].reduce((sum, nombre) => sum + nombre, 0),
    esMitjana: mes == null,
  };
}
