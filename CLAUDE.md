# CLAUDE.md — project context for Claude Code

> This file is read automatically at the start of every Claude Code session, on any
> machine that has the repo. It captures what the project is, how to run it, and the
> conventions to follow so work stays consistent across computers.

## What this is
A premium, **Arabic-first (RTL) with an English toggle**, **KEC-branded** interactive
GIS master-plan web app for **مدينة المعرفة الاقتصادية / Knowledge Economic City (KEC)**.
It shows **958 land plots** (from `GIS KEC.kmz` → `data/plots.geojson`) on an interactive
map, with per-plot details, an admin console for editing, development plans, investment
highlights, print-ready reports, and an executive dashboard.

The product owner communicates in **Arabic** — reply in Arabic. The app itself is
Arabic-first RTL; every user-facing string has AR + EN in `apps/web/src/lib/domain.ts`.

## Stack
React 18 + TypeScript + Vite · MapLibre GL (map) · Zustand (state) · Firebase
(Firestore sync + Storage + Auth) · npm workspaces monorepo. Firebase config is
**committed in code** (`apps/web/src/lib/firebase.ts`) — the app runs after a plain
clone with **no `.env` needed**.

## Run / build / verify (Windows; Node 20+)
```powershell
npm install                         # once, at the repo root
npm run dev:web                     # dev server → http://localhost:5173  (or: npm run dev --workspace @kec/web)
```
Before committing previewable changes, always:
```powershell
cd apps/web
npx tsc --noEmit                    # typecheck — MUST be clean
npx vite build                      # production build — MUST pass
```
`tsconfig` has **`noUnusedLocals` + `noUnusedParameters`** → any unused import/var
**fails the build**. Remove them.

## Repo layout
```
apps/web/    the production app (this is what we work on)
  src/map/         MapView.tsx, mapStyle.ts       (MapLibre map, layers, camera)
  src/components/  DetailPanel (plot card), ControlPanel (filters), PlotFactsheet,
                   ReportView, ExecDashboard, CompareModal, MultiSelectPanel, …
  src/admin/       AdminConsole, PlotEditor (all editing lives here)
  src/lib/         domain.ts (types + i18n), store.ts (useApp), overrides.ts
                   (useOverrides), effective.ts, firebase.ts, dialog.tsx, …
  src/styles/      tokens.css (design tokens), app.css, admin.css
packages/    shared TS types (@kec/types) + design system
docs/        10 architecture docs (start at docs/01_Project_Vision.md)
data/        plots.geojson (958 features, ETL output)
```

## State model
- **`useApp`** (`store.ts`) — UI-only state (selection, filters, camera tokens, lang).
  NOT persisted, NOT synced.
- **`useOverrides`** (`lib/overrides.ts`) — all edits (projects, plotAttrs, landUses,
  merges, splits, comments, audit…). Persisted to `localStorage` **and** synced to
  Firestore. The map source is the **effective collection**
  (`effective.ts`) = base plots + overrides + merges + splits.
- `useAuth`, `useShortlist` — auth status and the compare shortlist.

## Conventions & rules (do not repeat past mistakes)
1. **The plot detail card is VIEW-ONLY.** Never add inline editing to `DetailPanel.tsx`.
   All editing goes through **"Edit attributes"** → `admin/PlotEditor.tsx`.
2. **Fonts: only the `--kec-*` tokens** (`tokens.css`). Never introduce a stray font.
   Inputs/selects/textareas don't inherit font-family by default — the global
   `button,input,select,textarea{font-family:inherit}` rule handles it; keep it.
3. **Apply a display/identity change to EVERY surface, then verify each** — e.g. the
   custom `plotNo` (shown instead of the raw `code`) must render in the map tooltip,
   the on-map label, the card, the factsheet, the editor header, the compare modal,
   the multi-select panel, and the admin table. One fix, all places.
4. **Reports are fixed A4 canvases** (PlotFactsheet portrait, ExecDashboard landscape).
   Content must fit one page with no clipping; charts/legends must stay inside their
   boxes and print in full (no scroll-only legends).
5. **Verify in the browser** (dev server + the preview/browser tools) before committing
   anything previewable; share proof. Don't ask the user to check manually.

## Ship it
Commit to **`main`** and push. `.github/workflows/deploy.yml` **auto-deploys** on push
(GitHub Pages). Keep machines in sync: `git pull` before starting, `git push` after.

End commit messages with:
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
