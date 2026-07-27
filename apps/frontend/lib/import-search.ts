import type { EstatImport } from "@/types";

export type ImportCercaItem = {
  id: string;
  nomFitxer: string;
  lnCodi: string | null;
  lnNom: string | null;
  formatNom: string | null;
  periodNom: string | null;
  periodAny: number | null;
  periodMes: number | null;
  estat: EstatImport;
  estatLabel: string;
  autor: string;
  dataCarrega: string;
};

const MESOS: Record<string, number> = {
  gener: 1,
  febrer: 2,
  març: 3,
  marc: 3,
  abril: 4,
  maig: 5,
  juny: 6,
  juliol: 7,
  agost: 8,
  setembre: 9,
  octubre: 10,
  novembre: 11,
  desembre: 12,
};

const ESTAT_LABELS: Record<EstatImport, string> = {
  PENDENT: "pendent",
  CLASSIFICAT: "classificat",
  REVISAT: "revisat",
  CONFIRMAT: "confirmat",
  ERROR: "error",
  ARXIVAT: "arxivat",
};

function normalitzar(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function variantsToken(token: string): string[] {
  const t = normalitzar(token);
  const variants = new Set<string>([t]);

  if (/^ln?0*\d+$/i.test(t)) {
    const n = Number.parseInt(t.replace(/\D/g, ""), 10);
    variants.add(`ln${String(n).padStart(5, "0")}`);
    variants.add(String(n));
    variants.add(String(n).padStart(2, "0"));
  }

  const mes = MESOS[t];
  if (mes) {
    variants.add(String(mes));
    variants.add(String(mes).padStart(2, "0"));
  }

  if (/^\d{4}$/.test(t)) variants.add(t);
  if (/^\d{1,2}_\d{4}/.test(t)) variants.add(t.replace("_", " "));

  return [...variants];
}

function haystack(item: ImportCercaItem): string {
  const parts = [
    item.nomFitxer,
    item.lnCodi,
    item.lnNom,
    item.formatNom,
    item.periodNom,
    item.periodAny !== null ? String(item.periodAny) : null,
    item.periodMes !== null ? String(item.periodMes) : null,
    item.periodMes !== null ? String(item.periodMes).padStart(2, "0") : null,
    item.estat,
    item.estatLabel,
    ESTAT_LABELS[item.estat],
    item.autor,
    item.dataCarrega,
  ];

  if (item.lnCodi) {
    const n = Number.parseInt(item.lnCodi.replace(/\D/g, ""), 10);
    if (!Number.isNaN(n)) {
      parts.push(String(n).padStart(2, "0"));
      parts.push(String(n));
    }
  }

  if (item.periodMes !== null && item.periodAny !== null) {
    parts.push(`${String(item.periodMes).padStart(2, "0")}_${item.periodAny}`);
  }

  return normalitzar(parts.filter(Boolean).join(" "));
}

export type FiltresImport = {
  query: string;
  lnCodi: string;
  any: string;
  estat: string;
};

export function filtrarImports(
  items: ImportCercaItem[],
  filtres: FiltresImport
): ImportCercaItem[] {
  let result = items;

  const q = filtres.query.trim();
  if (q) {
    const tokens = q.split(/\s+/).filter(Boolean);
    result = result.filter((item) => {
      const h = haystack(item);
      return tokens.every((token) => variantsToken(token).some((v) => h.includes(v)));
    });
  }

  if (filtres.lnCodi) {
    result = result.filter((item) => item.lnCodi === filtres.lnCodi);
  }
  if (filtres.any) {
    const any = Number.parseInt(filtres.any, 10);
    result = result.filter((item) => item.periodAny === any);
  }
  if (filtres.estat) {
    result = result.filter((item) => item.estat === filtres.estat);
  }

  return result;
}

export function extreureFacetes(items: ImportCercaItem[]) {
  const lns = new Map<string, string>();
  const anys = new Set<number>();
  const estats = new Set<EstatImport>();

  for (const item of items) {
    if (item.lnCodi) lns.set(item.lnCodi, item.lnNom ?? item.lnCodi);
    if (item.periodAny !== null) anys.add(item.periodAny);
    estats.add(item.estat);
  }

  return {
    lns: [...lns.entries()]
      .map(([codi, nom]) => ({ codi, nom }))
      .sort((a, b) => a.codi.localeCompare(b.codi)),
    anys: [...anys].sort((a, b) => b - a),
    estats: [...estats],
  };
}
