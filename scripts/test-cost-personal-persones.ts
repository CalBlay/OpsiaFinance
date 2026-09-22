import assert from "node:assert/strict";
import { utils, write } from "xlsx";
import { parseExcelCostPersonalCentre } from "../apps/frontend/lib/cost-personal-centre/parser";

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
    [
      "00 - SERVEIS CENTRALS - 00002 - DECORACIO",
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
    [
      "00 - SERVEIS CENTRALS - 00002 - DECORACIO - 00002001 - PERSONAL D",
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
    [
      "'000115 AGUIRRE PLA GIRIBERT, MARIA NATACHA",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      100,
      1000,
      100,
      300,
      1400,
    ],
    [
      "'000224 GOMEZ ROSINES, LOURDES",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      100,
      2000,
      200,
      600,
      2800,
    ],
  ])
);

const dept = detall.files.find((fila) => fila.codi === "00002001");
assert.ok(dept, "S'ha de conservar el departament");
assert.equal(dept.nombrePersones, 2);
assert.equal(dept.costPersonal, 4200, "El cost ha de venir del subtotal, sense doble comptatge");
assert.doesNotMatch(JSON.stringify(detall), /000115|000224|AGUIRRE|GOMEZ ROSINES/);

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
