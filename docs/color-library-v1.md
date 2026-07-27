# OpsiaFinance Color Library V1

## 1. Objectiu

Aquest document fixa la llibreria de colors comuna del software.

La norma es simple:

- sempre farem servir aquests colors
- no es creen colors nous a cada modul
- els moduls hereten aquesta base

## 2. Principi d'us

La llibreria no es defineix nomes per colors bonics.

Es defineix per:

- treballar moltes hores sense cansar
- donar sensacio de control
- mantenir llegibilitat alta
- transmetre serietat i ordre

## 3. Colors corporatius base

### 3.1. Neutres

- `stone-50`: `#FBF9F5`
- `stone-100`: `#F5F3EE`
- `stone-200`: `#ECE7DE`
- `stone-300`: `#D4DAD7`

Us:

- fons generals
- superfícies
- separadors

### 3.2. Text

- `slate-900`: `#22313F`
- `slate-700`: `#5C6B73`

Us:

- text principal
- text secundari
- icones

### 3.3. Accents

- `teal-600`: `#2F6F6D`
- `steel-500`: `#6E8CA0`
- `amber-500`: `#C59B57`

Us:

- botons principals
- seleccions
- estats destacats
- avisos elegants

## 4. Colors semantics

Per no dependre del nom del color, definim tambe usos semantics:

- `bg-app`
- `bg-panel`
- `bg-card`
- `bg-sidebar`
- `ink-strong`
- `ink-soft`
- `line-soft`
- `accent-primary`
- `accent-secondary`
- `accent-warning`
- `ui-success`
- `ui-info`
- `ui-warning`

## 5. Regles d'us

- el fons principal sempre ha de ser clar
- el text principal sempre ha de ser `ink-strong`
- el color fort principal del producte es `accent-primary`
- el segon accent no ha de competir amb el principal
- `amber` no es per decorar, es per avisar o destacar amb moderacio

## 6. El que no farem

- no afegirem liles o porpres per defecte
- no farem servir negre pur com a base
- no farem servir vermell cridaner com a color principal
- no barrejarem accents nous segons la pantalla

## 7. Fitxers base

La llibreria viu a:

- `src/design-system/tokens.css`
- `src/design-system/colors.json`
