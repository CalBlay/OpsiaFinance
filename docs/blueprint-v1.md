# OpsiaFinance Blueprint V1

## 1. Objectiu del producte

OpsiaFinance ha de convertir la feina manual amb Excels de SAP Business One en un software intern de consulta, analisi i comparativa financera.

La idea base es:

- pujar els fitxers una sola vegada cada mes
- classificar-los i preparar-los perque el sistema els pugui treballar
- permetre consultes molt rapides per mes, linia de negoci i centre
- oferir una capa visual clara, util i molt facil d'entendre

La V1 se centrara en:

1. gestio, carrega i classificacio d'informes Excel
2. consulta de comptes d'explotacio
3. dashboards, grafiques i comparatives

Les prediccions i consultes avancades quedaran definides com a fase posterior.

## 2. Principi rector de producte

OpsiaFinance no es dissenya per tecnics.

Es dissenya per usuaris finals, molts d'ells amb poca familiaritat informatica i amb necessitat de trobar el que busquen de manera immediata.

Per tant, queda fixat com a criteri obligatori del producte:

- molt pocs clics
- molt poca lectura
- zero llenguatge tecnic a la interfície
- accions evidents
- pantalla neta i clara
- navegacio molt simple
- aprenentatge gairebe innecessari

La sensacio d'us ha de ser:

- "se on he d'entrar"
- "veig de seguida que puc fer"
- "no em puc perdre"
- "no haig d'entendre informatica ni finances per moure'm"

Aquest criteri te prioritat per sobre de:

- sofisticacio visual gratuita
- explicacions llargues a pantalla
- menus densos
- configuracions amagades o massa tecniques

## 3. Problema que resol

Actualment la informacio surt d'Excels descarregats de SAP B1 i despres es treballa manualment.

Els principals problemes actuals son:

- dependencia d'Excels per consultar dades
- repeticio de feina cada mes
- dificultat per comparar linies, centres i periodes
- poca escalabilitat quan apareixen nous informes o nous formats
- consum complicat per a usuaris no financers

OpsiaFinance ha d'actuar com a capa unica de lectura i explotacio de la informacio.

## 4. Tipus d'usuari

### 4.1. Usuari editor

Es la persona que alimenta el sistema.

Necessitats principals:

- pujar Excels rapidament
- classificar cada informe
- revisar i editar dades carregades
- corregir errors o camps mal interpretats
- definir nous formats d'informe en el futur

Criteris UX:

- molt funcional
- pocs passos
- validacions clares
- control total sobre la carrega

Permisos base:

- crear
- editar
- esborrar si te permisos actius per aquella funcio

### 4.2. Usuari consultor

Es la persona que consulta la informacio.

Necessitats principals:

- entendre l'estat del negoci sense coneixement financer profund
- navegar per LN, centres i mesos amb pocs clics
- veure comparatives i tendencies de forma visual
- arribar al detall nomes quan el necessiti

Criteris UX:

- dashboard modern
- llenguatge clar
- visuals prioritaris
- navegacio molt simple

Permisos base:

- veure i consultar

### 4.3. Usuari admin

Es la persona que governa el software.

Necessitats principals:

- administrar usuaris
- administrar permisos
- administrar configuracions del sistema
- tenir acces complet a totes les funcions

Permisos base:

- pot fer tot el que fa l'editor
- pot fer tot el que fa el consultor
- pot administrar el sistema

## 5. Regles obligatories de UX

Aquest punt queda fixat com a norma de projecte.

### 5.1. Regla de simplicitat extrema

Cada modul ha de deixar veure molt clarament:

- que puc fer aqui
- on he de clicar
- quin es el pas seguent

Si una pantalla obliga a llegir massa, pensar massa o interpretar massa, no esta ben resolta.

### 5.2. Regla de pocs clics

Cada funcio principal ha d'estar resolta amb el minim nombre de clics possible.

Exemple:

- al modul d'usuaris, l'usuari ha de veure directament la llista i el boto `+`
- en clicar `+`, ha d'apareixer el formulari de creacio
- el formulari ha de demanar nomes els camps necessaris

No hi ha d'haver:

- pantalles intermig innecessaries
- textos explicatius llargs
- blocs decoratius que dificultin l'accio

