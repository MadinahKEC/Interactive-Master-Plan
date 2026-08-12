# 09 · Roadmap & Phases — خارطة الطريق

Three phases. Each ships a coherent, usable increment; every feature is built to scale.

## Version 1 — "See & manage the master plan" (foundation)
**Goal:** replace day-to-day Google Earth lookups with a fast, premium, RTL web map of the
958 plots, plus basic management and dashboards.

Epics & acceptance:
1. **ETL & data** — 958 plots in PostGIS, geometries valid, S19/E35 verified. *(GeoJSON
   pipeline done; PostGIS loader next.)*
2. **Interactive map** — accurate polygons, land-use colour, legend/sector filter, code
   search, light+satellite basemap, 3D extrusion, inspector. *(Working in the standalone
   preview; port to the React app.)*
3. **Plot management (basic)** — edit attributes + rename, audited & versioned.
4. **Dashboard v1** — KPI cards + land-use/sector charts.
5. **Admin (option lists)** — land uses/colours, sectors, statuses, settings.
6. **AuthN/Z** — sign-in + 4 roles enforced server-side.
7. **Ops** — `docker compose up` brings up web/api/postgis/martin/redis/minio; CI green.

**Done when:** a planner finds, inspects and renames any plot (audited); leadership reads
sector/land-use KPIs; the team stops opening Google Earth for lookups.

## Version 2 — "Operate the platform" (breadth & depth)
**Goal:** full management, business modules, and a luxurious admin console.

- **Geometry editing:** draw/reshape polygons with version history.
- **Full admin console:** users & roles, permissions, audit viewer, destinations/layers,
  import/export center.
- **Business modules:** documents & media, investment opportunities, infrastructure
  layers, destinations/projects with status.
- **Map tools:** measurement, coordinates, bookmarks, print/export, clustering/heatmaps,
  label mode, comparison groundwork.
- **Import/Export:** GeoJSON/KML/KMZ/Shapefile in & out.
- **Dashboards:** status, pipeline, project progress; PDF export.
- **Platform:** Keycloak SSO/MFA, OpenSearch, background jobs (BullMQ), CDN for tiles.

**Done when:** KEC manages the entire master plan (data, geometry, documents, projects)
in-platform with roles and audit; imports/exports round-trip cleanly.

## Version 3 — "Scale & intelligence"
**Goal:** enterprise scale, 3D/immersive, analytics.

- **3D globe/terrain** (Cesium/deck.gl), true massing at city scale.
- **Timeline** (phasing over time) and **comparison/split** mode.
- **Advanced spatial analytics** (proximity, coverage, suitability), saved analytical views.
- **Notifications** and workflow (assignments, approvals for edits).
- **Kubernetes** scale-out, replicated Postgres, multi-environment CD.

**Done when:** the platform is the authoritative, scalable GIS system of record for KEC —
Google Earth fully retired.

## Sequencing notes
- V1 is deliberately narrow and deep on the map — it is what earns adoption.
- Geometry editing (V2) depends on the audit/versioning foundation laid in V1.
- SSO can arrive in V2; V1 may ship with local auth to avoid blocking.
