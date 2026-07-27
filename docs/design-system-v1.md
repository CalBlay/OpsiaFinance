# OpsiaFinance Design System V1

## 1. Objectiu

Aquest document defineix la base visual comuna del software.

La idea no es dissenyar cada pantalla des de zero.

La idea es construir una base corporativa unica que permeti:

- mateixa identitat a tots els moduls
- mateix layout a totes les pantalles
- mateixa jerarquia visual
- mateixa logica de navegacio
- menys decisions de disseny a cada modul

## 2. Principi principal

OpsiaFinance es un software intern de treball.

Per tant:

- no s'ha de comportar com una web comercial
- no s'ha de dissenyar com una landing page
- no ha de voler vendre res
- ha de ser directe, net i operatiu

## 3. Personalitat visual

La personalitat visual base ha de ser:

- neutra
- calmada
- corporativa
- molt llegible
- actual
- amb una mica de caracter, pero sense cridar

No volem:

- estil gamer agressiu
- foscor pesada
- neons constants
- efectes decoratius innecessaris

Si volem:

- lateral fort i clar
- base lluminosa per treballar millor
- accent fred i sobri
- disseny molt consistent

## 4. Decisio de color base

La base visual inicial queda definida aixi:

- fons principal clar
- superficies neutres i suaus
- text fosc amb bon contrast
- lateral mes dens que el cos principal
- un accent principal controlat
- un accent secundari de suport

### 4.1. Paleta inicial

- `bg-app`: `#F5F3EE`
- `bg-panel`: `#ECE7DE`
- `bg-card`: `#FBF9F5`
- `bg-sidebar`: `#DCE4E6`
- `ink-strong`: `#22313F`
- `ink-soft`: `#5C6B73`
- `line-soft`: `#D4DAD7`
- `accent-primary`: `#2F6F6D`
- `accent-secondary`: `#6E8CA0`
- `accent-warning`: `#C59B57`

## 5. Tipografia base

La tipografia ha de ser molt llegible i sense excentricitats.

Direccio recomanada actual:

- tipografia principal UI: `Manrope`
- alternativa 1: `IBM Plex Sans`
- alternativa 2: `Plus Jakarta Sans`
- titols: sans neta amb pes clar
- text: sans molt llegible
- no fer servir tipografies de videojoc
- no fer servir tipografies decoratives per treball diari

Fins que tanquem implementacio, la regla es:

- una sola familia principal per tota la UI
- pesos clars: `semibold`, `medium`, `regular`

La proposta inicial que queda millor posicionada es:

- `Manrope`

## 6. Estructura fixa del layout

Totes les pantalles han de partir de la mateixa estructura:

1. lateral esquerre fix
2. capcalera superior molt simple
3. paraula central superior que retorna a l'inici
4. zona principal de contingut

## 7. Home inicial

La portada ha de ser radicalment simple.

Nomes ha de contenir:

- `Settings`
- `Dades`

No hi ha d'haver:

- textos llargs
- dashboard a la home inicial
- blocs de resum encara
- sobreexplicacions

## 8. Menu lateral

El lateral ha de ser:

- curt
- molt clar
- sempre al mateix lloc
- amb icona i text

Base inicial:

- `Inici`
- `Settings`
- `Dades`

Mes endavant s'hi afegiran nous moduls, pero sense canviar la logica general.

## 9. Paraula central superior

Hi ha d'haver una sola paraula al centre superior que actuï com a retorn a la home.

Proposta inicial:

- `OpsiaFinance`

Aquesta paraula representa el producte actiu, no la marca mare global.

Regla:

- `Opsia` es la marca general
- `OpsiaFinance` es el producte actual
- en el futur es podran mostrar altres productes com `OpsiaProduccio`

## 10. Element grafic corporatiu

Cal definir un petit element visual propi que doni identitat sense carregar la interfície.

La direccio correcta no es un logo gran ni un element decoratiu constant.

La direccio correcta es una peça subtil de sistema.

Proposta base:

- una barra vertical fina d'accent
- una línia de capçalera molt subtil
- cantonades generoses i coherents en cards i panells

Aquest element ha de servir per:

- reforçar identitat
- donar ritme visual
- destacar sense cansar

## 11. Regla modular

Cada modul no dissenya el seu marc.

Cada modul hereta:

- colors
- espais
- capcalera
- lateral
- tipus de card
- tipografia
- estats visuals

El modul nomes aporta:

- contingut
- eines
- logica funcional

## 12. Base de construccio

La base tecnica de disseny s'ha d'organitzar en fitxers separats:

- `tokens`
- `layout`
- `navigation`
- `module shell`
- `moduls`

La finalitat es que, quan fem pantalles, no s'hagi de reinventar res.
