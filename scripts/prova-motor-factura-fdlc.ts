/**
 * Prova ràpida del motor IMPORT_FIX_MENSUAL (sense BD).
 *   npx tsx scripts/prova-motor-factura-fdlc.ts
 */
import {
  type NormaConsolidacioMin,
  aplicarNormesConsolidacio,
} from "../apps/frontend/lib/consolidacio/motor";
import { FACTURES_BLAYETA_2026 } from "../apps/frontend/lib/consolidacio/normes-seed";
import type { ConceptePivot } from "../apps/frontend/lib/consultes";

function row(node: number, valors: number[], esSubtotal = false): ConceptePivot {
  return {
    node,
    descripcio: `Node ${node}`,
    esSubtotal,
    valors: [...valors],
    total: valors.reduce((a, b) => a + b, 0),
  };
}

function main() {
  // Cara Cal Blay: Vendes (2) amb CCC00002-ish capacitat
  const vendesCb = [11074.55, 7581.5, 10013.07, 12193.54, 14374.24, 11390.92, 0, 0, 0, 0, 0, 0];
  // Cara FDLC: nodes 7+8 (només al 8 per simplicitat)
  const fdlc8 = [-7535.95, -5032.45, -6505.2, -8397.75, -12111.06, -6404.71, -45.09, 0, 0, 0, 0, 0];

  const consolidat = [row(2, vendesCb), row(7, new Array(12).fill(0)), row(8, fdlc8)];

  const parells = new Map([
    ["calblay", [row(2, vendesCb), row(7, new Array(12).fill(0)), row(8, new Array(12).fill(0))]],
    ["fdlc", [row(2, new Array(12).fill(0)), row(7, new Array(12).fill(0)), row(8, fdlc8)]],
  ]);

  const importsMensuals = new Map(FACTURES_BLAYETA_2026.map((f) => [f.mes, f.import]));

  const norma: NormaConsolidacioMin = {
    tipus: "ELIMINAR_PARELL_INTER",
    actiu: true,
    nodeExcloure: null,
    nodesAjust: [],
    grupEmpresaOrigen: "calblay",
    nodeOrigen: 2,
    grupEmpresaDesti: "fdlc",
    nodeDesti: 7,
    nodesOrigen: [2],
    nodesDesti: [7, 8],
    fontImport: "IMPORT_FIX_MENSUAL",
    importsMensuals,
  };

  const out = aplicarNormesConsolidacio(consolidat, [norma], "temporal", parells, {
    any: 2026,
    desMes: 1,
    finsMes: 12,
  });

  const v2 = out.find((r) => r.node === 2);
  const v8 = out.find((r) => r.node === 8);
  if (!v2 || !v8) {
    console.error("FAIL: nodes 2/8 no trobats després del motor");
    process.exitCode = 1;
    return;
  }

  console.log("Mes | Factura | Vendes abans | Vendes després | Δ | FDLC8 abans | FDLC8 després");
  for (let i = 0; i < 6; i++) {
    const factura = FACTURES_BLAYETA_2026[i]?.import ?? 0;
    const abansV = vendesCb[i] ?? 0;
    const despresV = v2.valors[i] ?? 0;
    const abansF = fdlc8[i] ?? 0;
    const despresF = v8.valors[i] ?? 0;
    const dV = Math.round((abansV - despresV) * 100) / 100;
    const dF = Math.round((abansF - despresF) * 100) / 100;
    console.log(
      `${i + 1} | ${factura} | ${abansV} → ${despresV} (Δ=${dV}) | ${abansF} → ${despresF} (Δ=${dF})`
    );
    if (Math.abs(dV - factura) > 0.02) {
      console.error(`FAIL mes ${i + 1}: Δ vendes ${dV} ≠ factura ${factura}`);
      process.exitCode = 1;
    }
    if (Math.abs(dF + factura) > 0.02 && Math.abs(dF - factura) > 0.02) {
      console.error(`FAIL mes ${i + 1}: Δ FDLC ${dF} no coherent amb factura`);
      process.exitCode = 1;
    }
  }

  if (!process.exitCode) console.log("\nOK · eliminació = factura cada mes");
}

main();
