/** Tipus i helpers de presentació RRHH (segurs per Client Components). */

export type RrhhDistribucioHores = {
  hores: number;
  persones: number;
};

export type RrhhFila = {
  key: string;
  label: string;
  sublabel?: string;
  nombrePersones: number;
  horesSetmanals: number;
  /** Hores mitjanes per persona (si persones > 0). */
  horesPerPersona: number | null;
  /** Resum de jornades: N persones a X hores. */
  distribucio: RrhhDistribucioHores[];
};

export type RrhhInforme = {
  any: number;
  mes: number | null;
  periodeLabel: string;
  totals: {
    nombrePersones: number;
    horesSetmanals: number;
    distribucio: RrhhDistribucioHores[];
  };
  files: RrhhFila[];
  buit: boolean;
};

export type RrhhComparativaFila = {
  key: string;
  label: string;
  sublabel?: string;
  personesA: number;
  personesB: number;
  deltaPersones: number;
  horesA: number;
  horesB: number;
  deltaHores: number;
};

export type RrhhComparativa = {
  labelA: string;
  labelB: string;
  totalsA: { nombrePersones: number; horesSetmanals: number };
  totalsB: { nombrePersones: number; horesSetmanals: number };
  files: RrhhComparativaFila[];
  buit: boolean;
};

export type RrhhMes = {
  mes: number;
  label: string;
  nombrePersones: number;
  horesSetmanals: number;
};

/** Text per UI: «4 a 40 h · 2 a 20 h · 1 a 15 h». */
export function formatDistribucioJornada(
  dist: RrhhDistribucioHores[],
  opts?: { decimalsPersones?: number; max?: number }
): string {
  const decimals = opts?.decimalsPersones ?? 0;
  const max = opts?.max ?? 8;
  const items = dist.slice(0, max);
  if (!items.length) return "—";
  const fmt = (n: number, d: number) =>
    n.toLocaleString("ca-ES", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });
  const parts = items.map((d) => {
    const p = decimals > 0 ? fmt(d.persones, decimals) : String(Math.round(d.persones));
    const h = Number.isInteger(d.hores) ? String(d.hores) : fmt(d.hores, 1);
    return `${p} a ${h} h`;
  });
  if (dist.length > max) parts.push(`+${dist.length - max}`);
  return parts.join(" · ");
}
