# OpsiaFinance — Funcionament: Dades, Gestió i Cost de personal

Document funcional (sense detall tècnic d’implementació).  
Acordat amb el negoci · **Agost 2026**  
Objectiu: deixar clar **com ha de funcionar** l’eina, servir de README de referència i de **full de ruta** per revisar/alinear el producte.

---

## 1. Visió general

L’eina parteix de dades **SAP** (comptes d’explotació per centre) i construeix la **vista Gestió** aplicant capes de negoci.  
El **Cost de personal** (nòmina + millores) és, de moment, **informatiu i de control** (comparativa vs SAP), **sense entrar als càlculs** de Gestió.

```
Dades (importacions i capes)
        │
        ▼
┌───────────────────┐     ┌──────────────────────────────┐
│ Vista directa SAP │     │ Cost personal (informatiu)   │
│ (+ ajustos vis.)  │     │ + Comparativa vs SAP         │
└─────────┬─────────┘     └──────────────────────────────┘
          │
          │  + Ajustos → Repartiment → Traspassos
          ▼
┌───────────────────┐
│   Vista Gestió    │
└───────────────────┘
          │
          ▼
   Taules de consultes
   (cada casella amb desglossament)
```

---

## 2. Mòdul Dades — pestanyes

### 2.1 Importacions (Comptes d’explotació)

| Punt | Acord |
|------|--------|
| Què s’importa | Comptes d’explotació **per centre**, per **línia de negoci** |
| Contingut del fitxer | **1 mes + 1 LN + tots els seus centres** |
| Què omple | La **vista directa SAP**: vendes, sous i salaris, SS i la resta de línies oficials del C.Explotació |
| Estat | **Correcte — no tocar** |

La vista directa SAP ha de mostrar **únicament** aquesta informació importada (més la visibilitat d’ajustos, vegeu §4 i §5).

---

### 2.2 Repartiment

| Punt | Acord |
|------|--------|
| Què fa | Els costos de **LN0000 (Central)** es reparteixen cap a les **altres línies de negoci** |
| Com | Segons **condicions / normes de repartiment** configurades |
| Estat | **Correcte — no tocar** (normes i lògica de negoci ja validada) |

---

### 2.3 Traspassos de personal

| Punt | Acord |
|------|--------|
| Què fa | Cada mes s’importa un fitxer d’hores: treballador d’un **centre origen** amb temps dedicat a un **centre destí** |
| Efecte | Imputa el cost de personal corresponent al centre on s’ha dedicat realment el temps |
| Estat | **Correcte — no tocar** |

---

### 2.4 Cost de personal

Cada mes s’importen **2 fitxers amb la mateixa estructura**:

1. **Nòmina**
2. **Millores**

Exemple de fitxer: `Cost_Personal_07_26.xlsx`

#### Columnes d’import

| Columna | Contingut |
|---------|-----------|
| **J** | Import brut |
| **K** | Provisió de pagues extres |
| **L** | Seguretat Social |
| **M** | Total del fitxer — **s’ignora** |

**Càlculs:**
- **Sous / nòmina** = **J + K**
- **Seguretat social** = **L**
- **Cost per fila** = **J + K + L** (mai la columna M)

#### Granularitat del fitxer

El fitxer porta total per:

1. **Dimensió 1 — Línia de negoci** (ex.: `00 - Serveis Centrals` → LN0000)
2. **Dimensió 2 — Centre** (ex.: `00002 - Centre Decoració`)
3. **Dimensió 3 — Departament** (ex.: `00002001 - Departament personal`)

#### Mapeig (Configuració)

A **Configuració** hi ha el mapeig amb l’**arbre de dimensions** per imputar el cost a la LN i centre correctes.

**Criteri acordat:**

| Àmbit | Granularitat |
|-------|----------------|
| **LN00001** | Fins a **departament** (ja desglossat) |
| **Resta de LN** | De moment fins a **centre** (LN × Centre) |
| Clau de conciliació amb SAP | **LN × Centre** (el departament a les altres LN és ampliació futura) |

#### Rol actual (important)

- **No substitueix** les dades SAP.
- En teoria, la consolidació nòmina + millores hauria de **coincidir** amb SAP a les fileres de personal (vegeu comparativa).
- De moment: **informatiu**. Es veuen dades i comparativa. **No s’utilitza per cap càlcul** a Gestió.
- Ús futur (alimentar / substituir càlculs): **fora d’abast ara**; es decidirà més endavant.

#### Comparativa (subpestanya)

Objectiu: detectar **desviacions** entre **SAP directe** i **Nòmina + Millores**.  
**Gestió no entra** en aquesta vista (ni com a columna ni com a referència).

| Dimensió de vista | Què es compara |
|-------------------|----------------|
| Per **LN** | Total dels seus centres |
| Per **centre** | Desglossat |

**Columnes:** SAP directe · Nòmina · Millores · **Δ Sous (N+M − SAP)** · **Δ SS (N+M − SAP)**  
**SAP** = dades **directes importades**, **sense ajustos**.

A nivell de concepte, s’ha de veure **per separat**:

- **Salari** (cost salarial / sous)
- **Seguretat social**

(No només un total únic barrejat.)

---

### 2.5 Ajustos