### 5.3. Regla de llenguatge

La interfície ha de parlar com parla l'usuari, no com parla un equip tecnic.

Per tant:

- evitar paraules tecniques si no son imprescindibles
- evitar sigles sense context visible
- evitar textos propis d'una demo o d'una documentacio
- prioritzar paraules simples i accions clares

### 5.4. Regla per usuaris +50

El producte s'ha de pensar explicitament per a usuaris de mes de 50 anys que no necessiten tecnologia sofisticada, sino claredat.

Aixo implica:

- contrast visual clar
- tipografia molt llegible
- espais generosos
- jerarquia molt marcada
- botons facils d'identificar
- icones de suport, pero no com a unica pista
- evitar soroll visual

### 5.5. Regla de no saturacio

No s'han d'omplir pantalles amb:

- textos de context
- explicacions de concepte
- targetes sense funcio real
- efectes visuals que distreguin

La pantalla ha de treballar, no explicar-se.

### 5.6. Regla d'accio directa

Les pantalles principals han d'estar orientades a accio immediata.

Exemple:

- `Usuaris`: veure, crear, editar, configurar
- `Entrada`: pujar, classificar, revisar, guardar
- `Consulta`: filtrar, veure, comparar

Tot el que no ajudi directament a una d'aquestes accions s'ha de qüestionar.

## 6. Model de permisos

El model de permisos no sera rigid des del primer dia.

La base funcional sera:

- rols generals: `consultor`, `editor`, `admin`
- permisos detallats per funcio dins de cada modul
- configuracio evolutiva a mesura que es defineixin els moduls

### 6.1. Principi rector

Els permisos es definiran:

- per modul
- per funcio dins de cada modul

Exemples futurs:

- veure
- crear
- editar
- esborrar
- validar
- administrar

### 6.2. Modul de settings

Hi haura un modul especific de `settings` des d'on l'admin podra:

- gestionar usuaris
- gestionar rols
- activar o restringir permisos per funcio
- ajustar configuracions generals del software

## 7. Dimensions de negoci

### 7.1. Dimensio 1: Linia de negoci

Les linies de negoci es codifiquen amb valors com:

- `LN00000`
- `LN00001`
- ...
- `LN00006`

Cada LN representa una unitat principal d'analisi.

### 7.2. Dimensio 2: Centre

Els centres es codifiquen amb valors com:

- `CCR00001`
- `CCC00003`

Una linia de negoci pot tenir un o diversos centres associats.

### 7.3. Dimensio temporal

La informacio es treballa com a minim per:

- any
- mes

Mes endavant es podra valorar acumulat anual, trimestral o altres agregacions.

## 8. Tipus d'informes

El sistema ha de poder gestionar diferents informes d'origen.

Exemples actuals:

- `Informe de evaluación de negocios`
- `PyG Ejercicio Lin.Neg.`
- `PyG Ejercicio Centro`
- `PyG por Centros`
- `PyG por Línea de Negocio`
- `PyG Mensual por Centros`
- `PyG Mensual por Línea de Negocio`

### 8.1. Requisit clau

El sistema no pot dependre nomes d'uns Excels fixos.

Ha de permetre:

- tenir formats predefinits
- editar els formats existents
- crear nous formats
- mapar nous informes a una estructura comuna

Per tant, el software ha de ser configurable.

## 9. Modul 1: Centre de control d'importacions

Aquest es el primer pilar del software.

No es nomes una pantalla per pujar fitxers. Es el modul que transforma Excels en dades explotables.

### 9.1. Funcions principals

- pujar un o diversos fitxers Excel
- identificar el mes i l'any
- classificar el tipus d'informe
- detectar LN i centres si existeixen
- permetre revisio abans de confirmar
- permetre edicio manual de dades importades
- guardar l'historic de carregues

### 9.2. Flux ideal d'usuari editor

1. puja l'Excel
2. el sistema intenta reconeixer el tipus d'informe
3. l'usuari confirma o corregeix la classificacio
4. el sistema mostra una previsualitzacio
5. l'usuari edita si cal
6. es valida i es guarda
7. el backend transforma la informacio a model intern

### 9.3. Configuracio de formats

Cada tipus d'informe hauria de tenir:

