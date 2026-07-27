import type { ResumTraspassLnFila } from "@/lib/traspass-personal/resum";

/** Matriu LN per presentació anual. */
export function pivotResumLn(perLn: ResumTraspassLnFila[]) {
  const byLn = new Map<
    string,
    {
      lnId: string;
      lnCodi: string;
      lnNom: string;
      mesos: Map<number, { sortides: number; entrades: number; net: number }>;
    }
  >();

  for (const r of perLn) {
    if (!byLn.has(r.lnId)) {
      byLn.set(r.lnId, {
        lnId: r.lnId,
        lnCodi: r.lnCodi,
        lnNom: r.lnNom,
        mesos: new Map(),
      });
    }
    byLn.get(r.lnId)!.mesos.set(r.mes, {
      sortides: r.sortides,
      entrades: r.entrades,
      net: r.net,
    });
  }

  return [...byLn.values()]
    .map((ln) => {
      const mesos = [...ln.mesos.entries()]
        .sort(([a], [b]) => a - b)
        .map(([mes, v]) => ({ mes, ...v }));
      const totalSortides = mesos.reduce((a, m) => a + m.sortides, 0);
      const totalEntrades = mesos.reduce((a, m) => a + m.entrades, 0);
      return {
        lnId: ln.lnId,
        lnCodi: ln.lnCodi,
        lnNom: ln.lnNom,
        mesos,
        totalSortides,
        totalEntrades,
        totalNet: totalEntrades - totalSortides,
      };
    })
    .sort((a, b) => a.lnCodi.localeCompare(b.lnCodi));
}
