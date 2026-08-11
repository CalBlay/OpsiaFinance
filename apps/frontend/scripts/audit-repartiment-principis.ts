/**
 * Auditoria diagnòstic P1/P2/P3 del repartiment (només lectura).
 *
 *   cd apps/frontend
 *   npx tsx scripts/audit-repartiment-principis.ts
 *   npx tsx scripts/audit-repartiment-principis.ts 2026 2
 *
 * Important: carregar .env ABANS d'importar @/lib/db (els import estàtics s'hissen).
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

const envCandidates = [
  resolve(process.cwd(), ".env.local"),
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../.env.local"),
  resolve(process.cwd(), "../../apps/frontend/.env.local"),
];
let loaded = false;
for (const p of envCandidates) {
  if (loadEnvFile(p)) loaded = true;
}
if (!loaded || !process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL no definit. Assegura't que existeix apps/frontend/.env.local i executa des de apps/frontend."
  );
  process.exit(1);
}

const NODES_INVARIANT = [11, 17, 30] as const;

async function main() {
  const { db } = await import("@/lib/db");
  const { getDirectePerLnNode } = await import("@/lib/repartiment/bases-vendes");
  const { validarZeroSumDeltas } = await import("@/lib/repartiment/gestio-consultes");
  const {
    CODI_LN_CENTRAL,
    NODE_COMPRES,
    NODE_COST_GESTIO,
    NODE_COST_SALARIAL,
    NODE_EBITDA,
    NODE_SEGURETAT_SOCIAL,
    NODE_SOUS_SALARIS,
    partsDeltaDetall,
  } = await import("@/lib/repartiment/nodes");
  const { getDeltasGestioPerLn } = await import("@/lib/repartiment/service");

  const anyArg = process.argv[2] ? Number(process.argv[2]) : null;
  const mesArg = process.argv[3] ? Number(process.argv[3]) : null;

  const execs = await db.execucioRepartiment.findMany({
    include: { period: { select: { id: true, any: true, mes: true, nom: true } } },
    orderBy: [{ period: { any: "desc" } }, { period: { mes: "desc" } }],
  });

  console.log("=== Execucions repartiment ===");
  for (const e of execs) {
    console.log(
      `  ${e.period.any}-${String(e.period.mes).padStart(2, "0")} ${e.period.nom} | ${e.estat} | periodId=${e.periodId}`
    );
  }

  const confirmats = execs.filter((e) => e.estat === "CONFIRMAT");
  const target =
    anyArg && mesArg
      ? (confirmats.find((e) => e.period.any === anyArg && e.period.mes === mesArg) ??
        execs.find((e) => e.period.any === anyArg && e.period.mes === mesArg))
      : (confirmats[0] ?? execs[0]);

  if (!target) {
    console.log("\nCap execució trobada. Fi.");
    return;
  }

  const periodId = target.periodId;
  const { any, mes, nom } = target.period;
  console.log(
    `\n=== Mes audit: ${any}-${String(mes).padStart(2, "0")} ${nom} (${target.estat}) ===\n`
  );

  const lns = await db.liniaNegoci.findMany({
    orderBy: { codi: "asc" },
    select: { id: true, codi: true, nom: true },
  });
  const central = lns.find((l) => l.codi === CODI_LN_CENTRAL);
  if (!central) throw new Error("LN Central no trobada");

  const directe = await getDirectePerLnNode(periodId);
  const deltasMap = await getDeltasGestioPerLn([periodId]);
  const deltas = deltasMap.get(periodId) ?? new Map<string, Map<number, number>>();

  console.log("--- P1: Zero-sum deltas (motor) ---");
  const zs = validarZeroSumDeltas(deltas);
  console.log(`  validarZeroSumDeltas: ok=${zs.ok}`);
  if (!zs.ok) {
    for (const d of zs.desquadraments) {
      console.log(`    node ${d.node}: suma=${d.suma.toFixed(4)}`);
    }
  } else {
    console.log("  Σ Δ[LN] ≈ 0 per nodes 11, 17, 30 (OK)");
  }

  console.log("\n--- P1: Σ Directe vs Gestió (11/17/30) ---");
  for (const node of NODES_INVARIANT) {
    let sd = 0;
    let sdelta = 0;
    for (const ln of lns) {
      sd += directe.get(ln.id)?.get(node) ?? 0;
      sdelta += deltas.get(ln.id)?.get(node) ?? 0;
    }
    const sg = sd + sdelta;
    console.log(
      `  Node ${node}: ΣDirecte=${sd.toFixed(2)}  ΣDelta=${sdelta.toFixed(4)}  ΣGestió=${sg.toFixed(2)}  Δempresa=${(sg - sd).toFixed(4)}`
    );
  }

  console.log("\n--- P1: Desglossament per LN ---");
  console.log(
    [
      "codi",
      "n11_D",
      "n11_Δ",
      "n11_G",
      "n17_D",
      "n17_Δ",
      "n17_G",
      "n30_D",
      "n30_Δ",
      "n30_G",
      "impact",
    ].join("\t")
  );
  let sumImpact = 0;
  for (const ln of lns) {
    const cells: string[] = [ln.codi];
    let impact = 0;
    for (const node of NODES_INVARIANT) {
      const d = directe.get(ln.id)?.get(node) ?? 0;
      const delta = deltas.get(ln.id)?.get(node) ?? 0;
      impact += delta;
      cells.push(d.toFixed(2), delta.toFixed(2), (d + delta).toFixed(2));
    }
    sumImpact += impact;
    cells.push(impact.toFixed(2));
    console.log(cells.join("\t"));
  }
  console.log(`  Σ impact repartiment empresa (hauria ≈ 0): ${sumImpact.toFixed(4)}`);

  console.log("\n--- P1: EBITDA Directe + impacte repartiment ---");
  let ebitdaD = 0;
  let ebitdaG = 0;
  for (const ln of lns) {
    const dE = directe.get(ln.id)?.get(NODE_EBITDA) ?? 0;
    const impact =
      (deltas.get(ln.id)?.get(NODE_COMPRES) ?? 0) +
      (deltas.get(ln.id)?.get(NODE_COST_SALARIAL) ?? 0) +
      (deltas.get(ln.id)?.get(NODE_COST_GESTIO) ?? 0);
    ebitdaD += dE;
    ebitdaG += dE + impact;
    console.log(
      `  ${ln.codi}: EBITDA_D=${dE.toFixed(2)}  impact=${impact.toFixed(2)}  EBITDA_G≈${(dE + impact).toFixed(2)}`
    );
  }
  console.log(
    `  EMPRESA: EBITDA_D=${ebitdaD.toFixed(2)}  EBITDA_G≈${ebitdaG.toFixed(2)}  diff=${(ebitdaG - ebitdaD).toFixed(4)}`
  );

  console.log("\n--- P2: Totals Gestió positius (11/17/30) ---");
  let positiusTotals = 0;
  for (const ln of lns) {
    for (const node of NODES_INVARIANT) {
      const d = directe.get(ln.id)?.get(node) ?? 0;
      const g = d + (deltas.get(ln.id)?.get(node) ?? 0);
      if (g > 0.01) {
        positiusTotals++;
        console.log(
          `  POSITIU ${ln.codi} node ${node}: Directe=${d.toFixed(2)} Gestió=${g.toFixed(2)}`
        );
      }
    }
  }
  if (!positiusTotals) console.log("  Cap total 11/17/30 positiu a nivell LN (OK motor)");

  console.log("\n--- P2: Presentació 17→13+15 (evitaPositius) ---");
  let leftovers = 0;
  let positiusDetall = 0;
  for (const ln of lns) {
    const dMap = directe.get(ln.id) ?? new Map();
    const delta17 = deltas.get(ln.id)?.get(NODE_COST_SALARIAL) ?? 0;
    if (Math.abs(delta17) < 0.005) continue;
    const bases = [dMap.get(NODE_SOUS_SALARIS) ?? 0, dMap.get(NODE_SEGURETAT_SOCIAL) ?? 0];
    const parts = partsDeltaDetall(delta17, bases, true);
    const sumParts = parts.reduce((a, b) => a + b, 0);
    const leftover = delta17 - sumParts;
    const baseSous = bases[0] ?? 0;
    const baseSs = bases[1] ?? 0;
    const partSous = parts[0] ?? 0;
    const partSs = parts[1] ?? 0;
    const gSous = baseSous + partSous;
    const gSs = baseSs + partSs;
    const flags: string[] = [];
    if (gSous > 0.01 || gSs > 0.01) {
      positiusDetall++;
      flags.push("POSITIU");
    }
    if (Math.abs(leftover) > 0.01) {
      leftovers++;
      flags.push(`LEFTOVER=${leftover.toFixed(2)}`);
    }
    console.log(
      `  ${ln.codi}: Δ17=${delta17.toFixed(2)} base_sous=${baseSous.toFixed(2)} base_SS=${baseSs.toFixed(2)} → G_sous=${gSous.toFixed(2)} G_SS=${gSs.toFixed(2)}${flags.length ? ` | ${flags.join(" ")}` : ""}`
    );
  }
  console.log(`  Resum: leftovers=${leftovers}  detalls_positius=${positiusDetall}`);

  console.log("\n--- P3: Ratio |SS|/|sous| Directe vs Gestió ---");
  console.log(
    ["codi", "ratio_D", "ratio_G", "diff_pp", "sous_D", "ss_D", "sous_G", "ss_G"].join("\t")
  );
  let maxAbsDiff = 0;
  for (const ln of lns) {
    const dMap = directe.get(ln.id) ?? new Map();
    const delta17 = deltas.get(ln.id)?.get(NODE_COST_SALARIAL) ?? 0;
    const sousD = dMap.get(NODE_SOUS_SALARIS) ?? 0;
    const ssD = dMap.get(NODE_SEGURETAT_SOCIAL) ?? 0;
    const parts = partsDeltaDetall(delta17, [sousD, ssD], true);
    const sousG = sousD + (parts[0] ?? 0);
    const ssG = ssD + (parts[1] ?? 0);
    const ratioD = Math.abs(sousD) < 1e-6 ? null : Math.abs(ssD) / Math.abs(sousD);
    const ratioG = Math.abs(sousG) < 1e-6 ? null : Math.abs(ssG) / Math.abs(sousG);
    const diff = ratioD != null && ratioG != null ? ratioG - ratioD : null;
    if (diff != null) maxAbsDiff = Math.max(maxAbsDiff, Math.abs(diff));
    console.log(
      [
        ln.codi,
        ratioD?.toFixed(4) ?? "n/a",
        ratioG?.toFixed(4) ?? "n/a",
        diff != null ? (diff * 100).toFixed(4) : "n/a",
        sousD.toFixed(2),
        ssD.toFixed(2),
        sousG.toFixed(2),
        ssG.toFixed(2),
      ].join("\t")
    );
  }
  console.log(`  Max |diff ratio| = ${(maxAbsDiff * 100).toFixed(4)} pp (0 = P3 OK a presentació)`);

  console.log("\n--- Context: nòmina SC vs SAP Central 17 ---");
  const sapCentral17 = directe.get(central.id)?.get(NODE_COST_SALARIAL) ?? 0;
  const costsNomina = await db.costPersonalCentre.findMany({
    where: {
      period: { any, mes },
      centre: { liniaNegociId: central.id },
    },
    select: { costPersonal: true },
  });
  const sumaNomina = costsNomina.reduce((s, r) => s + Math.abs(Number(r.costPersonal)), 0);
  const deltaCentral17 = deltas.get(central.id)?.get(NODE_COST_SALARIAL) ?? 0;
  console.log(`  SAP Central 17 Directe: ${sapCentral17.toFixed(2)}`);
  console.log(`  Nòmina+millores SC |cost|: ${sumaNomina.toFixed(2)}`);
  console.log(`  |nòmina| − |SAP|: ${(sumaNomina - Math.abs(sapCentral17)).toFixed(2)}`);
  console.log(
    `  Central Gestió 17: ${(sapCentral17 + deltaCentral17).toFixed(2)} (Δ=${deltaCentral17.toFixed(2)})`
  );

  const movOverrides = await db.movimentRepartiment.findMany({
    where: { execucioId: target.id, importOverride: { not: null } },
    select: {
      concepteNode: true,
      importOverride: true,
      liniaNegociDesti: { select: { codi: true } },
    },
  });
  console.log(`\n--- Overrides manuals: ${movOverrides.length} ---`);
  for (const o of movOverrides) {
    console.log(
      `  ${o.liniaNegociDesti.codi} node ${o.concepteNode}: override=${Number(o.importOverride).toFixed(2)}`
    );
  }

  console.log("\n=== Fi auditoria ===");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