- nom del format
- descripcio
- tipus d'informe
- full o fulls que s'han de llegir
- regles de deteccio
- mapatge de columnes o cel·les
- regles de normalitzacio
- regles opcionals de negoci

### 9.4. Edicio despres de la carrega

Els Excels pujats han de poder-se editar.

La V1 hauria de permetre com a minim:

- corregir classificacio
- corregir mes o any
- corregir LN o centre detectat
- corregir valors importats abans de publicar-los

### 9.5. Regla UX del modul

Aquest modul ha de ser rapid i operatiu.

No ha de semblar un gestor documental complicat.

Ha de funcionar com:

- pujo
- reviso
- corregeixo
- guardo

## 10. Modul 2: Consulta de comptes d'explotacio

Aquest es el primer gran modul de consum de dades.

### 10.1. Consultes minimes V1

- veure comptes globals per mes
- veure comptes per linia de negoci
- veure comptes per centre
- veure comptes d'una LN amb desglossament per centres
- veure comptes d'un centre concret per diferents mesos
- filtrar per any, mes, LN i centre

### 10.2. Formats de visualitzacio

La V1 hauria de contemplar:

- taula resum
- taula detallada
- vista jerarquica LN > centre > compte
- vista mensual per columnes

### 10.3. Requisit UX

L'usuari no ha d'haver d'entendre l'origen Excel.

Ha de pensar en preguntes com:

- com ha anat aquest mes
- com va una LN
- quin centre esta pitjor o millor
- on ha canviat mes el marge o el cost

### 10.4. Regla UX del modul

La consulta ha de prioritzar:

- filtres molt clars
- resultat immediate
- lectura visual
- facilitat per comparar

## 11. Modul 3: Dashboard i comparatives

Aquest es el modul mes visual de la V1.

### 11.1. Objectiu

Fer que la lectura financera sigui clara fins i tot per a una persona sense bagatge financer.

### 11.2. Vistes minimes

- resum executiu del mes
- evolucio mensual d'una LN
- comparativa entre centres d'una mateixa LN
- comparativa entre mesos
- comparativa entre LN

### 11.3. Tipus de visuals

- targetes KPI
- grafics de linia per evolucio temporal
- barres per comparar LN o centres
- taules resum amb variacio absoluta i percentual

### 11.4. Principis de disseny

- molt visual
- molt poc text tecnic
- maxim context amb minims clics
- possibilitat de baixar al detall
- lectura clara de que puja, que baixa i que preocupa

## 12. Model de dades funcional

La capa interna de dades hauria de convergir, com a minim, en aquesta estructura conceptual:

- `periode`
- `any`
- `mes`
- `tipus_informe`
- `compte`
- `codi_compte` si existeix
- `linia_negoci`
- `centre`
- `import`
- `origen_fitxer`
- `origen_full`
- `estat_validacio`

Mes endavant s'hi podrien afegir:

- familia de compte
- grup de compte
- compte operatiu vs ajust
- notes o incidencies

## 13. Regles de negoci

Segons el que ja hem vist, hi ha regles manuals o semimanuals que tambe formen part del sistema.

Exemples:

- repartiments de totals entre diferents LN
- exclusions
- imputacions salarials
- ajustos especifics per informe

Aixo implica que el model ha de preveure:

- dades originals importades
- dades normalitzades
- dades ajustades per regles

La V1 no cal que resolgui totes les automatitzacions, pero si que ha de neixer preparada per a aixo.

## 14. Principis de producte

OpsiaFinance s'hauria de construir sobre aquests principis:

- una sola carrega mensual
- una sola font interna de veritat
- mateixa dada, multiples vistes
- configuracio abans que rigidesa
- usabilitat abans que tecnicisme
- dashboard pensat per negoci, no per comptabilitat pura
- simplicitat abans que espectacularitat

### 14.1. Focus actual del projecte

La primera fase no ha de perdre el focus principal actual.

La prioritat es:

- pujar els Excels reals que feu servir avui
- tractar-los correctament
- convertir-los en dades consultables
- consultar comptes d'explotacio en diferents formats
- fer comparatives i grafiques utils

La idea es construir una base solida avui sense tancar la porta al creixement futur.

