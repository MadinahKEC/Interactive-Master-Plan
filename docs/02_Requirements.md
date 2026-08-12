# 02 · Requirements — المتطلبات الوظيفية وغير الوظيفية

Priority key: **[V1]** ship now · **[V2]** next · **[V3]** later.

## A. Functional requirements

### A1 · Interactive map
- **[V1]** Render all 958 plots as accurate polygons over a basemap.
- **[V1]** Colour plots by land use; land-use legend with counts.
- **[V1]** Switch basemap: premium light vector ⇄ satellite imagery.
- **[V1]** 3D massing mode via building extrusion (height, fallback floors×3 m).
- **[V1]** Click a plot → detail panel (RTL) with all attributes.
- **[V1]** Hover highlight + quick tooltip (code + land use).
- **[V1]** Filter by land use and by sector; live KPI recompute.
- **[V1]** Search by plot code; fly-to and select the match.
- **[V1]** Reset view; fit-to-extent; zoom/compass/scale controls.
- **[V2]** Destinations/projects layer with delivery-status colouring.
- **[V2]** Distance & area measurement; coordinate readout.
- **[V2]** Bookmarks (saved views); map print/export (PNG + PDF).
- **[V2]** Clustering / heat maps for point overlays; label toggle (code ⇄ name).
- **[V3]** 3D globe/terrain (Cesium/deck.gl); timeline; comparison (split) mode.

### A2 · Plot & land management
- **[V1]** View plot attributes; edit attributes (land use, floors, height, …).
- **[V1]** Rename a plot (code → friendly/destination name); code stays the stable ID.
- **[V1]** Every change audited (who / what / old→new / when) and versioned.
- **[V2]** Draw new plots; **reshape existing polygons** (geometry editing) with history.
- **[V2]** Bulk edit; import/export GeoJSON / KML / KMZ / Shapefile.
- **[V2]** Associate plots ↔ destinations, projects, investment opportunities.

### A3 · Business modules
- **[V2]** Projects: status, timeline, linked plots.
- **[V2]** Investment opportunities: per-parcel, status, value, documents.
- **[V2]** Infrastructure: roads, utilities layers.
- **[V2]** Documents & media library: upload, tag, link to plots/projects.
- **[V2]** Reports: generate/print master-plan and project reports (PDF).

### A4 · Dashboard & analytics
- **[V1]** KPI cards (plots, GFA, area, land-use count) and land-use / sector charts.
- **[V2]** Status distribution, investment pipeline, project progress; map-linked drill-down.
- **[V3]** Advanced spatial analytics; saved analytical views.

### A5 · Administration
- **[V1]** Manage land-use option list & colours; app settings.
- **[V2]** Users & roles; permissions; audit-log viewer; option lists; notifications.
- **[V2]** Manage destinations, sectors, layers, legend.

### A6 · Auth & access
- **[V1]** Sign-in; role-gated UI (Administrator / Editor / Contributor / Viewer).
- **[V2]** SSO/OIDC (Keycloak); fine-grained permissions; session policies.

## B. Non-functional requirements

| Area | Requirement |
|---|---|
| **Performance** | Map first paint < 2 s on office LAN; smooth pan/zoom at 958→10k polygons via vector tiles; API p95 < 300 ms. |
| **Scalability** | Data model & tiles scale to tens of thousands of features and multiple layers without redesign. |
| **Availability** | Target 99.5% internal; stateless API horizontally scalable behind a load balancer. |
| **Security** | RBAC on every mutation; audit trail immutable; TLS everywhere; least-privilege DB roles; input validation; OWASP Top-10 hardening. |
| **Localization** | Arabic-first, full RTL, Hijri/Gregorian dates where relevant; English fallback for technical fields. |
| **Accessibility** | WCAG 2.1 AA: contrast, keyboard nav, focus states, ARIA on controls. |
| **Usability** | Premium, minimal, high-density; consistent KEC design system. |
| **Maintainability** | Typed end-to-end (TypeScript); modular; documented; conventional commits; ≥ 70% coverage on core logic. |
| **Portability** | Self-hostable; no proprietary cloud lock-in; open GIS stack. |
| **Observability** | Structured logs, metrics, traces, error tracking. |
| **Data integrity** | All geometries valid (`ST_IsValid`); referential integrity; versioned edits; nightly backups. |
| **Browser support** | Latest Chrome/Edge/Firefox/Safari; desktop-first, responsive down to tablet. |

## C. Constraints & assumptions
- Source of truth is `GIS KEC.kmz`; the platform is seeded from it via ETL and then
  owns the data.
- Coordinates are WGS84 (EPSG:4326), stored in PostGIS, served as MVT in EPSG:3857.
- Sectors are derived from the code prefix (N/S/C/E/W) — to be confirmed by KEC.
- Friendly names are curated in-app from the Destinations map; codes remain internal IDs.
- Light theme only; no dark mode.
