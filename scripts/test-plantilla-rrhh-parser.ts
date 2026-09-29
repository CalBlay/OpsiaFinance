import assert from "node:assert/strict";
import { parseCapcaleraMes } from "../apps/frontend/lib/rrhh-plantilla/parser";

assert.deepEqual(parseCapcaleraMes("M1'2026"), { mes: 1, any: 2026 });
assert.deepEqual(parseCapcaleraMes("M2'2026"), { mes: 2, any: 2026 });
assert.deepEqual(parseCapcaleraMes("M9'2026"), { mes: 9, any: 2026 });
assert.deepEqual(parseCapcaleraMes("M12'2026"), { mes: 12, any: 2026 });
assert.deepEqual(parseCapcaleraMes("M01'26"), { mes: 1, any: 2026 });
assert.deepEqual(parseCapcaleraMes("m3-2026"), { mes: 3, any: 2026 });
assert.equal(parseCapcaleraMes("organization"), null);
assert.equal(parseCapcaleraMes("M13'2026"), null);

console.log("Plantilla RRHH: capçaleres M1…M12 → mes OK.");
