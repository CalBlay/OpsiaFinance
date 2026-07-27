# OpsiaFinance

Software intern de consulta, anàlisi i comparativa financera.
Substitueix la feina manual amb Excels de SAP Business One.

→ [Blueprint V1](docs/blueprint-v1.md)

---

## Arrencar en local

### 1. Instal·lar dependències

```bash
npm install
```

### 2. Configurar variables d'entorn

```bash
cp .env.example .env.local
# Edita .env.local amb la teva DATABASE_URL de Neon
```

### 3. Preparar la base de dades

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 4. Arrencar el servidor de dev

```bash
npm run dev
```

L'app arrenca a [http://localhost:3000](http://localhost:3000).

---

## Estructura

```
OpsiaFinance/
├── apps/
│   └── frontend/              # Next.js 15 (App Router)
│       ├── app/
│       │   ├── (app)/         # Rutes autenticades (amb AppShell)
│       │   │   ├── page.tsx   # Home → /
│       │   │   ├── settings/  # Mòdul Admin → /settings
│       │   │   └── dades/     # Mòdul Dades → /dades
│       │   └── (auth)/        # Rutes públiques (sense sidebar)
│       │       └── login/     # → /login
│       ├── components/
│       │   ├── layout/        # AppShell, Sidebar, Topbar
│       │   └── ui/            # Components reutilitzables
│       ├── lib/               # db.ts, utils.ts
│       ├── styles/            # tokens.css (design system)
│       └── types/             # Tipus TypeScript compartits
├── packages/                  # Paquets compartits (futur backend, etc.)
├── prisma/                    # Schema + migracions
├── docs/                      # Blueprint + design system
├── biome.json                 # Linting + format
└── .env.example               # Template variables d'entorn
```

## Scripts

| Comanda | Descripció |
|---------|-----------|
| `npm run dev` | Servidor de dev |
| `npm run build` | Build de producció |
| `npm run lint` | Biome check |
| `npm run lint:fix` | Biome check + autofix |
| `npm run format` | Format de codi |
| `npm run prisma:migrate` | Nova migració |
| `npm run prisma:generate` | Regenera client Prisma |

## Eines de qualitat

- **Biome** — linting + format (reemplaça ESLint + Prettier)
- **Husky** — pre-commit hook automàtic
- **TypeScript strict** — mode estricte activat

## Ordre de construcció V1

1. ✅ Fonaments tècnics (actual)
2. ⬜ Mòdul Admin: usuaris, rols, auth
3. ⬜ Mòdul Dades: upload Excel, parser, normalització
4. ⬜ Mòdul Consulta: queries P&L
5. ⬜ Mòdul Dashboard: KPIs, gràfics
