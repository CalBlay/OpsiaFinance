import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
/**
 * Comprova si un import és base+IVA o coincideix amb cel·les ± IVA.
 *   npx tsx scripts/cerca-import-iva.ts --any=2026 --mes=5 --import=3580.34
 */
import { config } from "dotenv";

config({ path: "apps/frontend/.env.local" });
config({ path: ".env" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL no definit (apps/frontend/.env.local)");
}
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function arg(name: string, def?: string) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split("=")[1] : def;
}

async function main() {
  const any = Number(arg("any", "2026"));
  const mes = Number(arg("mes", "5"));
  const target = Number(arg("import", "3580.34"));
  const rates = [0.21, 0.1, 0.04];

  console.log(`Target ${target} · ${any}-${String(mes).padStart(2, "0")}\n`);
  console.log("Si el target és BRUT (amb IVA), la base seria:");
  for (const r of rates) {
    console.log(`  / (1+${r * 100}% IVA) = ${round2(target / (1 + r))}`);
  }
  console.log("Si el target és NET (sense IVA), el brut seria:");
  for (const r of rates) {
    console.log(`  * (1+${r * 100}% IVA) = ${round2(target * (1 + r))}`);
  }

  const lnCentral = await db.liniaNegoci.findUniqueOrThrow({
    where: { codi: "LN00000" },
    select: { id: true },
  });

  const dades = await db.dadaResultat.findMany({
    where: {
      period: { any, mes },
      import_: { not: 0 },
      OR: [{ importacio: { liniaNegociId: lnCentral.id } }, { liniaNegociId: lnCentral.id }],
    },
    select: {
      import_: true,
      concepteResultat: { select: { node: true, descripcio: true } },
      centre: { select: { codi: true, nom: true } },
      importacio: { select: { liniaNegoci: { select: { codi: true } } } },
    },
  });

  const candidates = [
    target,
    ...rates.map((r) => round2(target / (1 + r))),
    ...rates.map((r) => round2(target * (1 + r))),
  ];

  const hits: {
    cel·la: number;
    match_amb: number;
    com: string;
    node: number;
    concepte: string;
    centre: string;
    lnInf: string;
  }[] = [];

  for (const d of dades) {
    const v = round2(Number(d.import_));
    const abs = Math.abs(v);
    for (const c of candidates) {
      if (Math.abs(abs - Math.abs(c)) <= 0.05) {
        let com = "exacte target";
        if (Math.abs(c - target) > 0.05) {
          if (Math.abs(c - target / 1.21) <= 0.06) com = "base si target té IVA 21%";
          else if (Math.abs(c - target / 1.1) <= 0.06) com = "base si target té IVA 10%";
          else if (Math.abs(c - target * 1.21) <= 0.06) com = "brut IVA 21% sobre target";
          else if (Math.abs(c - target * 1.1) <= 0.06) com = "brut IVA 10% sobre target";
          else com = `variant ${c}`;
        }
        hits.push({
          cel·la: v,
          match_amb: c,
          com,
          node: d.concepteResultat.node,
          concepte: d.concepteResultat.descripcio,
          centre: d.centre ? `${d.centre.codi} · ${d.centre.nom}` : "(sense)",
          lnInf: d.importacio.liniaNegoci?.codi ?? "",
        });
      }
    }
    // També: cel·la * 1.21 ≈ target o cel·la / 1.21 ≈ target
    for (const r of rates) {
      if (Math.abs(abs * (1 + r) - Math.abs(target)) <= 0.05) {
        hits.push({
          cel·la: v,
          match_amb: target,
          com: `cel·la + IVA ${r * 100}% = target`,
          node: d.concepteResultat.node,
          concepte: d.concepteResultat.descripcio,
          centre: d.centre ? `${d.centre.codi} · ${d.centre.nom}` : "(sense)",
          lnInf: d.importacio.liniaNegoci?.codi ?? "",
        });
      }
      if (Math.abs(abs / (1 + r) - Math.abs(target)) <= 0.05) {
        hits.push({
          cel·la: v,
          match_amb: target,
          com: `cel·la és brut; net IVA ${r * 100}% = target`,
          node: d.concepteResultat.node,
          concepte: d.concepteResultat.descripcio,
          centre: d.centre ? `${d.centre.codi} · ${d.centre.nom}` : "(sense)",
          lnInf: d.importacio.liniaNegoci?.codi ?? "",
        });
      }
    }
  }

  // dedupe
  const seen = new Set<string>();
  const uniq = hits.filter((h) => {
    const k = `${h.cel·la}|${h.com}|${h.centre}|${h.node}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  console.log(`\nHits amb lògica IVA: ${uniq.length}`);
  console.table(uniq);

  const font = dades.find(
    (d) =>
      d.centre?.codi === "CCC00009" &&
      d.concepteResultat.node === 2 &&
      d.importacio.liniaNegoci?.codi === "LN00000"
  );
  if (font) {
    const v = Number(font.import_);
    console.log("\nReferència CCC00009 Vendes maig:");
    console.log(`  net BD = ${v}`);
    console.log(`  + IVA 10% = ${round2(v * 1.1)}`);
    console.log(`  + IVA 21% = ${round2(v * 1.21)}`);
    console.log(`  target    = ${target}`);
    console.log(`  diff vs +10% = ${round2(Math.abs(v * 1.1 - target))}`);
    console.log(`  diff vs +21% = ${round2(Math.abs(v * 1.21 - target))}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
