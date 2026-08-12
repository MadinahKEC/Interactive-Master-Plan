# 01 · Project Vision — رؤية المشروع

## The problem
KEC (Knowledge Economic City / مدينة المعرفة الاقتصادية, Medina) manages its entire
master plan — land parcels, land use, massing, infrastructure and projects — inside
**Google Earth**, from a single `GIS KEC.kmz` file. This creates hard limits:

- One desktop tool, no controlled multi-user access, no roles, no audit trail.
- Data locked in a KMZ; no database, no API, no reporting, no dashboards.
- No way to attach documents, media, or investment/project data to a parcel.
- No web presence, no shareable premium master-plan experience for stakeholders.

## The vision
A **premium, Arabic-first, enterprise GIS platform** owned by KEC that becomes the
single source of truth for the master plan and **replaces Google Earth internally**.
Its centerpiece is an interactive master-plan map (ROSHN-grade UX quality, not a copy)
driven directly from the KMZ data — **958 land plots (بلوت)** with full attributes —
wrapped in project management, document management, and executive dashboards.

## Verified data foundation (from `GIS KEC.kmz`)
- **958 plots**, all polygons, WGS84, one folder "GIS KEC".
- Attributes per plot: `code`, `land_use`, `GFA`, `area`, `floors`, `height`,
  `coverage`, `FAR`.
- **17 land-use classes** (560 Low/Med Residential … down to single-plot classes).
- **5 sectors** inferred from code prefix: North (671) · South (109) · Central (97) ·
  East (53) · West (28).
- Extent centred on Medina at **39.679°E, 24.4696°N**; totals ≈ **11.6M m² GFA**,
  **4.9M m² parcel area**.
- Named destinations & delivery status (Completed / Under Construction / Future /
  Partner) come from the KEC Destinations map (Multaqa Almadinah, Al Alyaa I/II, IWD
  I/II, Knowledge Gardens, Business Park, KEC HQ, …).

## Goals
1. A fast, beautiful, RTL interactive master-plan map anyone in KEC can use in a browser.
2. Accurate GIS (real polygons, real coordinates) **and** a premium designed look —
   switchable light/satellite basemaps, 3D massing.
3. Full management of every plot: CRUD, rename, attribute edits, **polygon reshaping**,
   all audited and versioned.
4. Business modules around the map: projects, land, investment opportunities,
   infrastructure, documents, media, reports.
5. Executive dashboards with KPIs, charts and geographic insight.
6. Enterprise foundations: roles/permissions, security, scalability, maintainability
   for a 10-year horizon.

## Non-goals (for now)
- Public consumer portal (internal platform first).
- Real-time field survey / mobile data collection (later phase).
- Financial transactions inside the platform.

## Primary users (personas)
- **Master-plan / GIS planner** — edits parcels, geometry, land use; the power user.
- **Executive / leadership** — dashboards, insight, read + export.
- **Investment / commercial team** — investment opportunities per parcel, documents.
- **Project / infrastructure manager** — project status, infrastructure layers.
- **Administrator** — users, roles, option lists, system settings.
- **Viewer** — read-only map, search, export views.

## Success criteria (V1)
- 100% of the 958 plots load into PostGIS and render on the web map with correct data.
- A planner can find any plot by code, inspect all attributes, and rename/edit it, with
  the change audited.
- Leadership can open a dashboard and read master-plan KPIs by sector and land use.
- The team stops opening Google Earth for day-to-day master-plan lookups.

## Guiding principles
- **Arabic-first, RTL, light theme only, premium and information-dense.**
- **Accuracy + beauty**, never one at the expense of the other.
- **The engine is generic, the data is specific** — configuration over hard-coding.
- **Everything auditable.** Every change to a parcel is who/what/when.
- **Designed for scale** — built in phases (V1 → V2 → V3), each feature scalable.
