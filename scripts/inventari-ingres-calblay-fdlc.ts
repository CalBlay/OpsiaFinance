import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
/**
 * Busca la cara POSITIVA a Cal Blay del subministrament a FDLC
 * (factura / traspass): Vendes (2), Prestació (3), Altres ingressos (4),
 * i també moviments interns (29) per si és reclassificació interna.
 *
 * Criteri de referència (despesa FDLC / cost CB):
 *   CB cost = LN00000 + CCR00008 · nodes 7+8
 *   FDLC cost = nodes 7+8
 *
 *   npx tsx scripts/inventari-ingres-calblay-fdlc.ts --any=2026
 */
import { config } from "dotenv";

config({ path: "apps/frontend/.env.local" });
config({ path: ".env" });

const FDLC_LN = "LN00007";
const CENTRAL_LN = "LN00000";
const CODI_CCR08 = "CCR00008";
const NODES_COST = [7, 8] as const;
const NODES_INGRES = [2, 3, 4, 29] as const;
const LABEL: Record<number, string> = {
  2: "VENDES",
  3: "PRESTACIO",
  4: "ALTRES_INGRESSOS",
  29: "MOVIMENTS_INTERNS",
};

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

  const lnCentral = await db.liniaNegoci.findUniqueOrThrow({
    where: { codi: CENTRAL_LN },
    select: { id: true },
  });
  const lnFdlc = await db.liniaNegoci.findUniqueOrThrow({
    where: { codi: FDLC_LN },
    select: { id: true },
  });

  // Cost de referència
  const costs = await db.dadaResultat.findMany({
    where: {
      period: { any },
      import_: { not: 0 },
      concepteResultat: { node: { in: [...NODES_COST] } },
      OR: [
        { importacio: { liniaNegociId: lnCentral.id }, centre: { codi: CODI_CCR08 } },
        {
          OR: [{ importacio: { liniaNegociId: lnFdlc.id } }, { liniaNegociId: lnFdlc.id }],
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

  const cbCost = new Map<number, number>();
  const fCost = new Map<number, number>();
  for (const d of costs) {
    const mes = d.period.mes;
    const v = Number(d.import_);
    const lnInf = d.importacio.liniaNegoci?.codi;
    if (lnInf === CENTRAL_LN && d.centre?.codi === CODI_CCR08) {
      cbCost.set(mes, round2((cbCost.get(mes) ?? 0) + v));
    }
    if (lnInf === FDLC_LN || d.liniaNegoci?.codi === FDLC_LN) {
      fCost.set(mes, round2((fCost.get(mes) ?? 0) + v));
    }
  }

  // Ingressos / positius Cal Blay (no FDLC)
  const ingress = await db.dadaResultat.findMany({
    where: {
      period: { any },
      import_: { not: 0 },
      concepteResultat: { node: { in: [...NODES_INGRES] } },
      NOT: {
        OR: [
          { importacio: { liniaNegociId: lnFdlc.id } },
          { liniaNegociId: lnFdlc.id },
          { centre: { liniaNegociId: lnFdlc.id } },
        ],
      },
    },
    select: {
      import_: true,
      period: { select: { mes: true } },
      concepteResultat: { select: { node: true, descripcio: true } },
      centre: {
        select: { codi: true, nom: true, liniaNegoci: { select: { codi: true } } },
      },
      liniaNegoci: { select: { codi: true } },
      importacio: { select: { liniaNegoci: { select: { codi: true } } } },
    },
  });

  type IngRow = {
    mes: number;
    node: number;
    lnInf: string;
    centre: string;
    nom: string;
    centreLn: string;
    import: number;
  };
  const ingRaw: IngRow[] = [];
  for (const d of ingress) {
    const v = Number(d.import_);
    // ens interessen sobretot positius (factura); també mirem negatius a 29
    ingRaw.push({
      mes: d.period.mes,
      node: d.concepteResultat.node,
      lnInf: d.importacio.liniaNegoci?.codi ?? d.liniaNegoci?.codi ?? "?",
      centre: d.centre?.codi ?? "(sense)",
      nom: d.centre?.nom ?? "",
      centreLn: d.centre?.liniaNegoci.codi ?? "",
      import: v,
    });
  }

  const mesos = [...new Set([...cbCost.keys(), ...fCost.keys(), ...ingRaw.map((r) => r.mes)])].sort(
    (a, b) => a - b
  );

  console.log("=== Cost de referència (7+8) ===");
  console.table(
    mesos.map((mes) => ({
      mes,
      CB_Central_CCR08: cbCost.get(mes) ?? 0,
      FDLC: fCost.get(mes) ?? 0,
      elim_min: round2(Math.min(Math.abs(cbCost.get(mes) ?? 0), Math.abs(fCost.get(mes) ?? 0))),
    }))
  );

  // Candidats: positius Cal Blay que s'acosten a |CB cost| o |elim|
  console.log("\n=== Candidats POSITIUS Cal Blay (|imp|≥100) vs cost CCR08 / elim ===");
  const hits: {
    mes: number;
    node: string;
    lnInf: string;
    centre: string;
    nom: string;
    import: number;
    vs_CB_cost: number;
    vs_elim: number;
    ratio_CB: number;
  }[] = [];

  for (const mes of mesos) {
    const refCb = Math.abs(cbCost.get(mes) ?? 0);
    const elim = Math.min(refCb, Math.abs(fCost.get(mes) ?? 0));
    const delMes = ingRaw.filter((r) => r.mes === mes && r.import > 0);
    for (const r of delMes) {
      if (r.import < 100) continue;
      const vsCb = round2(Math.abs(r.import - refCb));
      const vsElim = round2(Math.abs(r.import - elim));
      const ratio = refCb > 0 ? round2(Math.min(r.import, refCb) / Math.max(r.import, refCb)) : 0;
      // conservar si és proper al cost CB o a l'elim, o centre CCR08 / nom FDLC
      const related =
        r.centre === CODI_CCR08 ||
        /fdlc|canya|font/i.test(r.nom) ||
        ratio >= 0.7 ||
        vsElim <= 500 ||
        vsCb <= 500;
      if (!related) continue;
      hits.push({
        mes,
        node: `${r.node} ${LABEL[r.node] ?? ""}`,
        lnInf: r.lnInf,
        centre: r.centre,
        nom: r.nom,
        import: r.import,
        vs_CB_cost: vsCb,
        vs_elim: vsElim,
        ratio_CB: ratio,
      });
    }
  }
  console.table(hits.sort((a, b) => b.ratio_CB - a.ratio_CB || a.vs_elim - b.vs_elim).slice(0, 60));

  // Focus CCR00008 ingressos a qualsevol LN informe
  console.log("\n=== Tot ingressos nodes 2/3/4/29 amb centre CCR00008 (Cal Blay) ===");
  const ccrIng = ingRaw.filter((r) => r.centre === CODI_CCR08);
  const aggCcr = new Map<string, number>();
  for (const r of ccrIng) {
    const k = `${r.mes}|${r.node}|${r.lnInf}|${r.nom}`;
    aggCcr.set(k, round2((aggCcr.get(k) ?? 0) + r.import));
  }
  console.table(
    [...aggCcr.entries()]
      .map(([k, imp]) => {
        const [mes, node, lnInf, nom] = k.split("|");
        return {
          mes: Number(mes),
          node: `${node} ${LABEL[Number(node)] ?? ""}`,
          lnInf,
          nom,
          import: imp,
        };
      })
      .sort((a, b) => a.mes - b.mes || a.node.localeCompare(b.node))
  );

  // Focus explícit: LN00000 · Vendes (2) i Altres ingressos (4)
  console.log("\n=== FOCUS LN00000 · Vendes (2) i Altres ingressos (4) ===");
  const ln00 = (node: number, mes: number) =>
    round2(
      ingRaw
        .filter((r) => r.mes === mes && r.node === node && r.lnInf === CENTRAL_LN)
        .reduce((a, r) => a + r.import, 0)
    );
  const ln00Ccr = (node: number, mes: number) =>
    round2(
      ingRaw
        .filter(
          (r) =>
            r.mes === mes && r.node === node && r.lnInf === CENTRAL_LN && r.centre === CODI_CCR08
        )
        .reduce((a, r) => a + r.import, 0)
    );

  console.table(
    mesos.map((mes) => {
      const costCb = cbCost.get(mes) ?? 0;
      const costF = fCost.get(mes) ?? 0;
      const elim = round2(Math.min(Math.abs(costCb), Math.abs(costF)));
      const v2 = ln00(2, mes);
      const v4 = ln00(4, mes);
      const v2ccr = ln00Ccr(2, mes);
      const v4ccr = ln00Ccr(4, mes);
      return {
        mes,
        LN00_Vendes_2: v2,
        LN00_AltresIng_4: v4,
        "LN00+CCR08_Vendes": v2ccr,
        "LN00+CCR08_AltresIng": v4ccr,
        CB_cost_CCR08: costCb,
        FDLC_cost: costF,
        elim_min: elim,
        match_2_vs_elim:
          Math.abs(v2) >= 1 && elim >= 1
            ? round2(Math.min(Math.abs(v2), elim) / Math.max(Math.abs(v2), elim))
            : 0,
        match_4_vs_elim:
          Math.abs(v4) >= 1 && elim >= 1
            ? round2(Math.min(Math.abs(v4), elim) / Math.max(Math.abs(v4), elim))
            : 0,
        match_2ccr_vs_elim:
          Math.abs(v2ccr) >= 1 && elim >= 1
            ? round2(Math.min(Math.abs(v2ccr), elim) / Math.max(Math.abs(v2ccr), elim))
            : 0,
        match_4ccr_vs_elim:
          Math.abs(v4ccr) >= 1 && elim >= 1
            ? round2(Math.min(Math.abs(v4ccr), elim) / Math.max(Math.abs(v4ccr), elim))
            : 0,
      };
    })
  );

  // Detall positius node 2/4 a LN00000 desglossat per centre
  console.log("\n=== Detall LN00000 · nodes 2/4 positius per centre (mes a mes) ===");
  const det = ingRaw.filter(
    (r) => r.lnInf === CENTRAL_LN && (r.node === 2 || r.node === 4) && r.import > 0
  );
  const detAgg = new Map<string, number>();
  for (const r of det) {
    const k = `${r.mes}|${r.node}|${r.centre}|${r.nom}`;
    detAgg.set(k, round2((detAgg.get(k) ?? 0) + r.import));
  }
  console.table(
    [...detAgg.entries()]
      .map(([k, imp]) => {
        const [mes, node, centre, nom] = k.split("|");
        return {
          mes: Number(mes),
          node: `${node} ${LABEL[Number(node)]}`,
          centre,
          nom,
          import: imp,
        };
      })
      .sort((a, b) => a.mes - b.mes || b.import - a.import)
  );

  // Match exacte: positiu LN00000 node 2 o 4 vs |cost CB CCR08| o elim
  console.log("\n=== Exactes LN00000 node 2/4 vs |cost CCR08| o elim (±0.05) ===");
  const exactesLn00: {
    mes: number;
    node: string;
    centre: string;
    nom: string;
    import: number;
    ref: string;
  }[] = [];
  for (const mes of mesos) {
    const refCb = Math.abs(cbCost.get(mes) ?? 0);
    const elim = Math.min(refCb, Math.abs(fCost.get(mes) ?? 0));
    for (const r of det.filter((x) => x.mes === mes)) {
      if (refCb >= 1 && Math.abs(r.import - refCb) <= 0.05) {
        exactesLn00.push({
          mes,
          node: `${r.node} ${LABEL[r.node]}`,
          centre: r.centre,
          nom: r.nom,
          import: r.import,
          ref: "cost_CCR08",
        });
      }
      if (elim >= 1 && Math.abs(r.import - elim) <= 0.05) {
        exactesLn00.push({
          mes,
          node: `${r.node} ${LABEL[r.node]}`,
          centre: r.centre,
          nom: r.nom,
          import: r.import,
          ref: "elim_min",
        });
      }
    }
  }
  console.table(exactesLn00);

  const outPath = resolve("scripts/inventari-ingres-calblay-fdlc-out.json");
  writeFileSync(
    outPath,
    JSON.stringify(
      { any, cbCost: [...cbCost], fCost: [...fCost], hits: hits.slice(0, 100), exactesLn00 },
      null,
      2
    )
  );
  console.log(`\nJSON: ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
