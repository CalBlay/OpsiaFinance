export type HeadcountRow = {
  centreId: string;
  departamentId: string | null;
  nombrePersones: number;
  horesSetmanals: number;
  period: { mes: number };
};

export type HeadcountAgregat = {
  perClau: Map<string, number>;
  perClauHores: Map<string, number>;
  total: number | null;
  totalHores: number | null;
  esMitjana: boolean;
};

/**
 * Agrega persones i hores setmanals (font: plantilla jornada).
 * En vista anual retorna la mitjana dels mesos amb dades.
 */
export function agregarHeadcount(
  rows: HeadcountRow[],
  mes: number | null,
  keyFor: (row: HeadcountRow) => string | null
): HeadcountAgregat {
  const perUnitat = new Map<
    string,
    { key: string; mes: number; persones: number; hores: number }
  >();

  for (const row of rows) {
    if (mes != null && row.period.mes !== mes) continue;
    if (row.nombrePersones <= 0 && row.horesSetmanals <= 0) continue;
    const key = keyFor(row);
    if (!key) continue;
    const unitat = `${row.period.mes}::${row.centreId}::${row.departamentId ?? "_"}::${key}`;
    const prev = perUnitat.get(unitat) ?? {
      key,
      mes: row.period.mes,
      persones: 0,
      hores: 0,
    };
    prev.persones += row.nombrePersones;
    prev.hores += row.horesSetmanals;
    perUnitat.set(unitat, prev);
  }

  const mesos = new Set([...perUnitat.values()].map((row) => row.mes));
  if (!mesos.size) {
    return {
      perClau: new Map(),
      perClauHores: new Map(),
      total: null,
      totalHores: null,
      esMitjana: mes == null,
    };
  }

  const divisor = mes == null ? mesos.size : 1;
  const perClau = new Map<string, number>();
  const perClauHores = new Map<string, number>();
  for (const row of perUnitat.values()) {
    perClau.set(row.key, (perClau.get(row.key) ?? 0) + row.persones / divisor);
    perClauHores.set(row.key, (perClauHores.get(row.key) ?? 0) + row.hores / divisor);
  }

  return {
    perClau,
    perClauHores,
    total: [...perClau.values()].reduce((sum, n) => sum + n, 0),
    totalHores: [...perClauHores.values()].reduce((sum, n) => sum + n, 0),
    esMitjana: mes == null,
  };
}
