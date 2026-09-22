import assert from "node:assert/strict";
import { parseExcelCostPersonalCentre } from "../apps/frontend/lib/cost-personal-centre/parser";
import { utils, write } from "xlsx";

function workbook(rows: unknown[][]): Buffer {
  const wb = utils.book_new();
  utils.book_append_sheet(wb, utils.aoa_to_sheet(rows), "Nòmina");
  return write(wb, { type: "buffer", bookType: "xlsx" });
}

const header = [
  "Descripció",
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  "Importe bruto",
  "Provisión pagas extra",
  "Seguridad Social",
  "Operación",
];

const detall = parseExcelCostPersonalCentre(
  workbook([
    header,
    ["00002 - Centre", null, null, null, null, null, null, null, null, 3000, 300, 900, 4200],
    [
      "00002001 - Administració",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      3000,
      300,
      900,
      4200,
    ],
    ["Anna Garcia", null, null, null, null, null, null, null, null, 1000, 100, 300, 1400],
    ["Bernat Puig", null, null, null, null, null, null, null, null, 2000, 200, 600, 2800],
  ])
);

const dept = detall.files.find((fila) => fila.codi === "00002001");
assert.ok(dept, "S'ha de conservar el departament");
assert.equal(dept.nombrePersones, 2);
assert.equal(dept.costPersonal, 4200, "El cost ha de venir del subtotal, sense doble comptatge");
assert.doesNotMatch(JSON.stringify(detall), /Anna Garcia|Bernat Puig/);

const legacy = parseExcelCostPersonalCentre(
  workbook([
    header,
    [
      "00002001 - Administració",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      3000,
      300,
      900,
      4200,
    ],
  ])
);
assert.equal(legacy.files[0]?.nombrePersones, 0);

console.log("Cost personal: recompte agregat i privacitat verificats.");
