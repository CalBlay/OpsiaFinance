import {
  aplicarCapaVistaEvolucio,
  getCompteExplotacioCentre,
  getEvolucioMensualPerVista,
} from "@/lib/consultes";
import { db } from "@/lib/db";
import { type GrupEmpresa, filtraLiniesPerGrup } from "@/lib/grups-empresa";
import { NODE_VENDES } from "@/lib/kpi-definitions";
import { lnSuportaDetallCentres } from "@/lib/pressupost/detall-centres";
import { getCentresPressupostLn } from "@/lib/pressupost/tipus-a-data";
import { CODI_LN_CENTRAL } from "@/lib/repartiment/nodes";

export type SeguimentMes = {
  mes: number;
  pressupost: number;
  real: number;
  desviacio: number;
  desviacioPct: number | null;
};

export type SeguimentLnFila = {
  liniaNegociId: string;
  codi: string;
  nom: string;
  estat: "ESBORRANY" | "CONFIRMAT" | null;
  mesos: SeguimentMes[];
  /** Acumulat fins a `mesFins` (inclòs). */
  ytd: SeguimentMes;
};

export type SeguimentVendesLn = {
  any: number;
  mesFins: number;
  files: SeguimentLnFila[];
  total: SeguimentMes;
};

function desviacioPct(real: number, pressupost: number): number | null {
  if (Math.abs(pressupost) < 0.005) return null;
  return ((real - pressupost) / Math.abs(pressupost)) * 100;
}

function mesRow(mes: number, pressupost: number, real: number): SeguimentMes {
  const desviacio = real - pressupost;
  return {
    mes,
    pressupost,
    real,
    desviacio,
    desviacioPct: desviacioPct(real, pressupost),
  };
}

function acumular(mesos: SeguimentMes[], mesFins: number): SeguimentMes {
  let pressupost = 0;
  let real = 0;
  for (const m of mesos) {
    if (m.mes > mesFins) continue;
    pressupost += m.pressupost;
    real += m.real;
  }
  return mesRow(0, pressupost, real);
}

/**
 * Seguiment senzill: vendes pressupostades (Tipus A) vs real (vista Gestió) per LN.
 */
export async function getSeguimentVendesLn(opts: {
  any: number;
  grup: GrupEmpresa;
  mesFins?: number;
}): Promise<SeguimentVendesLn> {
  const { any, grup } = opts;
  const now = new Date();
  const mesFinsDefault = any === now.getFullYear() ? now.getMonth() + 1 : 12;
  const mesFins = Math.min(12, Math.max(1, opts.mesFins ?? mesFinsDefault));

  const [liniesAll, concepteVendes] = await Promise.all([
    db.liniaNegoci.findMany({
      where: { isActive: true },
      orderBy: { ordre: "asc" },
      select: { id: true, codi: true, nom: true },
    }),
    db.concepteResultat.findFirst({
      where: { isActive: true, node: NODE_VENDES },
      select: { id: true },
    }),
  ]);

  const vendesId = concepteVendes?.id ?? null;
  if (!vendesId) {
    return { any, mesFins, files: [], total: mesRow(0, 0, 0) };
  }

  const pressupostos = await db.pressupostLn.findMany({
    where: { any },
    select: {
      liniaNegociId: true,
      estat: true,
      cels: {
        where: { concepteResultatId: vendesId },
        select: { mes: true, import_: true },
      },
    },
  });

  const pressByLn = new Map(
    pressupostos.map((p) => [
      p.liniaNegociId,
      {
        estat: p.estat as "ESBORRANY" | "CONFIRMAT",
        perMes: (() => {
          const arr = Array.from({ length: 12 }, () => 0);
          for (const c of p.cels) {
            if (c.mes >= 1 && c.mes <= 12) arr[c.mes - 1] = Number(c.import_);
          }
          return arr;
        })(),
      },
    ])
  );

  const liniesGrup = filtraLiniesPerGrup(liniesAll, grup).filter((l) => l.codi !== CODI_LN_CENTRAL);

  const reals = await Promise.all(
    liniesGrup.map(async (ln) => {
      const perMes = Array.from({ length: 12 }, () => 0);
      try {
        const ev = await getEvolucioMensualPerVista("linia", ln.id, any, grup, "directe");
        if (ev.buit || !ev.concepts.length) return { id: ln.id, perMes };
        const concepts = await aplicarCapaVistaEvolucio(
          "linia",
          ln.id,
          any,
          ev.concepts,
          grup,
          "gestio"
        );
        const vendes = concepts.find((c) => c.node === NODE_VENDES);
        if (vendes) {
          for (let i = 0; i < 12; i++) perMes[i] = vendes.valors[i] ?? 0;
        }
      } catch {
        // LN sense dades: real = 0
      }
      return { id: ln.id, perMes };
    })
  );
  const realByLn = new Map(reals.map((r) => [r.id, r.perMes]));

  const files: SeguimentLnFila[] = liniesGrup.map((ln) => {
    const press = pressByLn.get(ln.id);
    const realArr = realByLn.get(ln.id) ?? Array.from({ length: 12 }, () => 0);
    const pressArr = press?.perMes ?? Array.from({ length: 12 }, () => 0);
    const mesos = Array.from({ length: 12 }, (_, i) =>
      mesRow(i + 1, pressArr[i] ?? 0, realArr[i] ?? 0)
    );
    return {
      liniaNegociId: ln.id,
      codi: ln.codi,
      nom: ln.nom,
      estat: press?.estat ?? null,
      mesos,
      ytd: acumular(mesos, mesFins),
    };
  });

  // Només LN amb pressuost o alguna venda real (evita llista buida de soroll)
  const filesVisibles = files.filter(
    (f) =>
      f.estat != null ||
      f.mesos.some((m) => Math.abs(m.real) > 0.005 || Math.abs(m.pressupost) > 0.005)
  );

  const totalMesos = Array.from({ length: 12 }, (_, i) => {
    let p = 0;
    let r = 0;
    for (const f of filesVisibles) {
      p += f.mesos[i]?.pressupost ?? 0;
      r += f.mesos[i]?.real ?? 0;
    }
    return mesRow(i + 1, p, r);
  });

  return {
    any,
    mesFins,
    files: filesVisibles,
    total: acumular(totalMesos, mesFins),
  };
}

