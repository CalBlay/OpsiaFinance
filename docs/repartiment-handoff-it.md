# OpsiaFinance — Handoff IT: Repartiment Central → LN

Document de continuïtat per reprendre el treball en una altra sessió.  
**Data:** juliol 2026 · **Branca:** treball local (mòdul repartiment + consultes gestió)

---

## 1. Objectiu de negoci

**LN00000 (Central)** concentra costos SAP que cal imputar a la resta de línies de negoci per obtenir el **compte de gestió** (tractat), comparable als Excels manuals.

Flux:

```
Importació SAP (directe)  →  Repartiment mensual (revisar/confirmar)  →  Consulta Gestió
```

- **Directe (SAP):** dades importades sense repartiment.
- **Gestió (tractat):** SAP + moviments de repartiment **confirmats** del període.

---

## 2. Estat actual (què funciona)

### Base de dades (Prisma)

Models nous a `prisma/schema.prisma`:

- `RepartimentGrup`, `RepartimentGrupMembre`
- `NormaRepartiment` (enum `TipusNormaRepartiment`)
- `ExecucioRepartiment` (enum `EstatExecucioRepartiment`: BORRADOR / CONFIRMAT)
- `PesRepartiment`, `MovimentRepartiment`
- `Importacio.liniaNegociId` + relació inversa a `LiniaNegoci.importacions`

Migració: `prisma/migrations/20260704220000_modul_repartiment/migration.sql`

**Atenció:** Si `migrate deploy` falla amb **P3015**, eliminar la carpeta buida  
`prisma/migrations/20260704204000_dada_codi_columna` (es va esborrar el SQL però va quedar el directori).

### Motor i biblioteca

| Fitxer | Funció |
|--------|--------|
| `apps/frontend/lib/repartiment/nodes.ts` | Nodes SAP (6=ingressos, 11=compres, 17=personal, 30=gestió…) |
| `apps/frontend/lib/repartiment/bases-vendes.ts` | Base directe per LN/node; pesos mensuals per grup |
| `apps/frontend/lib/repartiment/motor.ts` | `calcularMoviments()` — tipus de norma |
| `apps/frontend/lib/repartiment/normes-default.ts` | Seed ~25 normes + 2 grups |
| `apps/frontend/lib/repartiment/service.ts` | Calcular/confirmar execució; `getDeltasGestioPerLn()` |
| `apps/frontend/lib/repartiment/gestio-consultes.ts` | Aplicar gestió a consultes |
| `apps/frontend/lib/repartiment/serialize.ts` | `decimalToNumber()` per Client Components |
| `apps/frontend/lib/compte-subtotals.ts` | `recalcularCompositesOnly()` — clau per no esborrar repartiment |

### UI

| Ruta | Descripció |
|------|------------|
| `/settings/repartiment` | Normes permanents (edició inline: ordre, nom, %, €, actiu) |
| `/dades/repartiment` | Llista mesos |
| `/dades/repartiment/[periodId]` | Pesos, moviments, calcular, confirmar; edició manual esborrany |
| `/consultes/empresa?vista=gestio` | Compte empresa tractat |
| `/consultes/linia?vista=gestio` | Compte LN tractat (+ columna **Repart.**) |

Tabs afegits a `settings/layout.tsx` i `dades/layout.tsx`.

Component avís: `apps/frontend/components/consultes/GestioAvis.tsx`  
(import CSS: `./GestioAvis.module.css` — **sense accent** al nom del fitxer)

### Consultes — vista Gestió

- **Empresa:** delta aplicat a cada columna LN.
- **Per línia:** centres = SAP directe; columna **Repart.** = imputació; total = suma.
- **Acumulat anual:** gràfic mensual inclou gestió si `vista=gestio` (via `aplicarGestioEvolucioLn`).
- Banner groc si no hi ha cap repartiment **confirmat** (esborrany no compta).

### Fixes importació / agregació (sessió anterior)

