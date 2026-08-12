# 10 · Project Structure & Development Guidelines — بنية المشروع وإرشادات التطوير

## 10.1 Monorepo layout
```
interactive master-plan/
├── docs/                     # this documentation set (10 focused docs)
├── data/
│   └── plots.geojson         # ETL output — 958 plots (generated, source of seed)
├── scripts/etl/
│   ├── kml-to-geojson.ps1    # KMZ → GeoJSON (done, verified)
│   └── load-postgis.*        # GeoJSON → PostGIS (ogr2ogr / node loader)
├── preview/
│   ├── _template.html        # standalone map template (data placeholder)
│   └── kec-master-plan.html  # self-contained map (data embedded) — double-click to open
├── infra/
│   ├── docker-compose.yml    # postgis, martin, api, web, redis, minio, keycloak, proxy
│   ├── martin/config.yaml    # MVT tile source config
│   └── db/                   # migrations, seed SQL
├── apps/
│   ├── api/                  # NestJS backend
│   │   └── src/{plots,auth,admin,dashboard,audit,common}
│   └── web/                  # React + Vite + MapLibre frontend
│       └── src/{app,map,modules,components,lib,styles}
└── packages/
    ├── ui/                   # KEC design-system components + tokens
    └── types/                # shared TS types (plot schema, land-use enum, roles)
```

## 10.2 Conventions
- **Language:** TypeScript everywhere (frontend + backend). Strict mode on.
- **Naming:** files kebab-case; React components PascalCase; vars/functions camelCase;
  SQL snake_case; enum keys match the DB (`Education`, `South`).
- **Shared truth:** the plot schema, land-use catalogue and role→permission map live once
  in `packages/types` and are imported by both apps — never duplicated.
- **Config over hard-coding:** land uses, colours, sectors, statuses come from the DB /
  option lists, not literals in components (the map legend seeds from them).
- **RTL & i18n:** logical CSS properties only; user-facing strings in an `ar` resource;
  codes/coordinates stay Latin/mono.

## 10.3 Git & workflow
- Trunk-based with short-lived feature branches; PRs required; no direct pushes to `main`.
- **Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`).
- Every PR: lint + typecheck + tests green; at least one review; linked to a roadmap epic.

## 10.4 Quality gates (CI — GitHub Actions)
1. `lint` (ESLint + Prettier) · 2. `typecheck` (tsc) · 3. `test` (unit + integration) ·
4. `build` (web + api) · 5. `docker build` images · 6. deploy to `staging` on `main`.

## 10.5 Testing (summary; see below)
- **Unit:** ETL parsing, land-use/sector derivation, permission map, geometry helpers.
- **Integration:** API + PostGIS (testcontainers) — plot CRUD, rename, audit, tiles.
- **E2E:** Playwright — map loads, filter/search, inspector, rename flow, dashboard.
- **Data QA:** post-ETL assertions (count = 958, `ST_IsValid`, land-use ∈ catalogue).
- Target ≥ 70% coverage on core logic; the map preview already has a scripted DOM/JS check.

## 10.6 Local development
```bash
# 1. Seed data (Windows-native, no Node needed for this step)
powershell -ExecutionPolicy Bypass -File scripts/etl/kml-to-geojson.ps1

# 2. Bring up the stack
cd infra && docker compose up -d        # postgis, martin, redis, minio, keycloak
# 3. Load plots into PostGIS
docker compose run --rm loader          # runs scripts/etl/load-postgis

# 4. Backend & frontend
cd ../apps/api && npm install && npm run start:dev
cd ../web && npm install && npm run dev  # http://localhost:5173
```
> Note: this workstation currently has **no Node/npm/Docker** installed. The ETL and the
> standalone `preview/kec-master-plan.html` run today with zero toolchain. The full stack
> above runs on any dev machine/server once Node 20+ and Docker are installed.

## 10.7 Definition of Done (per feature)
Code + tests + docs updated · RBAC enforced server-side · mutations audited/versioned ·
RTL + a11y checked · matches the design system · CI green · reviewed.

## 10.8 Coding philosophy
Build for the next ten years, not a demo. The **engine is generic, the data is specific**.
Every module scales independently. Prefer reuse of existing utilities and the shared
`packages/*` over new one-off code.
