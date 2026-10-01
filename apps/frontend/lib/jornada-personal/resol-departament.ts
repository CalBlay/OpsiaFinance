import { etiquetaSenseCodi } from "@/lib/cost-personal-centre/auto-mapeig";

export type DeptOpt = { id: string; codi: string; nom: string };

function normalitza(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sinònims / prefixos de la columna A → arrel del departament. */
const SINONIMS: Record<string, string[]> = {
  sala: [
    "sala",
    "cambrer",
    "cambrera",
    "cambrers",
    "camarero",
    "camarera",
    "camareros",
    "servicio",
    "servei",
    "maitre",
    "runner",
    "barra",
  ],
  cuina: ["cuina", "cocina", "cuiner", "cocinero", "cocinera", "chef", "fogons", "ajudant"],
  neteja: ["neteja", "limpieza", "netejador", "limpiador"],
  preparacio: ["preparacio", "preparacion", "preparador", "preproduccio", "preproduccion"],
  marketing: ["marketing", "mkt", "comunicacio", "comunicacion"],
  comercial: ["comercial", "vendes", "ventas"],
  administracio: ["administracio", "administracion", "oficina", "rrhh", "personal"],
  logistica: ["logistica", "magatzem", "almacen"],
};

/** Prefixos: «cambrer/a», «cambrers», «camarero»… → sala. */
const PREFIXOS: { prefix: string; arrel: string }[] = [
  { prefix: "cambrer", arrel: "sala" },
  { prefix: "camarer", arrel: "sala" },
  { prefix: "cuiner", arrel: "cuina" },
  { prefix: "cociner", arrel: "cuina" },
  { prefix: "prepar", arrel: "preparacio" },
  { prefix: "netej", arrel: "neteja" },
  { prefix: "limpi", arrel: "neteja" },
];

function tokens(s: string): string[] {
  return normalitza(s)
    .split(" ")
    .filter((t) => t.length >= 2);
}

function textTocaSinonim(clau: string, fragments: string[], sins: string[]): boolean {
  for (const s of sins) {
    if (clau === s || fragments.includes(s)) return true;
    if (new RegExp(`(?:^|\\s)${s}(?:\\s|$)`).test(clau)) return true;
  }
  return false;
}

function arrelDesDePrefix(clau: string, fragments: string[]): string | null {
  const cands = [clau, ...fragments];
  for (const c of cands) {
    for (const { prefix, arrel } of PREFIXOS) {
      if (c === prefix || c.startsWith(prefix)) return arrel;
    }
  }
  return null;
}

/**
 * Resol el departament (dimensió 3) a partir del text de la columna A
 * i dels departaments configurats al centre.
 */
export function resolDepartamentDesDeDescripcio(
  descripcioRaw: string,
  depts: DeptOpt[]
): { dept: DeptOpt; motiu: string } | null {
  if (!depts.length || !descripcioRaw.trim()) return null;

  const etiqueta = etiquetaSenseCodi(descripcioRaw);
  const clau = normalitza(etiqueta);
  if (!clau) return null;

  const fragments = [
    etiqueta,
    ...etiqueta.split(/[-–|/·,;:]+/).map((s) => s.trim()),
    ...tokens(etiqueta),
  ]
    .map(normalitza)
    .filter((s) => s.length >= 2);

  const arrelPrefix = arrelDesDePrefix(clau, fragments);

  let millor: { dept: DeptOpt; puntuacio: number; motiu: string } | null = null;

  for (const d of depts) {
    const cn = normalitza(d.nom);
    const cc = normalitza(d.codi);
    if (!cn && !cc) continue;

    let puntuacio = 0;
    let motiu = "";

    // Exacte / contingut
    if (clau === cn || (cc && clau === cc)) {
      puntuacio = 100;
      motiu = "coincidència exacta";
    } else if (fragments.some((f) => f === cn || (cc && f === cc))) {
      puntuacio = 96;
      motiu = "fragment = nom departament";
    } else if (cn.length >= 3 && (clau.includes(cn) || fragments.some((f) => f.includes(cn)))) {
      puntuacio = 88;
      motiu = "nom contingut a la descripció";
    } else if (cn.length >= 4 && cn.includes(clau) && clau.length >= 3) {
      puntuacio = 82;
      motiu = "descripció dins del nom";
    } else {
      // Prefixos: Cambrer/a → Sala
      if (arrelPrefix && (cn === arrelPrefix || cn.includes(arrelPrefix))) {
        puntuacio = 94;
        motiu = `prefix (${arrelPrefix})`;
      } else {
        // Sinònims: «cambrer» → Sala, «preparador» → Preparació…
        for (const [arrel, sins] of Object.entries(SINONIMS)) {
          const deptTocaArrel = cn === arrel || cn.includes(arrel) || sins.some((s) => cn === s);
          if (!deptTocaArrel) continue;
          if (textTocaSinonim(clau, fragments, sins)) {
            puntuacio = 92;
            motiu = `sinònim → ${arrel}`;
            break;
          }
        }
      }
    }

    if (puntuacio > 0 && (!millor || puntuacio > millor.puntuacio)) {
      millor = { dept: d, puntuacio, motiu };
    }
  }

  return millor && millor.puntuacio >= 80 ? { dept: millor.dept, motiu: millor.motiu } : null;
}