- Agregació per **`importacio.liniaNegociId`** (LN del fitxer), no només `centre.liniaNegociId`.
- Columnes codi desconegut («—») no es descarten si hi ha altres centres.
- Fitxers: `linia-informe.ts`, `processar-import.ts`, `consultes.ts`.

---

## 3. Com provar (checklist)

```powershell
cd C:\dev\OpsiaFinance
npx prisma migrate deploy
npx prisma generate
npm run dev   # o el script del monorepo
```

1. **Configuració → Repartiment** → «Carregar normes inicials» (només si 0 normes).
2. Importar i confirmar un mes (p.ex. Gener 2026).
3. **Dades → Repartiment** → mes → **Calcular / actualitzar** → revisar → **Confirmar repartiment**.
4. **Consultes → Per línia** (o Empresa) → Vista **Gestió (tractat)**.
5. Comparar KPIs i taula detall (columna Repart.) amb Directe.

**Important:** Només compten moviments amb execució **CONFIRMAT**. Calcular sense confirmar no canvia la consulta.

---

## 4. Tipus de normes (seed)

| Tipus | Descripció |
|-------|------------|
| `PERCENT_VENDES_PROPIES` | −% × vendes pròpies de la LN destí (base: node 6 ingressos) |
| `IMPORT_FIX` | Import fix mensual (€) |
| `PERCENT_POOL_CENTRAL` | % del pool Central (LN00000) per concepte |
| `REPARTIMENT_PROPORCIONAL` | Pool × pes del grup (vendes LN / suma grup) |
| `RESTEM` | Definit al schema; **motor incomplet** |

Grups seed:

- `GRUP_COMPRES_CENTRAL`: LN00002 + LN00003
- `GRUP_PERSONAL_CENTRAL`: LN00002 + LN00003 + LN00004

---

## 5. Bug conegut corregit (sessió actual)

**Problema:** Directe i Gestió mostraven els mateixos KPIs tot i repartiment confirmat.

**Causa:** `recalcularSubtotalsCompte()` sobreescrivia els deltas de repartiment en recalcular subtotals (Compres, Personal, Gestió…).

**Solució:** Després d’aplicar repartiment, usar només `recalcularCompositesOnly()` (`compte-subtotals.ts`).

---

## 6. Treball pendent (prioritat)

### A. Motor — correccions probables

1. **Pool no es redueix entre normes**  
   `motor.ts` té `reduirPoolsProporcionals()` però **no s’invoca**.  
   `% pool` i `proporcional` llegeixen sempre el pool Central inicial → sobrerepartiment.

2. **RESTEM**  
   Implementació parcial; cal tancar el pool com als Excels manuals.

3. **Ordre d’execució**  
   Revisar `ordre` de normes vs seqüència Excel (Central pròpies → proporcional → % gestió…).

4. **Base vendes**  
   Confirmar si pesos i `% vendes pròpies` han d’usar node **2 (Vendes)** o **6 (Ingressos)**.

5. **Signes**  
   Validar signe de moviments (costs negatius) per LN destí i resta a Central a `getDeltasGestioPerLn()`.

### B. Normes seed

- Comparar `normes-default.ts` amb Excels **Gener–Maig 2026**.
- Editar des de `/settings/repartiment` (ja editable) o actualitzar seed + migració de dades.
- Falten normes / percentatges / ordre respecte al manual.

### C. Validació

Metodologia recomanada:

1. Triar **1 mes + 1 LN** (p.ex. Febrer 2026 · LN00005).
2. Excel manual vs app: Directe → moviments repartiment → Gestió.
3. Documentar diferència per concepte (Compres / Personal / Gestió / EBITDA).

### D. UI / consultes (secundari)

- Gràfic per centre (vista mensual LN): encara mostra centres SAP; repartiment només a columna Repart. i KPIs.
- Vista comparativa Directe vs Gestió (side by side).
- Repartiment a consulta **Per centre**.
- Vigència normes (`vigentDesDe` / `vigentFins`) — model preparat, UI limitada.

### E. Importació

- Reprocessar importacions antigues si cal aplicar fix `linia-informe`.
- Columnes «—»: importar arbre dimensions o millorar avís a importació.

