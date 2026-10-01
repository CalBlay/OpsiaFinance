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

// El nou informe insereix el % a I a les files individuals, però la capçalera
// exportada continua una columna a l'esquerra dels imports reals.
const headerDesplacat = header.slice(0, 8).concat(header.slice(9));

const detall = parseExcelCostPersonalCentre(
  workbook([
    headerDesplacat,
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
      9000,
      900,
      2700,
      12_600,
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
      8000,
      800,
      2400,
      11_200,
    ],
  ])
);

const dept = detall.files.find((fila) => fila.codi === "00002001");
assert.ok(dept, "S'ha de conservar el departament");
assert.equal(dept.nombrePersones, 2);
assert.equal(dept.costPersonal, 4200, "El cost ha de venir del subtotal, sense doble comptatge");
assert.match(detall.diagnostica ?? "", /desplaçament \+1/);
assert.doesNotMatch(JSON.stringify(detall), /000115|000224|AGUIRRE|GOMEZ ROSINES/);

// Jerarquia multi-centre (com IMPUTACIO DE COSTOS): després d'un dept + persones,
// el centre següent i els seus depts s'han d'importar; no comptar-los com a persones.
const multi = parseExcelCostPersonalCentre(
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
      10000,
      2000,
      2534,
      14534,
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
      10000,
      2000,
      2534,
      14534,
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
      null,
      9000,
      900,
      2700,
      12_600,
    ],
    [
      "00 - SERVEIS CENTRALS - 00102 - LOGISTICA",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      50000,
      10000,
      13482,
      73482,
    ],
    [
      "00 - SERVEIS CENTRALS - 00102 - LOGISTICA - 00102001 - ADMINISTRACIO",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      10000,
      2000,
      3000,
      15000,
    ],
    [
      "00 - SERVEIS CENTRALS - 00103 - OFICINES CAL BLAY",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      100000,
      20000,
      17435,
      137435,
    ],
    [
      "00 - SERVEIS CENTRALS - 00103 - OFICINES CAL BLAY - 00103001 - DIRECCIO",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      20000,
      4000,
      5000,
      29000,
    ],
    [
      "00 - SERVEIS CENTRALS - 00104 - MANTENIMENT",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      8000,
      1500,
      1409,
      10909,
    ],
    [
      "00 - SERVEIS CENTRALS - 00104 - MANTENIMENT - 00104001 - PERSONAL M",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      8000,
      1500,
      1409,
      10909,
    ],
  ])
);

const multiCentres = multi.files
  .filter((f) => f.nivell === 0)
  .map((f) => f.codi)
  .sort();
const multiDepts = multi.files
  .filter((f) => f.nivell === 1)
  .map((f) => f.codi)
  .sort();
assert.deepEqual(multiCentres, ["00002", "00102", "00103", "00104"]);
assert.deepEqual(multiDepts, ["00002001", "00102001", "00103001", "00104001"]);
assert.equal(
  multi.files.find((f) => f.codi === "00002001")?.nombrePersones,
  1,
  "Només la fila d'empleat compta com a persona"
);
assert.equal(
  multi.files.reduce((s, f) => s + f.nombrePersones, 0),
  1,
  "Els centres/depts posteriors no s'han de comptar com a persones"
);

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
    nombrePersones: 2,
    horesSetmanals: 80,
    period: { mes: 1 },
  },
  {
    centreId: "centre-a",
    departamentId: "dept-2",
    nombrePersones: 3,
    horesSetmanals: 120,
    period: { mes: 1 },
  },
  {
    centreId: "centre-a",
    departamentId: "dept-1",
    nombrePersones: 4,
    horesSetmanals: 160,
    period: { mes: 2 },
  },
  {
    centreId: "centre-a",
    departamentId: "dept-2",
    nombrePersones: 2,
    horesSetmanals: 80,
    period: { mes: 2 },
  },
];

const gener = agregarHeadcount(filesHeadcount, 1, (fila) => fila.departamentId);
assert.equal(gener.perClau.get("dept-1"), 2);
assert.equal(gener.perClauHores.get("dept-1"), 80);
assert.equal(gener.total, 5);
assert.equal(gener.totalHores, 200);

const anual = agregarHeadcount(filesHeadcount, null, (fila) => fila.departamentId);
assert.equal(anual.perClau.get("dept-1"), 3);
assert.equal(anual.perClauHores.get("dept-1"), 120);
assert.equal(anual.perClau.get("dept-2"), 2.5);
assert.equal(anual.total, 5.5, "L'acumulat anual és una mitjana mensual, no una suma");
assert.equal(anual.esMitjana, true);

console.log("Cost personal: recompte agregat i privacitat verificats.");
