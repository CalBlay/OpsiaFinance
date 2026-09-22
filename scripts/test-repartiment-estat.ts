import assert from "node:assert/strict";
import { estatConfiguracioRepartiment } from "../apps/frontend/lib/repartiment/estat-configuracio";

const normaActualitzada = new Date("2026-09-22T12:00:00Z");

assert.deepEqual(
  estatConfiguracioRepartiment({
    calculatAt: new Date("2026-09-22T13:00:00Z"),
    ultimaNormaUpdatedAt: normaActualitzada,
    personalReglaAplicada: true,
  }),
  { alDia: true, motiusPendents: [] }
);

assert.deepEqual(
  estatConfiguracioRepartiment({
    calculatAt: new Date("2026-09-22T11:00:00Z"),
    ultimaNormaUpdatedAt: normaActualitzada,
    personalReglaAplicada: true,
  }),
  { alDia: false, motiusPendents: ["regles generals"] }
);

assert.deepEqual(
  estatConfiguracioRepartiment({
    calculatAt: new Date("2026-09-22T13:00:00Z"),
    ultimaNormaUpdatedAt: normaActualitzada,
    personalReglaAplicada: false,
  }),
  { alDia: false, motiusPendents: ["configuració de personal"] }
);

console.log("Repartiment: detecció de configuració pendent verificada.");