---

## 7. Fitxers clau (mapa ràpid)

```
prisma/schema.prisma
prisma/migrations/20260704220000_modul_repartiment/

apps/frontend/lib/repartiment/
apps/frontend/lib/consultes.ts          # getComparativaEmpresa/Ln + vista
apps/frontend/lib/compte-subtotals.ts
apps/frontend/lib/linia-informe.ts
apps/frontend/lib/processar-import.ts

apps/frontend/app/(app)/settings/repartiment/
apps/frontend/app/(app)/dades/repartiment/
apps/frontend/app/(app)/consultes/empresa/
apps/frontend/app/(app)/consultes/linia/

apps/frontend/components/consultes/GestioAvis.tsx
```

---

## 8. Decisions de negoci confirmades

1. Flux mensual: **revisar → editar → confirmar** (no auto-confirmar).
2. Pesos proporcionals = **% vendes del mes** dins del grup (2 o 3 LN).
3. Normes permanents amb possibilitat d’editar; vigència al model per fase futura.
4. Consultes: **Directe SAP** + **Gestió tractat** (no substituir tot el compte, sinó SAP + imputacions).

---

## 9. Següent sessió — per on continuar

**Opció recomanada:** validació **Febrer 2026 · LN00005** (Compres) o **Gener 2026 · LN00002** (Empresa) contra Excel.

Passos per l’agent / desenvolupador:

1. Fixar **reducció de pool** al motor (`motor.ts` + crida des de `service.ts`).
2. Executar repartiment del mes de referència i exportar moviments de `MovimentRepartiment`.
3. Comparar fila a fila amb Excel; ajustar normes o fórmules.
4. Repetir per 2–3 mesos abans de confiar en l’acumulat anual.

---

## 10. Comandes útils

```powershell
# Migració + client
npx prisma migrate deploy
npx prisma generate

# Estat migracions
npx prisma migrate status

# Studio (inspeccionar normes / moviments)
npx prisma studio
```

---

## 11. Invariant empresa (requisit de negoci)

**El total consolidat d'empresa ha de ser el mateix en Directe i en Gestió.**

El repartiment és una **reclassificació** entre LN (zero-sum), no ha de crear ni destruir marge.

### Per què fallava (acumulat 2026 — exemple real)

| Vista | EBITDA empresa |
|-------|----------------|
| Directe (SAP) | ~−45 k€ |
| Gestió (tractat) | ~−1,9 M€ |

**Causes al codi:**

1. **`getDeltasGestioPerLn`** només restava a Central per `PERCENT_POOL_CENTRAL` i `REPARTIMENT_PROPORCIONAL`.  
   `% vendes pròpies` i `IMPORT_FIX` cap a LN operatives **sumaven cost sense restar el pool Central** → cost net nou.
2. **Normes amb destí Central** (LN00000): `% vendes` i `fix` s'apliquen com a **delta additiu** sobre SAP, no com a reclassificació interna.
3. **Motor `calcularMoviments`**: el pool Central no es redueix entre passos; `reduirPoolsProporcionals()` no s'invoca.

### Correcció aplicada (juliol 2026, sessió 2)

1. `getDeltasGestioPerLn`: **zero-sum** — tot traspass a LN operativa resta a Central.
2. **Ignorar moviments amb destí Central** (normes 10–13): no són traspassos inter-LN.
3. `motor.ts`: **no genera moviments** amb destí Central (pool = SAP directe LN00000).
4. `validarZeroSumDeltas()` — comprova nodes 11, 17, 30 abans de confiar en consulta.

**Acció necessària:** recalcular i confirmar de nou els mesos per regenerar moviments.

### Pendent

---

## 12. Contacte / context

Projecte: **OpsiaFinance** — Next.js 15 + Prisma + PostgreSQL (Neon).  
Env: `apps/frontend/.env.local` (Prisma llegeix via `prisma.config.ts`).

Converses prèvies: veure transcript del mòdul repartiment i fixes LN00000/LN00005 importació.
