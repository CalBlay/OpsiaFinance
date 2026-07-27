import { db } from "@/lib/db";

export type ResumTraspassCentreFila = {
  mes: number;
  periodNom: string;
  origenCodi: string;
  origenNom: string;
  origenLnCodi: string;
  origenLnNom: string;
  destiCodi: string;
  destiNom: string;
  destiLnCodi: string;
  destiLnNom: string;
  hores: number;
  import_: number;
};

export type ResumTraspassLnFila = {
  lnId: string;
  lnCodi: string;
  lnNom: string;
  mes: number;
  sortides: number;
  entrades: number;
  net: number;
};

export type ResumTraspassPersonal = {
  any: number;
  anysDisponibles: number[];
  perCentre: ResumTraspassCentreFila[];
  perLn: ResumTraspassLnFila[];
  volumTraspassAny: number;
  buit: boolean;
};

export async function getAnysAmbTraspassConfirmats(): Promise<number[]> {
  const periods = await db.period.findMany({
    where: { execucioTraspassPersonal: { estat: "CONFIRMAT" } },
    select: { any: true },
    distinct: ["any"],
    orderBy: { any: "desc" },
  });
  return periods.map((p) => p.any);
}

export async function getResumTraspassPersonal(any: number): Promise<ResumTraspassPersonal> {
  const [anysDisponibles, moviments] = await Promise.all([
    getAnysAmbTraspassConfirmats(),
    db.movimentTraspassPersonal.findMany({
      where: {
        execucio: { estat: "CONFIRMAT", period: { any } },
      },
      include: {
        execucio: { include: { period: { select: { mes: true, nom: true } } } },
        centreOrigen: {
          select: {
            codi: true,
            nom: true,
            liniaNegociId: true,
            liniaNegoci: { select: { codi: true, nom: true } },
          },
        },
        centreDesti: {
          select: {
            codi: true,
            nom: true,
            liniaNegociId: true,
            liniaNegoci: { select: { codi: true, nom: true } },
          },
        },
      },
      orderBy: [
        { execucio: { period: { mes: "asc" } } },
        { centreOrigen: { nom: "asc" } },
        { centreDesti: { nom: "asc" } },
      ],
    }),
  ]);

  const perCentre: ResumTraspassCentreFila[] = moviments.map((m) => ({
    mes: m.execucio.period.mes,
    periodNom: m.execucio.period.nom,
    origenCodi: m.centreOrigen.codi,
    origenNom: m.centreOrigen.nom,
    origenLnCodi: m.centreOrigen.liniaNegoci.codi,
    origenLnNom: m.centreOrigen.liniaNegoci.nom,
    destiCodi: m.centreDesti.codi,
    destiNom: m.centreDesti.nom,
    destiLnCodi: m.centreDesti.liniaNegoci.codi,
    destiLnNom: m.centreDesti.liniaNegoci.nom,
    hores: Number(m.hores),
    import_: Number(m.import_),
  }));

  const lnMap = new Map<string, ResumTraspassLnFila>();

  const ensureLn = (lnId: string, lnCodi: string, lnNom: string, mes: number) => {
    const key = `${lnId}|${mes}`;
    let row = lnMap.get(key);
    if (!row) {
      row = { lnId, lnCodi, lnNom, mes, sortides: 0, entrades: 0, net: 0 };
      lnMap.set(key, row);
    }
    return row;
  };

  for (const m of moviments) {
    const mes = m.execucio.period.mes;
    const imp = Number(m.import_);

    const outLn = m.centreOrigen.liniaNegoci;
    const inLn = m.centreDesti.liniaNegoci;

    ensureLn(m.centreOrigen.liniaNegociId, outLn.codi, outLn.nom, mes).sortides += imp;
    ensureLn(m.centreDesti.liniaNegociId, inLn.codi, inLn.nom, mes).entrades += imp;
  }

  const perLn = [...lnMap.values()]
    .map((r) => ({ ...r, net: r.entrades - r.sortides }))
    .sort((a, b) => a.lnCodi.localeCompare(b.lnCodi) || a.mes - b.mes);

  const volumTraspassAny = moviments.reduce((acc, m) => acc + Number(m.import_), 0);

  return {
    any,
    anysDisponibles,
    perCentre,
    perLn,
    volumTraspassAny,
    buit: moviments.length === 0,
  };
}