export type CentreSeguimentOpt = {
  id: string;
  codi: string;
  nom: string;
};

/** Centres operatius d’una LN (si admet detall). */
export async function listCentresSeguimentLn(
  liniaNegociId: string,
  codiLn: string
): Promise<CentreSeguimentOpt[]> {
  if (!lnSuportaDetallCentres(codiLn)) return [];
  return getCentresPressupostLn(liniaNegociId, codiLn);
}

export type SeguimentCentre = {
  any: number;
  centreId: string;
  centreCodi: string;
  centreNom: string;
  mesos: SeguimentMes[];
};

/**
 * Seguiment vendes d’un centre: pressupost Tipus A (cel·les centre) vs real Gestió.
 */
export async function getSeguimentVendesCentre(opts: {
  any: number;
  liniaNegociId: string;
  centreId: string;
}): Promise<SeguimentCentre | null> {
  const { any, liniaNegociId, centreId } = opts;

  const [centre, concepteVendes, pressupost] = await Promise.all([
    db.centre.findFirst({
      where: { id: centreId, liniaNegociId, isActive: true },
      select: { id: true, codi: true, nom: true },
    }),
    db.concepteResultat.findFirst({
      where: { isActive: true, node: NODE_VENDES },
      select: { id: true },
    }),
    db.pressupostLn.findUnique({
      where: { any_liniaNegociId: { any, liniaNegociId } },
      select: { id: true },
    }),
  ]);

  if (!centre || !concepteVendes) return null;

  const pressArr = Array.from({ length: 12 }, () => 0);
  if (pressupost) {
    const cels = await db.pressupostCelCentre.findMany({
      where: {
        pressupostId: pressupost.id,
        centreId,
        concepteResultatId: concepteVendes.id,
      },
      select: { mes: true, import_: true },
    });
    for (const c of cels) {
      if (c.mes >= 1 && c.mes <= 12) pressArr[c.mes - 1] = Number(c.import_);
    }
  }

  const realArr = Array.from({ length: 12 }, () => 0);
  try {
    const compte = await getCompteExplotacioCentre(centreId, any, "gestio");
    const vendes = compte.concepts.find((c) => c.node === NODE_VENDES);
    if (vendes) {
      for (let i = 0; i < 12; i++) realArr[i] = vendes.valors[i] ?? 0;
    }
  } catch {
    // sense dades
  }

  const mesos = Array.from({ length: 12 }, (_, i) =>
    mesRow(i + 1, pressArr[i] ?? 0, realArr[i] ?? 0)
  );

  return {
    any,
    centreId: centre.id,
    centreCodi: centre.codi,
    centreNom: centre.nom,
    mesos,
  };
}
