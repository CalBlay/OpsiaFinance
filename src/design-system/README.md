# Design System Base

Aquesta carpeta es la base corporativa del frontend.

No conte pantalles finals.

Conte les peces que totes les pantalles hauran d'heretar:

- `tokens.css`
- `colors.json`
- `typography.json`
- `graphic-element.json`
- `layout.json`
- `spacing.json`
- `components.json`
- `navigation.json`
- `module-shell.json`

Frontend (sincronitzat / consumit):

- `apps/frontend/styles/tokens.css`
- `apps/frontend/styles/opsia-corporate-colors.css` — verd / groc / taronja
- `apps/frontend/styles/opsia-consultes.css` — tipografia i superfícies de consultes (`--opsia-cx-*`)
- `apps/frontend/lib/opsia-colors.ts` — constants per gràfics (Recharts)
- `kpi-card.json` + `OpsiaKpiCard` — targeta KPI corporativa (dades per pantalla)

Objectiu:

- un sol ADN visual
- una sola estructura
- menys decisions repetides
- mes coherencia entre moduls