### 14.2. Eina viva pero enfocada

El producte ha de ser una eina viva i evolutiva, pero sense dispersar la primera versio.

Per tant:

- la V1 resol el cas real actual
- l'arquitectura es deixa preparada per creixer
- les capes de coneixement, plantilles i assistencia evolucionaran mes endavant

## 15. Arquitectura de software

### 15.1. Decisio ja presa

El projecte no es construira com a monolit.

La decisio es:

- `frontend` separat
- `backend` separat

### 15.2. Estructura logica prevista

El software es planteja en quatre capes principals:

- `frontend`: interfície d'usuari
- `backend`: API, logica de negoci i importacio
- `BBDD`: capa persistent de dades
- `storage`: fitxers originals Excel i possibles arxius associats

### 15.3. Per que s'ha triat aquesta via

Els motius principals son:

- mes claredat d'arquitectura
- millor separacio de responsabilitats
- millor preparacio per creixer
- mes flexibilitat futura per integrar nous moduls i serveis

### 15.4. Decisio tancada de base tecnologica

Queda fixada la base tecnologica principal del projecte:

- `frontend` separat en `TypeScript`
- `backend` separat en `TypeScript`
- `BBDD` `PostgreSQL`
- `proveidor de BBDD`: `Neon`

### 15.5. Tipus de BBDD recomanada

Per aquest projecte es recomana una:

- `BBDD relacional`

Motiu:

- hi haura relacions entre usuaris, informes, imports, LN, centres, periodes i comptes
- caldran filtres i comparatives consistents
- el model financer encaixa millor en relacional que en documental

Opcio preferent:

- `PostgreSQL`

### 15.6. Decisio sobre BBDD

La decisio de projecte es:

- `PostgreSQL` com a motor de base de dades
- `Neon` com a proveidor inicial

### 15.7. Motiu de la decisio

Els motius principals son:

- bon encaix amb dades financeres relacionades
- bona base per consultes, comparatives i reporting
- estandard solid de mercat
- cost inicial baix
- facilitat de creixement
- bona compatibilitat futura amb integracions i noves fonts de dades

### 15.8. Modularitat obligatoria del sistema

La modularitat es un requisit estructural del projecte, no una millora opcional.

Cal que quedi clar des del principi que el software s'ha de construir de forma `modular`.

#### 15.8.1. Que vol dir modular en aquest projecte

Vol dir que el backend no s'ha d'organitzar com un unic bloc desordenat, sino per arees funcionals separades.

Exemples de moduls futurs:

- `auth`
- `users`
- `permissions`
- `settings`
- `imports`
- `report-types`
- `report-templates`
- `financial-model`
- `financial-queries`
- `dashboards`
- `integrations`
- `documents`

#### 15.8.2. Motiu de la modularitat

La modularitat es important perque en el futur es vol:

- connectar compres
- connectar vendes
- connectar diferents fonts de dades
- descarregar i guardar documents
- ampliar informes i plantilles
- integrar altres apps o serveis

#### 15.8.3. Regla de disseny

Cada modul haura de tenir, en la mesura del possible:

- responsabilitat clara
- regles de negoci propies
- permisos propis
- estructura preparada per creixer sense afectar la resta del sistema

## 16. Estrategia de dades i documents

Cal separar clarament tres capes:

- `BBDD relacional`
- `storage de fitxers`
- `base documental i de coneixement`

### 16.1. Que ha d'anar a la BBDD

La BBDD ha de guardar informacio estructurada, relacional i consultable pel software.

Exemples:

- usuaris
- rols
- permisos
- LN
- centres
- subdimensions si s'activen
- periodes
- comptes
- tipus d'informe
- plantilles d'informe
- carregues d'importacio
- files importades ja normalitzades
- regles de negoci
- ajustos
- relacions entre dades
- metadades dels documents

### 16.2. Que no s'ha de guardar cru a la BBDD

No s'ha de bolcar el contingut brut de carpetes documentals com `IEBS` dins la BBDD.

Per exemple, no es bona practica guardar directament dins la BBDD:

- PDFs complets
- Excels complets
- DOCX complets
- PPTX complets
- manuals sencers

### 16.3. Que ha d'anar a storage

