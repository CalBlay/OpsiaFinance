import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
/**
 * Inventari empíric Cal Blay ↔ FDLC per definir normes de consolidació de zero.
 *
 * Busca operacions als nodes candidats (compres, aprovisionaments, consums,
 * altres ingressos, arrendaments i canons, …) a:
 *  - LN00007 (empresa FDLC)
 *  - CCR00008 (mirall Font de la Canya · Cal Blay)
 *  - resta de LN/centres Cal Blay
 * i proposa parells per coincidència d'import absolut al mateix període.
 *
 * Executar (terminal fora de Cursor si Cylance bloqueja):
 *   cd C:\dev\OpsiaFinance
 *   npx tsx scripts/inventari-consolidacio-grup.ts
 *   npx tsx scripts/inventari-consolidacio-grup.ts --any=2026 --mes=2
 */
import { config } from "dotenv";

config({ path: "apps/frontend/.env.local" });
config({ path: ".env.local" });
config({ path: ".env" });

const FDLC_LN = "LN00007";
const MIRALL_CENTRE = "CCR00008";

/** Nodes de detall on acostumen a viure operacions inter-grup (no subtotals). */
const NODES_CANDIDATS = [3, 4, 7, 8, 9, 18, 20, 25, 26, 29] as const;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL no definit (apps/frontend/.env.local)");
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

type AggRow = {
  any: number;
  mes: number;
  node: number;
  descripcio: string;
  lnCodi: string;
  centreCodi: string | null;
  import: number;
  origen: "fdlc" | "mirall" | "calblay";
};

