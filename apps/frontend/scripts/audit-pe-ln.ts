/**
 * Diagnòstic PE propi LN00002 (només lectura).
 *
 *   cd apps/frontend
 *   npx tsx scripts/audit-pe-ln.ts
 *   npx tsx scripts/audit-pe-ln.ts 2026 LN00002
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path: string): boolean {
  if (!existsSync(path)) return false;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
  console.log(`(env) carregat: ${path}`);
  return true;
}

for (const p of [
  resolve(process.cwd(), ".env.local"),
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../apps/frontend/.env.local"),
]) {
  loadEnvFile(p);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL no definit");
  process.exit(1);
}

async function main() {
  const any = process.argv[2] ? Number(process.argv[2]) : 2026;
  const codi = process.argv[3] ?? "LN00002";

  const { db } = await import("@/lib/db");
  const { getEvolucioMensualPerVista } = await import("@/lib/consultes");
  const { getMapaNaturaConceptes } = await import("@/lib/natura-map");
  const { aplicarBaseGestioPersonalEvolucioLn } = await import(
    "@/lib/cost-personal-centre/gestio-consultes"
  );
  const { aplicarVistaGestioEvolucioLn } = await import("@/lib/repartiment/gestio-consultes");
  const {
    calcularPuntEquilibri,
    calcularPuntEquilibriPropiLn,
    nMesosAmbIngressos,
    peMensualTeoric,
  } = await import("@/lib/punt-equilibri");
  const { NODE_INGRESSOS, NODE_COMPRES, NODE_COST_SALARIAL, NODE_COST_GESTIO, NODE_EBITDA } =
    await import("@/lib/kpi-definitions");

  const ln = await db.liniaNegoci.findUnique({
    where: { codi },
    select: { id: true, codi: true, nom: true },
  });
  if (!ln) {
    console.error("LN no trobada", codi);
    process.exit(1);
  }

  const natura = await getMapaNaturaConceptes();
  const evDirecte = await getEvolucioMensualPerVista("linia", ln.id, any, "calblay", "directe");
  if (!evDirecte) {
    console.error("Sense evolució Directe");
    process.exit(1);
  }

  const conceptsTraspass = await aplicarBaseGestioPersonalEvolucioLn(
    ln.id,
    any,
    evDirecte.concepts
  );
  const conceptsGestio = await aplicarVistaGestioEvolucioLn(ln.id, any, conceptsTraspass);

  const find = (concepts: typeof evDirecte.concepts, node: number) =>
    concepts.find((c) => c.node === node);

  const fmt = (n: number) => new Intl.NumberFormat("ca-ES", { maximumFractionDigits: 0 }).format(n);

  console.log(`\n=== ${ln.codi} ${ln.nom} · ${any} ===\n`);

  for (const [label, concepts] of [
    ["Directe", evDirecte.concepts],
    ["+Traspassos", conceptsTraspass],
    ["Gestió", conceptsGestio],
  ] as const) {
    const ing = find(concepts, NODE_INGRESSOS)?.total ?? 0;
    const com = find(concepts, NODE_COMPRES)?.total ?? 0;
    const per = find(concepts, NODE_COST_SALARIAL)?.total ?? 0;
    const ges = find(concepts, NODE_COST_GESTIO)?.total ?? 0;
    const ebitda = find(concepts, NODE_EBITDA)?.total ?? 0;
    console.log(
      `${label}: Ing=${fmt(ing)} Comp=${fmt(com)} Pers=${fmt(per)} Gest=${fmt(ges)} EBITDA=${fmt(ebitda)}`
    );
  }

  const peClassic = calcularPuntEquilibri(
    evDirecte.concepts.map((c) => ({ node: c.node, total: c.total, esSubtotal: c.esSubtotal })),
    natura
  );
  const pePropi = calcularPuntEquilibriPropiLn(
    {
      directe: evDirecte.concepts.map((c) => ({
        node: c.node,
        total: c.total,
        esSubtotal: c.esSubtotal,
      })),
      ambTraspassos: conceptsTraspass.map((c) => ({
        node: c.node,
        total: c.total,
        esSubtotal: c.esSubtotal,
      })),
      gestio: conceptsGestio.map((c) => ({
        node: c.node,
        total: c.total,
        esSubtotal: c.esSubtotal,
      })),
    },
    natura
  );

  const peGestio = calcularPuntEquilibri(
    conceptsGestio.map((c) => ({ node: c.node, total: c.total, esSubtotal: c.esSubtotal })),
    natura
  );

  const ingValors = find(evDirecte.concepts, NODE_INGRESSOS)?.valors ?? [];
  const nMesos = nMesosAmbIngressos(ingValors);
  console.log("\n--- Ingressos per mes (Directe) ---");
  ingValors.forEach((v, i) => {
    if (Math.abs(v) > 0) console.log(`  mes ${i + 1}: ${fmt(v)}`);
  });
  console.log(`nMesosAmbIngressos = ${nMesos}`);

  console.log("\n--- PE Directe clàssic ---");
  console.log(peClassic);

  console.log("\n--- PE propi LN ---");
  console.log(pePropi);
  console.log(`PE mensual teòric (PE/${nMesos}) = ${peMensualTeoric(pePropi.pe ?? 0, nMesos)}`);

  console.log("\n--- PE sobre compte Gestió (tot FIX/VAR natura, inclou Central) ---");
  console.log(peGestio);
  console.log(`PE Gestió mensual (PE/${nMesos}) = ${peMensualTeoric(peGestio.pe ?? 0, nMesos)}`);

  // Desglossament fulles Directe: entrant al PE vs excloses
  let ambNatura = 0;
  let senseNatura = 0;
  let alie = 0;
  let subtotals = 0;
  const excloses: { node: number; total: number; why: string }[] = [];
  const entrants: { node: number; total: number; natura: string; fix: number; var: number }[] = [];

  for (const c of evDirecte.concepts) {
    const abs = Math.abs(c.total);
    if (abs < 0.5) continue;
    if (c.esSubtotal) {
      subtotals += abs;
      continue;
    }
    const meta = natura[String(c.node)];
    if (!meta?.natura) {
      senseNatura += abs;
      excloses.push({ node: c.node, total: c.total, why: "sense natura" });
      continue;
    }
    if (meta.natura === "INGRES") continue;
    if (meta.natura === "ALIE") {
      alie += abs;
      excloses.push({ node: c.node, total: c.total, why: "ALIE" });
      continue;
    }
    const { fraccioFix, fraccioVariable } = await import("@/lib/natura-concepte");
    const fv = fraccioVariable(meta.natura, meta.pctVariable);
    const ff = fraccioFix(meta.natura, meta.pctVariable);
    ambNatura += abs;
    entrants.push({
      node: c.node,
      total: c.total,
      natura: meta.natura,
      fix: abs * ff,
      var: abs * fv,
    });
  }

  console.log("\n--- Fulles Directe amb import ---");
  console.log(
    `Entrant PE |abs|=${fmt(ambNatura)}  senseNatura=${fmt(senseNatura)}  ALIE=${fmt(alie)}`
  );
  console.log("Top entrants:");
  for (const e of entrants.sort((a, b) => Math.abs(b.total) - Math.abs(a.total)).slice(0, 15)) {
    console.log(
      `  node ${e.node} ${e.natura} total=${fmt(e.total)} fix=${fmt(e.fix)} var=${fmt(e.var)}`
    );
  }
  if (excloses.length) {
    console.log("Excloses (amb import):");
    for (const e of excloses.sort((a, b) => Math.abs(b.total) - Math.abs(a.total)).slice(0, 20)) {
      console.log(`  node ${e.node} ${e.why} total=${fmt(e.total)}`);
    }
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
