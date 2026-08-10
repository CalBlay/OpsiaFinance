/**
 * Calcula % i deltas Març–Juliol 2025 per LN00000 (Central).
 * npx tsx scripts/calcul-ajust-compres-2025-central.ts
 */
import { config } from "dotenv";
config({ path: "apps/frontend/.env.local" });
config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { prismaWhereDadaPerLnInforme } from "../apps/frontend/lib/linia-informe";

const ANY = 2025;
const CODI_LN = "LN00000";
const MESOS_AJUST = [3, 4, 5, 6, 7];
const MESOS_OK = [1, 2, 8, 9, 10, 11, 12];
const MESOS_NOMS = [
  "",
  "Gener",
  "Febrer",
  "Març",
  "Abril",
  "Maig",
  "Juny",
  "Juliol",
  "Agost",
  "Setembre",
  "Octubre",
  "Novembre",
  "Desembre",
];

const NODE_VENDES = 2;
const NODE_INGRESSOS = 6;
const NODE_COMPRES_DETALL = 7;
const NODE_COMPRES = 11;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL no definit");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function sumaNode(lnId: string, node: number, mesos: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  for (const m of mesos) out.set(m, 0);

  const concepte = await prisma.concepteResultat.findUnique({
    where: { node },
    select: { id: true },
  });
  if (!concepte) return out;

  const dades = await prisma.dadaResultat.findMany({
    where: {
      concepteResultatId: concepte.id,
      period: { any: ANY, mes: { in: mesos } },
      ...prismaWhereDadaPerLnInforme(lnId),
    },
    select: { import_: true, period: { select: { mes: true } } },
  });

  for (const d of dades) {
    const mes = d.period.mes;
    out.set(mes, (out.get(mes) ?? 0) + Number(d.import_));
  }
  return out;
}

function suma(map: Map<number, number>, mesos: number[]) {
  return mesos.reduce((s, m) => s + (map.get(m) ?? 0), 0);
}

async function main() {
  const ln = await prisma.liniaNegoci.findUnique({
    where: { codi: CODI_LN },
    select: { id: true, codi: true, nom: true },
  });
  if (!ln) throw new Error(`No trobada ${CODI_LN}`);

  const tots = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const [vendes, ingressos, compres7, compres11] = await Promise.all([
    sumaNode(ln.id, NODE_VENDES, tots),
    sumaNode(ln.id, NODE_INGRESSOS, tots),
    sumaNode(ln.id, NODE_COMPRES_DETALL, tots),
    sumaNode(ln.id, NODE_COMPRES, tots),
  ]);

  // Fem servir TOTAL COMPRES (11) si té dades; si no, detall (7)
  const usaDetall =
    Math.abs(suma(compres11, tots)) < 0.01 && Math.abs(suma(compres7, tots)) >= 0.01;
  const compres = usaDetall ? compres7 : compres11;
  const nodeCompresLabel = usaDetall ? "COMPRES detall (7)" : "TOTAL COMPRES (11)";

  const baseV = vendes;
  const baseLabel = "Vendes (2)";
  // Si vendes ~0, provar ingressos
  const usarIngressos = Math.abs(suma(baseV, MESOS_AJUST)) < 0.01;
  const base = usarIngressos ? ingressos : baseV;
  const baseNom = usarIngressos ? "Ingressos (6)" : baseLabel;

  const C_ok = suma(compres, MESOS_OK);
  const C_mj = suma(compres, MESOS_AJUST);
  const C_any = suma(compres, tots);
  const V_ok = suma(base, MESOS_OK);
  const V_mj = suma(base, MESOS_AJUST);
  const V_any = suma(base, tots);

  // Opció 1: preserva total anual (= rati Mar–Jul agregat)
  const pct = Math.abs(V_mj) > 0.01 ? (Math.abs(C_mj) / Math.abs(V_mj)) * 100 : Number.NaN;
  const pctOk = Math.abs(V_ok) > 0.01 ? (Math.abs(C_ok) / Math.abs(V_ok)) * 100 : Number.NaN;
  const pctAny = Math.abs(V_any) > 0.01 ? (Math.abs(C_any) / Math.abs(V_any)) * 100 : Number.NaN;

  console.log(`\n=== ${ln.codi} · ${ln.nom} · ${ANY} ===`);
  console.log(`Compres usades: ${nodeCompresLabel}`);
  console.log(`Base %: ${baseNom}`);
  console.log("");
  console.log(`Compres any:     ${C_any.toFixed(2)}`);
  console.log(`Compres OK:      ${C_ok.toFixed(2)}  (gen,feb,ago–des)`);
  console.log(`Compres Mar–Jul: ${C_mj.toFixed(2)}`);
  console.log(`Base any:        ${V_any.toFixed(2)}`);
  console.log(`Base OK:         ${V_ok.toFixed(2)}`);
  console.log(`Base Mar–Jul:    ${V_mj.toFixed(2)}`);
  console.log("");
  console.log(`% mesos OK:      ${pctOk.toFixed(2)} %`);
  console.log(`% any:           ${pctAny.toFixed(2)} %`);
  console.log(`% A APLICAR (Mar–Jul, preserva total): ${pct.toFixed(4)} %`);
  console.log(`  → a la UI pots posar: ${pct.toFixed(2).replace(".", ",")} %`);
  console.log("");
  console.log("Mes | Base | SAP compres | Objectiu (−%×|base|) | Ajust Δ");
  console.log("-".repeat(78));

  for (const mes of MESOS_AJUST) {
    const b = base.get(mes) ?? 0;
    const sap = compres.get(mes) ?? 0;
    const objectiu = -(Math.abs(b) * (pct / 100));
    const delta = objectiu - sap;
    console.log(
      `${MESOS_NOMS[mes].padEnd(7)} | ${b.toFixed(2).padStart(12)} | ${sap.toFixed(2).padStart(12)} | ${objectiu.toFixed(2).padStart(12)} | ${delta.toFixed(2).padStart(12)}`
    );
  }

  const sumaDelta = MESOS_AJUST.reduce((s, mes) => {
    const b = base.get(mes) ?? 0;
    const sap = compres.get(mes) ?? 0;
    const objectiu = -(Math.abs(b) * (pct / 100));
    return s + (objectiu - sap);
  }, 0);
  console.log("-".repeat(78));
  console.log(`Suma Δ Mar–Jul: ${sumaDelta.toFixed(2)} (hauria de ser ≈ 0 si només redistribueix)`);
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