function parseArgs() {
  const anyArg = process.argv.find((a) => a.startsWith("--any="));
  const mesArg = process.argv.find((a) => a.startsWith("--mes="));
  return {
    any: anyArg ? Number(anyArg.split("=")[1]) : undefined,
    mes: mesArg ? Number(mesArg.split("=")[1]) : undefined,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function carregarAgregats(filtre?: { any?: number; mes?: number }): Promise<AggRow[]> {
  const periodWhere =
    filtre?.any != null
      ? { any: filtre.any, ...(filtre.mes != null ? { mes: filtre.mes } : {}) }
      : undefined;

  const dades = await db.dadaResultat.findMany({
    where: {
      import_: { not: 0 },
      concepteResultat: { node: { in: [...NODES_CANDIDATS] }, esSubtotal: false },
      ...(periodWhere ? { period: periodWhere } : {}),
    },
    select: {
      import_: true,
      senseCentre: true,
      period: { select: { any: true, mes: true } },
      concepteResultat: { select: { node: true, descripcio: true } },
      centre: { select: { codi: true, liniaNegoci: { select: { codi: true } } } },
      liniaNegoci: { select: { codi: true } },
      importacio: { select: { liniaNegoci: { select: { codi: true } } } },
    },
  });

  const rows: AggRow[] = [];
  for (const d of dades) {
    const lnCodi =
      d.liniaNegoci?.codi ?? d.importacio.liniaNegoci?.codi ?? d.centre?.liniaNegoci.codi ?? "?";
    const centreCodi = d.centre?.codi ?? (d.senseCentre ? "(sense centre)" : null);
    let origen: AggRow["origen"] = "calblay";
    if (lnCodi === FDLC_LN) origen = "fdlc";
    else if (centreCodi === MIRALL_CENTRE) origen = "mirall";

    rows.push({
      any: d.period.any,
      mes: d.period.mes,
      node: d.concepteResultat.node,
      descripcio: d.concepteResultat.descripcio,
      lnCodi,
      centreCodi,
      import: Number(d.import_),
      origen,
    });
  }

  // Agregar clau període+node+ln+centre+origen
  const map = new Map<string, AggRow>();
  for (const r of rows) {
    const key = `${r.any}|${r.mes}|${r.node}|${r.lnCodi}|${r.centreCodi ?? ""}|${r.origen}`;
    const prev = map.get(key);
    if (prev) prev.import = round2(prev.import + r.import);
    else map.set(key, { ...r });
  }
  return [...map.values()].filter((r) => r.import !== 0);
}

function resumPerOrigenNode(rows: AggRow[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = `${r.origen}|${r.node}|${r.descripcio}`;
    map.set(k, round2((map.get(k) ?? 0) + r.import));
  }
  return [...map.entries()]
    .map(([k, import_]) => {
      const [origen, node, descripcio] = k.split("|");
      return { origen, node: Number(node), descripcio, import: import_ };
    })
    .sort((a, b) => a.origen.localeCompare(b.origen) || a.node - b.node);
}

function buscarParells(rows: AggRow[]) {
  const byPeriod = new Map<string, AggRow[]>();
  for (const r of rows) {
    const k = `${r.any}-${r.mes}`;
    const list = byPeriod.get(k) ?? [];
    list.push(r);
    byPeriod.set(k, list);
  }

  const parells: {
    periode: string;
    absImport: number;
    a: Pick<AggRow, "origen" | "node" | "descripcio" | "lnCodi" | "centreCodi" | "import">;
    b: Pick<AggRow, "origen" | "node" | "descripcio" | "lnCodi" | "centreCodi" | "import">;
    signesOposats: boolean;
  }[] = [];

  for (const [periode, list] of byPeriod) {
    const fdlc = list.filter((r) => r.origen === "fdlc");
    const altres = list.filter((r) => r.origen !== "fdlc");
    for (const a of altres) {
      for (const b of fdlc) {
        const absA = Math.abs(a.import);
        const absB = Math.abs(b.import);
        if (absA < 1 || absB < 1) continue;
        if (Math.abs(absA - absB) > 0.05) continue;
        parells.push({
          periode,
          absImport: absA,
          a: {
            origen: a.origen,
            node: a.node,
            descripcio: a.descripcio,
            lnCodi: a.lnCodi,
            centreCodi: a.centreCodi,
            import: a.import,
          },
          b: {
            origen: b.origen,
            node: b.node,
            descripcio: b.descripcio,
            lnCodi: b.lnCodi,
            centreCodi: b.centreCodi,
            import: b.import,
          },
          signesOposats: a.import * b.import < 0,
        });
      }
    }
  }

  parells.sort((x, y) => y.absImport - x.absImport || y.periode.localeCompare(x.periode));
  return parells;
}

function proposarNormes(parells: ReturnType<typeof buscarParells>) {
  const freq = new Map<
    string,
    { count: number; exemples: number; nodeA: number; descA: string; nodeB: number; descB: string }
  >();
  for (const p of parells) {
    const key = `${p.a.node}|${p.b.node}|${p.a.origen}`;
    const prev = freq.get(key);
    if (prev) {
      prev.count += 1;
      prev.exemples += 1;
    } else {
      freq.set(key, {
        count: 1,
        exemples: 1,
        nodeA: p.a.node,
        descA: p.a.descripcio,
        nodeB: p.b.node,
        descB: p.b.descripcio,
      });
    }
  }
  return [...freq.values()]
    .sort((a, b) => b.count - a.count)
    .map((f) => ({
      tipus: "ELIMINAR_PARELL_INTER" as const,
      calblayNode: f.nodeA,
      calblayDesc: f.descA,
      fdlcNode: f.nodeB,
      fdlcDesc: f.descB,
      coincidencies: f.count,
      nota: "Candidata empírica — validar abans d'activar",
    }));
}

async function main() {
  const filtre = parseArgs();
  console.log("Inventari consolidació grup · nodes", NODES_CANDIDATS.join(", "));
  if (filtre.any) console.log(`Filtre: any=${filtre.any}${filtre.mes ? ` mes=${filtre.mes}` : ""}`);

  const [lnFdlc, mirall, conceptes] = await Promise.all([
    db.liniaNegoci.findUnique({
      where: { codi: FDLC_LN },
      include: { centres: { select: { codi: true, nom: true }, orderBy: { codi: "asc" } } },
    }),
    db.centre.findFirst({
      where: { codi: MIRALL_CENTRE },
      include: { liniaNegoci: { select: { codi: true, nom: true } } },
    }),
    db.concepteResultat.findMany({
      where: { node: { in: [...NODES_CANDIDATS] } },
      orderBy: { node: "asc" },
      select: { node: true, descripcio: true },
    }),
  ]);

  console.log("\n=== Perimeter ===");
  console.log(
    "LN00007:",
    lnFdlc
      ? `${lnFdlc.nom} · centres: ${lnFdlc.centres.map((c) => c.codi).join(", ") || "(cap)"}`
      : "NO TROBADA"
  );
  console.log(
    "CCR00008:",
    mirall
      ? `${mirall.nom} · LN ${mirall.liniaNegoci.codi} (${mirall.liniaNegoci.nom})  ← mirall Cal Blay, NO és LN FDLC`
      : "NO TROBAT"
  );
  console.log("Nodes candidats:", conceptes.map((c) => `${c.node}=${c.descripcio}`).join(" | "));

  const rows = await carregarAgregats(filtre);
  console.log(`\nFiles agregades (nodes candidats): ${rows.length}`);

  const perOrigen = {
    fdlc: rows.filter((r) => r.origen === "fdlc"),
    mirall: rows.filter((r) => r.origen === "mirall"),
    calblay: rows.filter((r) => r.origen === "calblay"),
  };
  console.log(
    `  FDLC=${perOrigen.fdlc.length} · mirall CCR00008=${perOrigen.mirall.length} · resta Cal Blay=${perOrigen.calblay.length}`
  );

  console.log("\n=== Suma per origen × node (tot el rang) ===");
  console.table(resumPerOrigenNode(rows));

  console.log("\n=== Top 40 imports Cal Blay (excl. mirall) als nodes candidats ===");
  console.table(
    [...perOrigen.calblay]
      .sort((a, b) => Math.abs(b.import) - Math.abs(a.import))
      .slice(0, 40)
      .map((r) => ({
        periode: `${r.any}-${String(r.mes).padStart(2, "0")}`,
        ln: r.lnCodi,
        centre: r.centreCodi,
        node: r.node,
        concepte: r.descripcio,
        import: r.import,
      }))
  );

  console.log("\n=== Top 40 imports FDLC ===");
  console.table(
    [...perOrigen.fdlc]
      .sort((a, b) => Math.abs(b.import) - Math.abs(a.import))
      .slice(0, 40)
      .map((r) => ({
        periode: `${r.any}-${String(r.mes).padStart(2, "0")}`,
        centre: r.centreCodi,
        node: r.node,
        concepte: r.descripcio,
        import: r.import,
      }))
  );

  console.log("\n=== Top 20 mirall CCR00008 ===");
  console.table(
    [...perOrigen.mirall]
      .sort((a, b) => Math.abs(b.import) - Math.abs(a.import))
      .slice(0, 20)
      .map((r) => ({
        periode: `${r.any}-${String(r.mes).padStart(2, "0")}`,
        ln: r.lnCodi,
        node: r.node,
        concepte: r.descripcio,
        import: r.import,
      }))
  );

  const parells = buscarParells(rows);
  console.log(`\n=== Parells |import| coincident Cal Blay/mirall ↔ FDLC: ${parells.length} ===`);
  console.table(
    parells.slice(0, 60).map((p) => ({
      periode: p.periode,
      abs: p.absImport,
      cb_origen: p.a.origen,
      cb_ln: p.a.lnCodi,
      cb_centre: p.a.centreCodi,
      cb_node: `${p.a.node} ${p.a.descripcio}`,
      cb_imp: p.a.import,
      f_node: `${p.b.node} ${p.b.descripcio}`,
      f_imp: p.b.import,
      oposat: p.signesOposats,
    }))
  );

  const normes = proposarNormes(parells);
  console.log("\n=== Candidats a normes noves (freqüència de coincidències) ===");
  console.table(normes);

  const out = {
    generat: new Date().toISOString(),
    filtre,
    perimeter: {
      fdlcLn: lnFdlc,
      mirall,
      nodesCandidats: conceptes,
    },
    resumOrigenNode: resumPerOrigenNode(rows),
    parells: parells.slice(0, 200),
    normesCandidatas: normes,
    nota: [
      "LN00007 = empresa FDLC.",
      "CCR00008 = centre restaurant Cal Blay (mirall serveis FDLC), no és el centre hotel FDLC.",
      "Les normes del seed antic (node 26 lloguer) queden obsoletes: arrendaments i canons = node 18.",
      "Validar cada candidat amb SAP / Excel abans d'activar a Settings.",
    ],
  };

  const outPath = resolve("scripts/inventari-consolidacio-grup-out.json");
  writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`\nInforme JSON: ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
