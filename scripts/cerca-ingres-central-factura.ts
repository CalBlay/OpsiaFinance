import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
/**
 * Busca l'ingrés 10414.38 (o parts) dins Central LN00000 maig —
 * especialment dins CCC00002 Vendes agregat.
 *
 *   npx tsx scripts/cerca-ingres-central-factura.ts --any=2026 --mes=5 --base=10414.38
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
  const base = Number(arg("base", "10414.38"));

  const lnCentral = await db.liniaNegoci.findUniqueOrThrow({
    where: { codi: "LN00000" },
    select: { id: true },
  });

  console.log(`Ingrés factura Masia la Blayeta = ${base} · Central ${any}-${mes}\n`);

  // 1) DadaResultat LN00000 nodes ingressos
  const dades = await db.dadaResultat.findMany({
    where: {
      period: { any, mes },
      importacio: { liniaNegociId: lnCentral.id },
      concepteResultat: { node: { in: [2, 3, 4] } },
      import_: { not: 0 },
    },
    select: {
      import_: true,
      concepteResultat: { select: { node: true, descripcio: true } },
      centre: { select: { codi: true, nom: true } },
      importacio: { select: { nomFitxer: true, id: true } },
    },
  });

  console.log("=== LN00000 · nodes 2/3/4 (cel·les) ===");
  console.table(
    dades
      .map((d) => ({
        node: d.concepteResultat.node,
        concepte: d.concepteResultat.descripcio,
        centre: d.centre ? `${d.centre.codi} · ${d.centre.nom}` : "(sense)",
        import: Number(d.import_),
        fitxer: d.importacio.nomFitxer,
      }))
      .sort((a, b) => a.node - b.node || Math.abs(b.import) - Math.abs(a.import))
  );

  const ccc2 = dades.find((d) => d.centre?.codi === "CCC00002" && d.concepteResultat.node === 2);
  const vendesCcc2 = ccc2 ? Number(ccc2.import_) : 0;
  console.log(`\nCCC00002 Vendes agregat = ${vendesCcc2}`);
  console.log(`  Factura ${base}`);
  console.log(`  Resta si la factura hi és a dins = ${round2(vendesCcc2 - base)}`);
  console.log(
    `  Conté la factura? ${vendesCcc2 >= base ? "POSSIBLE (agregat ≥ factura, sense desglossar)" : "NO (agregat < factura)"}`
  );

  // 2) ImportRow del mateix fitxer Central — detall per compte
  const importacioIds = [...new Set(dades.map((d) => d.importacio.id))];
  const rows = await db.importRow.findMany({
    where: {
      period: { any, mes },
      OR: [
        { importacioId: { in: importacioIds } },
        { importacio: { liniaNegociId: lnCentral.id }, period: { any, mes } },
      ],
    },
    select: {
      codiCompte: true,
      nomCompte: true,
      import_: true,
      centre: { select: { codi: true, nom: true } },
      importacio: { select: { nomFitxer: true, liniaNegoci: { select: { codi: true } } } },
    },
  });

  console.log(`\n=== ImportRow Central (files=${rows.length}) ===`);
  if (rows.length === 0) {
    console.log(
      "No hi ha ImportRow per Central: l'Excel SAP es desa agregat a DadaResultat (per centre×node), sense factura a factura."
    );
  } else {
    const hits = rows.filter((r) => Math.abs(Math.abs(Number(r.import_)) - base) <= 0.05);
    console.log(`Hits exactes ${base}: ${hits.length}`);
    console.table(
      hits.map((r) => ({
        codi: r.codiCompte,
        nom: r.nomCompte,
        centre: r.centre ? `${r.centre.codi} · ${r.centre.nom}` : "",
        import: Number(r.import_),
        fitxer: r.importacio.nomFitxer,
      }))
    );

    const prox = rows
      .map((r) => ({
        codi: r.codiCompte,
        nom: r.nomCompte,
        centre: r.centre ? `${r.centre.codi} · ${r.centre.nom}` : "",
        import: Number(r.import_),
        diff: round2(Math.abs(Math.abs(Number(r.import_)) - base)),
      }))
      .filter((r) => r.diff > 0.05 && r.diff <= 100 && r.import > 0)
      .sort((a, b) => a.diff - b.diff);
    console.log(`Pròxims positius (diff≤100): ${prox.length}`);
    console.table(prox.slice(0, 20));
  }

  // 3) Suma de vendes CCC00002 + altres que podrien formar 10414?
  console.log("\n=== Conclusió ===");
  console.log(`A DadaResultat NO hi ha cap cel·la = ${base} a LN00000 maig.`);
  if (vendesCcc2 >= base) {
    console.log(
      `L'únic lloc on POT estar amagada és dins CCC00002 · VENDES (${vendesCcc2}), com a part de l'agregat SAP.`
    );
    console.log(
      `Cal obrir l'Excel Central de maig (columna CCC00002 / compte de vendes a Masia la Blayeta) per confirmar-ho.`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
