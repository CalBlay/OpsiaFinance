import assert from "node:assert/strict";
import { estatConfiguracioRepartiment } from "../apps/frontend/lib/repartiment/estat-configuracio";

const normaActualitzada = new Date("2026-09-22T12:00:00Z");
const configPersonalActualitzada = new Date("2026-09-22T12:30:00Z");

assert.deepEqual(
  estatConfiguracioRepartiment({
    calculatAt: new Date("2026-09-22T13:00:00Z"),
    ultimaNormaUpdatedAt: normaActualitzada,
    ultimaConfigPersonalUpdatedAt: configPersonalActualitzada,
    teCostPersonal: true,
  }),
  { alDia: true, motiusPendents: [] }
);

assert.deepEqual(
  estatConfiguracioRepartiment({
    calculatAt: new Date("2026-09-22T11:00:00Z"),
    ultimaNormaUpdatedAt: normaActualitzada,
    ultimaConfigPersonalUpdatedAt: null,
    teCostPersonal: false,
  }),
  { alDia: false, motiusPendents: ["regles generals"] }
);

assert.deepEqual(
  estatConfiguracioRepartiment({
    calculatAt: new Date("2026-09-22T13:00:00Z"),
    ultimaNormaUpdatedAt: normaActualitzada,
    ultimaConfigPersonalUpdatedAt: new Date("2026-09-22T14:00:00Z"),
    teCostPersonal: true,
  }),
  { alDia: false, motiusPendents: ["configuració de personal"] }
);

assert.deepEqual(
  estatConfiguracioRepartiment({
    calculatAt: new Date("2026-09-22T13:00:00Z"),
    ultimaNormaUpdatedAt: normaActualitzada,
    ultimaConfigPersonalUpdatedAt: new Date("2026-09-22T14:00:00Z"),
    teCostPersonal: false,
  }),
  { alDia: true, motiusPendents: [] },
  "Un mes sense cost de personal no queda pendent per canvis de configuració de personal"
);

console.log("Repartiment: detecció de configuració pendent verificada.");