Els arxius originals s'han de guardar en una capa de `storage`.

Exemples:

- Excels pujats del negoci
- PDFs
- DOCX
- PPTX
- documentacio IEBS
- futurs documents de suport o d'analisi

### 16.4. Que s'ha de guardar a la BBDD sobre aquests documents

De cada document, la BBDD hauria de guardar com a minim:

- nom
- ruta o identificador al storage
- tipus de document
- categoria
- origen
- data de carrega
- estat
- etiquetes
- resum si existeix
- relacio amb moduls o temes

### 16.5. Paper de la carpeta IEBS

La carpeta `IEBS` no forma part del nucli transaccional de dades financeres.

La seva funcio es:

- servir de base documental
- donar context de coneixement
- inspirar plantilles futures
- ajudar a definir KPIs, criteris i analisis

### 16.6. Com es faran les consultes

Hi haura dos grans tipus de consulta:

#### Consultes operatives i financeres

Es faran contra la `BBDD relacional`.

Exemples:

- compte d'explotacio per LN
- compte d'explotacio per centre
- comparatives per mes
- dashboards i indicadors

#### Consultes documentals o de coneixement

Es faran contra:

- el cataleg documental guardat a la BBDD
- i mes endavant, si es decideix, contra una capa de cerca o indexacio avancada

### 16.7. Decisio actual

Per tant, la decisio es:

- `els documents IEBS no es bolquen sencers a la BBDD`
- `els documents es guarden a storage`
- `la BBDD nomes en guarda les metadades i classificacio`
- `les dades financeres estructurades si que viuen a la BBDD`

## 17. Memoria tecnica pendent de concretar

La memoria tecnica haura de tancar, com a minim:

- tecnologia exacta del frontend
- tecnologia exacta del backend
- storage de fitxers
- estrategia d'autenticacio
- model de desplegament
- politica de copies i traçabilitat

## 18. Fora de l'abast de la primera iteracio

No es considera prioritari per a la primera iteracio:

- prediccions avancades
- assistent conversacional sobre dades
- automatitzacions completes de regles complexes
- permisos molt detallats per rols finsos
- integracio directa en temps real amb SAP

## 19. Decisions obertes per concretar despres

Aquestes questions encara s'han de tancar abans de passar a arquitectura i pantalles:

- llista oficial de LN
- llista oficial de centres i relacio amb LN
- definicio exacta de cada tipus d'informe
- camps obligatoris de cada format
- quins comptes son clau al dashboard
- quines comparatives seran imprescindibles a la V1
- quines edicions es poden fer i quines han de quedar auditades
- model de storage
- model d'autenticacio

## 20. Proper pas recomanat

Despres d'aquest blueprint, el següent document hauria de ser:

1. mapa d'entitats i dades
2. flux detallat del modul d'importacio
3. estructura de pantalles de la V1
4. arquitectura tecnica candidata

## 21. Ordre inicial de construccio

L'ordre inicial de construccio del software queda definit aixi:

### 21.1. Primer modul: Admin

El primer modul que s'ha de construir es el `modul d'Admin`.

Objectiu:

- poder crear usuaris
- poder gestionar usuaris
- poder assignar rols
- poder preparar la futura gestio de permisos per funcio

Aquest modul es prioritari perque el sistema ha de neixer amb govern i control des del primer dia.

### 21.2. Segon modul: Entrada d'informacio

El segon modul que s'ha de construir es el `modul d'entrada d'informacio`.

Objectiu:

- pujar documents
- classificar documents
- pujar Excels
- revisar i editar la informacio importada
- preparar les dades perque el backend les pugui normalitzar i treballar

### 21.3. Logica de la prioritat

La sequència inicial correcta es:

1. `governar qui entra i que pot fer`
2. `permetre l'entrada i tractament de la informacio`
3. `despres construir la consulta i l'explotacio`

## 22. Nota de direccio per al desenvolupament

Tot el codi, pantalles i prototips que es facin a partir d'ara hauran de respectar aquest criteri:

- menys explicacio
- mes accio
- menys estructura tecnica visible
- mes claredat per a usuari final

Si una implementacio no encaixa amb aquesta filosofia, s'ha de replantejar encara que tecnicament sigui correcta.
