# 08 · Modules & Features — الوحدات والمزايا

The platform is a set of modules around the map. Each is independently ownable and scales
without touching the others.

## 8.1 Map module (المخطط التفاعلي) — core
- Vector-tile plot layer (fill / outline / label / 3D extrusion), land-use colouring.
- Basemap switcher (light vector ⇄ satellite), 2D/3D toggle, nav/scale/compass.
- Hover tooltip, click-to-inspect, land-use legend filter, sector filter, code search.
- Live KPI strip (count, GFA, area, land-use count) reflecting the active filter.
- **V2:** measurement (distance/area), coordinates, bookmarks, print/export, destinations
  layer, clustering/heatmaps, label mode (code ⇄ name), infrastructure/roads/utilities.
- **V3:** 3D globe/terrain, timeline, split-screen comparison.

## 8.2 Plot & land management (إدارة البلوت والأراضي)
- Inspector shows all attributes; inline/attribute-form editing.
- **Rename** (code → friendly name); reassign land use / sector / destination / status.
- **Geometry editing (V2):** draw new plots, reshape existing polygons (terra-draw),
  vertex add/move/delete; every save snapshots to `plot_versions` + `audit_log`.
- Bulk edit; import/export GeoJSON/KML/KMZ/Shapefile (V2).

## 8.3 Destinations & projects (الوجهات والمشاريع)
- Named destinations from the KEC Destinations map with delivery status
  (Completed / Under Construction / Future / Partner) and status colours.
- Associate plots ↔ destinations/projects; project status & timeline (V2).

## 8.4 Investment opportunities (الفرص الاستثمارية) — V2
- Per-parcel opportunities: title, value, status, linked documents; pipeline view;
  map-linked drill-down from the dashboard.

## 8.5 Infrastructure (البنية التحتية) — V2
- Roads and utilities as additional layers; toggle in the layer control; link to plots.

## 8.6 Documents & media (المستندات والوسائط) — V2
- Upload/tag/link documents & media to plots, destinations, projects; MinIO storage,
  presigned access; preview PDFs/images; DWG/DXF reference (view-only).

## 8.7 Reports (التقارير) — V2
- Server-rendered PDF reports (Puppeteer): master-plan summary, sector sheet, plot sheet,
  project sheet; includes a map snapshot + KPIs + tables, KEC-branded.

## 8.8 Executive dashboard (لوحة القيادة) — V1 core, deepened in V2
- **V1:** KPI cards (total plots, total GFA, developable area, land-use count) and charts:
  land-use mix (donut), GFA by sector (bar), plots by sector. Map-linked.
- **V2:** status distribution, investment pipeline, project progress, top parcels; filters
  cascade to the map; export dashboard to PDF.

## 8.9 Administration (الإدارة) — V1 partial → V2 full
- **V1:** land-use option list & colours, sectors, statuses, app settings.
- **V2:** users & roles, permissions, audit-log viewer, notifications, destinations/layers
  management, import/export center — all in the KEC design system, "luxurious" admin console.

## 8.10 Consolidated feature list (by version)

**V1** — map (2D/3D, light+satellite, land-use colour, legend/sector filter, search,
inspector, KPIs), plot attribute edit + rename (audited/versioned), dashboard v1,
admin option lists, auth + roles, Dockerised stack, ETL seed of 958 plots.

**V2** — geometry editing, full admin console, documents/media, opportunities,
infrastructure layers, destinations layer, measurement/draw tools, bookmarks,
import/export (GeoJSON/KML/KMZ/SHP), reports/print, clustering/heatmaps, deepened
dashboards, Keycloak SSO, OpenSearch.

**V3** — 3D globe/terrain (Cesium/deck.gl), timeline, comparison mode, advanced spatial
analytics, notifications, Kubernetes scale-out.
