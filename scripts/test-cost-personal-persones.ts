import assert from "node:assert/strict";
import { utils, write } from "xlsx";
import { agregarHeadcount } from "../apps/frontend/lib/cost-personal-centre/headcount";
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

const filesHeadcount = [
  {
    centreId: "centre-a",
    departamentId: "dept-1",
    origen: "NOMINA" as const,
    nombrePersones: 2,
    period: { mes: 1 },
  },
  {
    centreId: "centre-a",
    departamentId: "dept-1",
    origen: "MILLORES" as const,
    nombrePersones: 2,
    period: { mes: 1 },
  },
  {
    centreId: "centre-a",
    departamentId: "dept-2",
    origen: "NOMINA" as const,
    nombrePersones: 3,
    period: { mes: 1 },
  },
  {
    centreId: "centre-a",
    departamentId: "dept-1",
    origen: "NOMINA" as const,
    nombrePersones: 4,
    period: { mes: 2 },
  },
  {
    centreId: "centre-a",
    departamentId: "dept-2",
    origen: "MILLORES" as const,
    nombrePersones: 2,
    period: { mes: 2 },
  },
];

const gener = agregarHeadcount(filesHeadcount, 1, (fila) => fila.departamentId);
assert.equal(gener.perClau.get("dept-1"), 2, "Nòmina preval sobre millores");
assert.equal(gener.total, 5);

const anual = agregarHeadcount(filesHeadcount, null, (fila) => fila.departamentId);
assert.equal(anual.perClau.get("dept-1"), 3);
assert.equal(anual.perClau.get("dept-2"), 2.5);
assert.equal(anual.total, 5.5, "L'acumulat anual és una mitjana mensual, no una suma");
assert.equal(anual.esMitjana, true);

console.log("Cost personal: recompte agregat i privacitat verificats.");