| Punt | Acord |
|------|--------|
| Què fa | Modificar, corregir errors o afegir **regularitzacions** |
| Abast | **Qualsevol línia** del Compte d’explotació |
| Visibilitat | Han de ser **visibles amb la vista directa** (no amagats) |

---

### 2.6 Altres pestanyes (aparcades)

Hi ha **dues pestanyes** que afecten les **consultes de Restaurants**.  
**Fora d’abast** d’aquest document de moment.

---

## 3. Vista Gestió — regla de càlcul

**Base:** dades SAP (vista directa).

**Capes que SÍ entren al càlcul de Gestió**, en aquest ordre:

1. **Ajustos**
2. **Repartiment** (Central → altres LN)
3. **Traspassos de personal**

```
Gestió = SAP
       → + Ajustos
       → + Repartiment
       → + Traspassos de personal
```

**Cost de personal (nòmina + millores):** no entra al càlcul de Gestió (només informatiu / comparativa).

> Nota: s’assumeix que l’ordre no canvia el resultat numèric global si les operacions són additives i sobre conjunts coherents; l’ordre anterior és el **de negoci acordat** per aplicar i revisar.

---

## 4. Pantalla i traçabilitat

A **totes les taules de consultes**, **cada casella**:

- Amb **clic** es veu el **desglossament** d’origen del número final.
- El desglossament ha d’incloure, com a mínim: **SAP base + traspassos + ajustos + repartiment → total**.
- Si l’usuari és **admin**, també pot **editar** des del detall (comportament ja present a moltes caselles; s’ha d’alinear a tot arreu).

**Vista directa SAP:** també ha de mostrar detall si hi ha **algun ajust** aplicat a aquella casella.

---

## 5. Resum: què toca / què no

| Element | Estat / rol |
|---------|-------------|
| Importacions C.Explotació SAP | OK — no tocar |
| Repartiment (normes) | OK — no tocar |
| Traspassos de personal | OK — no tocar |
| Cost personal (import + mapeig) | Dades + comparativa; **sense càlcul a Gestió** |
| Ajustos | Capa activa; visibles a directa i Gestió |
| Gestió | SAP + ajustos + repartiment + traspassos |
| Pestanyes Restaurants | Aparcat |
| Desglossament per casella | Obligatori a consultes; directa si hi ha ajust |

---

## 6. Full de ruta (revisió i alineació)

Ordre de treball un cop validat aquest document:

### Fase A — Validació documental
- [x] Acord funcional recollit en aquest fitxer
- [x] Revisió conjunta: document = font de veritat (opció A, agost 2026)

### Fase B — Revisió de dalt a baix (producte vs aquest document)
Revisar el comportament real i **parar ante qualsevol dubte** (pregunta → resposta → continuar):

1. [x] Importacions SAP → vista directa (SAP + ajustos visibles)
2. [x] Ajustos visibles a vista directa + detall de casella
3. [~] Ordre Gestió acordat: ajustos → repartiment → traspassos  
    *(implementació actual: SAP+ajust → traspassos al bloc personal → repartiment; efecte additiu equivalent en la majoria de casos)*
4. [x] Cost personal **no** alimenta Gestió (corregit: abans substituïa sous/SS)
5. [x] Comparativa: per LN i per centre; focus **(N+M) − SAP**; sous i SS separats
6. [x] Traçabilitat: detall sense «payroll substitueix SAP»; admin edita a directa
7. [x] Pestanyes Restaurants aparcades

### Fase C — Correccions
- [x] Treure payroll de `carregarBaseGestioPersonal` i consumidors Gestió/repartiment
- [x] Actualitzar copy Dades / detall casella / subtítols
- [x] Comparativa amb agregat LN + delta principal (N+M)−SAP
- [ ] (Opcional) Reordenar estrictament traspass després de repartiment si cal traçabilitat literal
- [ ] Revisió manual en pantalla amb dades reals del període

### Fase D — Futur (explícitament NO ara)
- Usar Cost personal com a font de càlcul / substitució de sous i SS a Gestió
- Ampliar granularitat departament a LN diferents de LN00001
- Pestanyes i consultes Restaurants

---

## 7. Glossari ràpid

| Terme | Significat |
|-------|------------|
| **Vista directa SAP** | Compte d’explotació tal com ve de SAP (per LN/centre/mes) |
| **Vista Gestió** | Mateixa estructura, amb ajustos + repartiment + traspassos |
| **LN0000 / Central** | Línia que concentra costos a repartir |
| **Cost personal** | Fitxers nòmina + millores (J+K+L); control vs SAP |
| **Comparativa** | Desviacions Cost personal ↔ SAP (salari i SS, LN i centre) |

---

## 8. Historial d’acord

| Data | Contingut |
|------|-----------|
| Agost 2026 | Primera redacció a partir de sessió de validació negoci (Dades → Gestió → Cost personal informatiu) |
| Agost 2026 | Confirmació: document = font de veritat; payroll tret dels càlculs de Gestió; comparativa alineada |
| Agost 2026 | Comparativa SAP = directe **sense ajustos** |
| Agost 2026 | Parser Cost Personal reescrit: capçaleres LN no hereten; Cost=J+K+L; layout per nom / I-J-K-L |
| Agost 2026 | Fix layout Excel: desplaçament +1 (llegia K/L/M com J/K/L); prioritat capçaleres i I/J/K/L |
