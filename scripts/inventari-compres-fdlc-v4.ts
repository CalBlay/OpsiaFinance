import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
/**
 * Inventari v4 — subministrament restaurant FDLC (criteri acordat):
 *   Cal Blay: fitxer LN00000 + centre CCR00008 · nodes 7+8
 *   FDLC: nodes 7+8 (restaurant + possible finca al mateix node)
 * Mostra elim = min(|CB|,|FDLC|) i residu (candidat «finca» / timing).
 * Desglossa ImportRow FDLC per compte PGC (si hi ha codiCompte).
 *
 *   npx tsx scripts/inventari-compres-fdlc-v4.ts --any=2026
 */
import { config } from "dotenv";

config({ path: "apps/frontend/.env.local" });
config({ path: ".env" });

const FDLC_LN = "LN00007";
const CENTRAL_LN = "LN00000";
const CODI_CCR08 = "CCR00008";
const NODES = [7, 8] as const;

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

async function main() {
  const anyArg = process.argv.find((a) => a.startsWith("--any="));
  const any = anyArg ? Number(anyArg.split("=")[1]) : 2026;

  const [lnCentral, lnFdlc] = await Promise.all([
    db.liniaNegoci.findUniqueOrThrow({ where: { codi: CENTRAL_LN }, select: { id: true } }),
    db.liniaNegoci.findUniqueOrThrow({ where: { codi: FDLC_LN }, select: { id: true } }),
  ]);

  const dades = await db.dadaResultat.findMany({
    where: {
      period: { any },
      import_: { not: 0 },
      concepteResultat: { node: { in: [...NODES] } },
      OR: [
        { importacio: { liniaNegociId: lnCentral.id }, centre: { codi: CODI_CCR08 } },
        {
          OR: [
            { liniaNegociId: lnFdlc.id },
            { importacio: { liniaNegociId: lnFdlc.id } },
            { centre: { liniaNegociId: lnFdlc.id } },
          ],
        },
      ],
    },
    select: {
      import_: true,
      period: { select: { mes: true } },
      concepteResultat: { select: { node: true } },
      centre: { select: { codi: true } },
      importacio: { select: { liniaNegoci: { select: { codi: true } } } },
      liniaNegoci: { select: { codi: true } },
    },
  });

  const cb = new Map<number, { n7: number; n8: number }>();
  const fdlc = new Map<number, { n7: number; n8: number }>();
  const bump = (
    m: Map<number, { n7: number; n8: number }>,
    mes: number,
    node: number,
    v: number
  ) => {
    const cur = m.get(mes) ?? { n7: 0, n8: 0 };
    if (node === 7) cur.n7 = round2(cur.n7 + v);
    if (node === 8) cur.n8 = round2(cur.n8 + v);
    m.set(mes, cur);
  };

  for (const d of dades) {
    const lnInf = d.importacio.liniaNegoci?.codi;
    const mes = d.period.mes;
    const node = d.concepteResultat.node;
    const v = Number(d.import_);
    if (lnInf === CENTRAL_LN && d.centre?.codi === CODI_CCR08) bump(cb, mes, node, v);
    if (lnInf === FDLC_LN || d.liniaNegoci?.codi === FDLC_LN) bump(fdlc, mes, node, v);
  }

  const mesos = [...new Set([...cb.keys(), ...fdlc.keys()])].sort((a, b) => a - b);

  console.log("Criteri acordat:");
  console.log(
    "  CB  = fitxer Central (LN00000) + centre CCR00008 · nodes 7 Compres + 8 Altres aprov."
  );
  console.log("  FDLC = nodes 7+8 (subministrament restaurant + possible finca al 8)");
  console.log("  elim = min(|CB|,|FDLC|)  → residu FDLC candidat a compres directes finca\n");

  const tabla = mesos.map((mes) => {
    const c = cb.get(mes) ?? { n7: 0, n8: 0 };
    const f = fdlc.get(mes) ?? { n7: 0, n8: 0 };
    const cbTot = round2(c.n7 + c.n8);
    const fTot = round2(f.n7 + f.n8);
    const elim = round2(Math.min(Math.abs(cbTot), Math.abs(fTot)));
    const residuCb = round2(Math.abs(cbTot) - elim);
    const residuF = round2(Math.abs(fTot) - elim);
    return {
      mes,
      CB_7: c.n7,
      CB_8: c.n8,
      CB_7_8: cbTot,
      FDLC_7: f.n7,
      FDLC_8: f.n8,
      FDLC_7_8: fTot,
      elim_min: elim,
      residu_CB: residuCb,
      residu_FDLC_finca: residuF,
      ratio:
        cbTot !== 0 && fTot !== 0 ? round2(elim / Math.max(Math.abs(cbTot), Math.abs(fTot))) : 0,
    };
  });
  console.table(tabla);

  const sum = (key: keyof (typeof tabla)[0]) =>
    round2(tabla.reduce((a, r) => a + (Number(r[key]) || 0), 0));
  console.log("\n=== Totals any ===");
  console.table([
    { concepte: "CB Central→CCR08 7+8", total: sum("CB_7_8") },
    { concepte: "FDLC 7+8", total: sum("FDLC_7_8") },
    { concepte: "Eliminable (suma mins mensuals)", total: sum("elim_min") },
    { concepte: "Residu CB", total: sum("residu_CB") },
    { concepte: "Residu FDLC (finca / altres)", total: sum("residu_FDLC_finca") },
  ]);

  // Detall comptes FDLC (ImportRow) per comptes 60*
  const rowsFdlc = await db.importRow.findMany({
    where: {
      period: { any },
      importacio: { liniaNegociId: lnFdlc.id },
      OR: [
        { codiCompte: { startsWith: "60" } },
        { familiaCompte: { contains: "aprov", mode: "insensitive" } },
        { nomCompte: { contains: "aprov", mode: "insensitive" } },
        { nomCompte: { contains: "compr", mode: "insensitive" } },
        { nomCompte: { contains: "mercan", mode: "insensitive" } },
      ],
    },
    select: {
      codiCompte: true,
      nomCompte: true,
      import_: true,
      period: { select: { mes: true } },
    },
  });

  console.log(`\n=== ImportRow FDLC comptes ~compres/aprov (files=${rowsFdlc.length}) ===`);
  if (rowsFdlc.length === 0) {
    console.log("(Sense detall a ImportRow — el parser FDLC pot no persistir files per compte.)");
  } else {
    const byCompte = new Map<string, { nom: string; total: number; perMes: Map<number, number> }>();
    for (const r of rowsFdlc) {
      const codi = r.codiCompte ?? "(sense)";
      const cur = byCompte.get(codi) ?? { nom: r.nomCompte, total: 0, perMes: new Map() };
      const v = Number(r.import_);
      cur.total = round2(cur.total + v);
      cur.perMes.set(r.period.mes, round2((cur.perMes.get(r.period.mes) ?? 0) + v));
      byCompte.set(codi, cur);
    }
    console.table(
      [...byCompte.entries()]
        .map(([codi, v]) => ({ codi, nom: v.nom, total: v.total }))
        .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
        .slice(0, 40)
    );
    console.log("\n=== Per compte × mes (top comptes) ===");
    const top = [...byCompte.entries()]
      .sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total))
      .slice(0, 12);
    for (const [codi, v] of top) {
      console.log(`\n${codi} · ${v.nom}`);
      console.table(mesos.map((mes) => ({ mes, import: v.perMes.get(mes) ?? 0 })));
    }
  }

  const outPath = resolve("scripts/inventari-compres-fdlc-v4-out.json");
  writeFileSync(outPath, JSON.stringify({ any, tabla, importRows: rowsFdlc.length }, null, 2));
  console.log(`\nJSON: ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
