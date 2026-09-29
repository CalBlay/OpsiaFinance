/**
 * Auto-mapeig plantilla RRHH: text organització → centre (+ dept) per coincidència de nom.
 */

import { indexaCentrePerNom, normalitzaNomRestaurant } from "@/lib/cost-salarial/restaurant-noms";
import { db } from "@/lib/db";
import { normalitzarTextOrgPlantilla } from "@/lib/rrhh-plantilla/mapeig";
import { ORGS_PLANTILLA_RRHH_SEED } from "@/lib/rrhh-plantilla/orgs-seed";

export type PropostaOrgPlantilla = {
  text: string;
  centreId: string;
  centreCodi: string;
  centreNom: string;
  departamentId: string | null;
  departamentNom: string | null;
  puntuacio: number;
  motiu: string;
};

type DeptOpt = { id: string; codi: string; nom: string };
type CentreOpt = {
  id: string;
  codi: string;
  nom: string;
  lnCodi: string;
  departaments: DeptOpt[];
};

function normalitzaClau(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/^restaurant\s+/i, "")
    .replace(/\b(d|de|del|dels|la|l|el|els|les|i|y)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): Set<string> {
  return new Set(
    normalitzaClau(s)
      .split(" ")
      .filter((t) => t.length > 1)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Treu cues sala/cuina/neteja i sufixos «cuina central». */
function etiquetaSenseDept(text: string): string {
  return text
    .replace(/\b(sala|cuina|cocina)\s*$/iu, "")
    .replace(/\bcuina\s+central\b.*$/iu, "")
    .replace(/\b(netej[ae]|limpieza|cambrer\w*|cuiner\w*|admins?traci[oó]n?)\b.*$/iu, "")
    .replace(/\s*[-–/|]\s*$/u, "")
    .trim();
}

function trobarDepartamentPerEtiqueta(
  etiquetaRaw: string,
  depts: DeptOpt[]
): { dept: DeptOpt; puntuacio: number; motiu: string } | null {
  if (!depts.length) return null;
  const etiqueta = normalitzarTextOrgPlantilla(etiquetaRaw);
  const clau = normalitzaClau(etiqueta);
  if (!clau) return null;

  let millor: { dept: DeptOpt; puntuacio: number; motiu: string } | null = null;
  for (const d of depts) {
    const cn = normalitzaClau(d.nom);
    if (!cn) continue;
    let puntuacio = 0;
    let motiu = "";
    if (clau === cn) {
      puntuacio = 95;
      motiu = "nom departament exacte";
    } else if (clau.includes(cn) || cn.includes(clau)) {
      const curt = Math.min(clau.length, cn.length);
      if (curt >= 5) {
        puntuacio = 80;
        motiu = "nom departament contingut";
      }
    } else {
      const score = jaccard(tokens(clau), tokens(cn));
      if (score >= 0.5) {
        puntuacio = Math.round(62 + score * 28);
        motiu = "nom departament (parcial)";
      }
    }
    if (puntuacio && (!millor || puntuacio > millor.puntuacio)) {
      millor = { dept: d, puntuacio, motiu };
    }
  }
  return millor && millor.puntuacio >= 70 ? millor : null;
}

function trobarCentrePerOrg(
  etiquetaRaw: string,
  centres: CentreOpt[],
  byRestaurant: Map<string, CentreOpt>
): { centre: CentreOpt; puntuacio: number; motiu: string } | null {
  const etiqueta = normalitzarTextOrgPlantilla(etiquetaRaw);
  if (!etiqueta || etiqueta.length < 2) return null;

  const senseDept = etiquetaSenseDept(etiqueta) || etiqueta;
  const clau = normalitzaClau(senseDept);
  const clauFull = normalitzaClau(etiqueta);
  const clauRest = normalitzaNomRestaurant(senseDept);
  const toks = tokens(senseDept);

  const rest = byRestaurant.get(clauRest) ?? byRestaurant.get(clau);
  if (rest) {
    return { centre: rest, puntuacio: 96, motiu: "nom restaurant" };
  }

  // Alias locals plantilla
  const aliasLocals: Record<string, string> = {
    juno: "juno house",
    "la masia": "masia esplugues",
    masia: "masia esplugues",
    plural: "valkiria",
    "cuina administracio": "cuina central",
    "cuina adminsitracio": "cuina central",
    "bases cuina central": "cuina central",
    "events cuina central": "cuina central",
    "neteja cuina central": "cuina central",
    "precuinats cuina central": "cuina central",
    "recepcio cuina central": "cuina central",
    "torn nit cuina central": "cuina central",
    "sortides catering": "cuina central",
    "administracio logistica": "logistica",
    "comercials grups": "comercials grups",
  };
  for (const [from, to] of Object.entries(aliasLocals)) {
    if (clauFull === from || clau === from) {
      const hit =
        byRestaurant.get(to) ??
        centres.find((c) => normalitzaClau(c.nom) === to || normalitzaNomRestaurant(c.nom) === to);
      if (hit) return { centre: hit, puntuacio: 90, motiu: `alias «${from}»` };
    }
  }

  let millor: { centre: CentreOpt; puntuacio: number; motiu: string } | null = null;
  for (const c of centres) {
    const cn = normalitzaClau(c.nom);
    const cnRest = normalitzaNomRestaurant(c.nom);
    if (!cn) continue;

    let puntuacio = 0;
    let motiu = "";

    if (clau === cn || clauFull === cn || clauRest === cnRest) {
      puntuacio = 100;
      motiu = "coincidència exacta";
    } else if (
      clauFull.includes(cn) ||
      cn.includes(clauFull) ||
      clau.includes(cn) ||
      cn.includes(clau)
    ) {
      const curt = Math.min(Math.max(clau.length, clauFull.length), cn.length);
      if (curt >= 8) {
        puntuacio = 88;
        motiu = "nom contingut";
      } else if (
        curt >= 5 &&
        (clau.startsWith(cn) || cn.startsWith(clau) || clauFull.startsWith(cn))
      ) {
        puntuacio = 82;
        motiu = "prefix del nom";
      }
    } else {
      const j = Math.max(jaccard(toks, tokens(c.nom)), jaccard(tokens(etiqueta), tokens(c.nom)));
      if (j >= 0.75) {
        puntuacio = 78;
        motiu = `tokens ${(j * 100).toFixed(0)}%`;
      } else if (j >= 0.55 && toks.size >= 2) {
        puntuacio = 72;
        motiu = `tokens ${(j * 100).toFixed(0)}%`;
      }
    }

    if (puntuacio >= 70 && (!millor || puntuacio > millor.puntuacio)) {
      millor = { centre: c, puntuacio, motiu };
    }
  }

  return millor;
}

/**
 * Parents d’agregació que normalment NO cal mapear (són sumes).
 * Si hi ha un centre amb el mateix nom, sí que els proposem.
 */
const ORGS_NOMES_AGRUPADORS = new Set(
  ["Restauració", "Cuina restaurants", "Sala restaurants"].map((t) => normalitzaClau(t))
);

export async function proposarMapeigOrgPlantilla(
  texts: string[] = ORGS_PLANTILLA_RRHH_SEED
): Promise<{ propostes: PropostaOrgPlantilla[]; senseMatch: string[] }> {
  const centresRaw = await db.centre.findMany({
    where: { isActive: true },
    select: {
      id: true,
      codi: true,
      nom: true,
      liniaNegoci: { select: { codi: true } },
      departaments: {
        where: { isActive: true },
        select: { id: true, codi: true, nom: true },
        orderBy: { ordre: "asc" },
      },
    },
  });
  const centres: CentreOpt[] = centresRaw.map((c) => ({
    id: c.id,
    codi: c.codi,
    nom: c.nom,
    lnCodi: c.liniaNegoci.codi,
    departaments: c.departaments,
  }));

  const byRestaurant = new Map<string, CentreOpt>();
  for (const c of centres.filter((x) => x.lnCodi === "LN00001")) {
    indexaCentrePerNom(byRestaurant, c);
  }

  // Unic per text normalitzat
  const vistos = new Set<string>();
  const propostes: PropostaOrgPlantilla[] = [];
  const senseMatch: string[] = [];

  for (const raw of texts) {
    const text = normalitzarTextOrgPlantilla(raw);
    if (!text) continue;
    const clauUnica = text.toLocaleLowerCase("ca");
    if (vistos.has(clauUnica)) continue;
    vistos.add(clauUnica);

    const hit = trobarCentrePerOrg(text, centres, byRestaurant);
    if (!hit) {
      // Agrupadors purs: no cal avisar com a error greu
      if (!ORGS_NOMES_AGRUPADORS.has(normalitzaClau(text))) {
        senseMatch.push(text);
      }
      continue;
    }

    let departamentId: string | null = null;
    let departamentNom: string | null = null;
    let motiu = hit.motiu;
    let puntuacio = hit.puntuacio;

    // Preferir dept si el text sembla un departament (no restaurant sala/cuina pur)
    const esRestSalaCuina = /\b(sala|cuina)\s*$/iu.test(text) && hit.motiu === "nom restaurant";
    if (!esRestSalaCuina || hit.centre.departaments.length) {
      const deptHit = trobarDepartamentPerEtiqueta(text, hit.centre.departaments);
      if (deptHit && (!esRestSalaCuina || deptHit.puntuacio >= 85)) {
        // Per restaurants sala/cuina només assigna dept si match molt fort
        if (!esRestSalaCuina || /\b(sala|cuina)\b/iu.test(deptHit.dept.nom)) {
          departamentId = deptHit.dept.id;
          departamentNom = deptHit.dept.nom;
          motiu = `${hit.motiu} + ${deptHit.motiu}`;
          puntuacio = Math.min(99, Math.round((hit.puntuacio + deptHit.puntuacio) / 2 + 5));
        }
      }
    }

    // Fills de Cuina Central / Oficines / Planta: si el centre és el pare, busca dept
    if (!departamentId && hit.centre.departaments.length) {
      const deptHit = trobarDepartamentPerEtiqueta(text, hit.centre.departaments);
      if (deptHit) {
        departamentId = deptHit.dept.id;
        departamentNom = deptHit.dept.nom;
        motiu = `${hit.motiu} + ${deptHit.motiu}`;
      }
    }

    propostes.push({
      text,
      centreId: hit.centre.id,
      centreCodi: hit.centre.codi,
      centreNom: hit.centre.nom,
      departamentId,
      departamentNom,
      puntuacio,
      motiu,
    });
  }

  propostes.sort((a, b) => a.text.localeCompare(b.text, "ca", { sensitivity: "base" }));
  senseMatch.sort((a, b) => a.localeCompare(b, "ca", { sensitivity: "base" }));
  return { propostes, senseMatch };
}

export async function aplicarPropostesMapeigOrgPlantilla(
  propostes: PropostaOrgPlantilla[],
  substituirTot = false
): Promise<{ creats: number; actualitzats: number }> {
  if (substituirTot) {
    await db.mapeigOrgPlantilla.deleteMany({});
  }

  let creats = 0;
  let actualitzats = 0;
  for (let i = 0; i < propostes.length; i++) {
    const p = propostes[i];
    if (!p) continue;
    const prev = await db.mapeigOrgPlantilla.findUnique({ where: { text: p.text } });
    await db.mapeigOrgPlantilla.upsert({
      where: { text: p.text },
      update: {
        centreId: p.centreId,
        departamentId: p.departamentId,
        isActive: true,
        ordre: i,
      },
      create: {
        text: p.text,
        centreId: p.centreId,
        departamentId: p.departamentId,
        ordre: i,
      },
    });
    if (prev) actualitzats++;
    else creats++;
  }
  return { creats, actualitzats };
}

/** Genera i desa mapeigs a partir de la llista seed (o una llista custom). */
export async function generarMapeigOrgPlantillaAuto(opts?: {
  texts?: string[];
  substituirTot?: boolean;
  puntuacioMinima?: number;
}): Promise<{
  creats: number;
  actualitzats: number;
  propostes: number;
  senseMatch: string[];
  aplicades: PropostaOrgPlantilla[];
}> {
  const { propostes, senseMatch } = await proposarMapeigOrgPlantilla(opts?.texts);
  const min = opts?.puntuacioMinima ?? 70;
  const aplicables = propostes.filter((p) => p.puntuacio >= min);
  const { creats, actualitzats } = await aplicarPropostesMapeigOrgPlantilla(
    aplicables,
    opts?.substituirTot ?? false
  );
  return {
    creats,
    actualitzats,
    propostes: propostes.length,
    senseMatch,
    aplicades: aplicables,
  };
}
