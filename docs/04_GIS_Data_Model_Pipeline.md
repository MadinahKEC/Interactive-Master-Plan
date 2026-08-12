# 04 · GIS Data Model & Pipeline — نموذج البيانات الجغرافية والمعالجة

## 4.1 Source: `GIS KEC.kmz`
A KMZ is a ZIP containing `doc.kml`. Verified contents:
- **958 `<Placemark>`**, each with one `<MultiGeometry><Polygon>` (single outer ring;
  no holes observed). WGS84 lon,lat,alt triples in `<coordinates>`.
- One `<Folder>` "GIS KEC"; **17 `<Style>`** entries, colour ↔ land use is 1:1.
- Attributes live inside the `<description>` CDATA as an HTML table with rows:
  `Name, Land Use, GFA, Area, Floors, Height, Coverage, FAR`.

## 4.2 Canonical plot attribute schema

| Field | Type | Source | Example | Notes |
|---|---|---|---|---|
| `code` | string | `<name>` | `S19` | **stable internal ID** |
| `name` | string | curated | `Al Alyaa` | friendly/destination name; defaults to `code` |
| `land_use` | enum(string) | table | `Education` | one of 17 classes (managed list) |
| `sector` | enum | derived | `South` | from `code[0]`: N/S/C/E/W → North/South/Central/East/West |
| `gfa` | number | table | 14946.9 | m² |
| `area` | number | table | 14938.17 | m² (parcel) |
| `floors` | number | table | 3 | |
| `height` | number | table | 25 | m |
| `coverage` | number | table | 0.81 | ratio |
| `far` | number | table | 1 | floor-area ratio |
| `style` | string | `<styleUrl>` | `PolyStyle00` | original KMZ style ref (kept for provenance) |
| `geom` | geometry(MultiPolygon,4326) | `<coordinates>` | | stored in PostGIS |

### Land-use catalogue (17) with counts
Low/Med Density Residential (560) · High Density Residential & Commercial (109) ·
High Density Mixed-Use (80) · Open Space (72) · Utilities (28) · Community Facilities
(20) · Education (19) · Medium Density Residential (18) · Hospitality (15) · Commercial
(12) · Medium Density Mixed-Use (7) · Medical (7) · Low/Med Density Residential &
Commercial (6) · Cultural & Commercial (2) · Offices (1) · Medium Density Residential &
Commercial (1) · Train station and reservation (1).

Each class carries a display colour and an Arabic label; both are editable in the admin
option list (see `packages/types` land-use enum and the map legend).

## 4.3 ETL pipeline

```
GIS KEC.kmz ──▶ [1] extract doc.kml
            ──▶ [2] parse Placemarks (attrs + geometry)
            ──▶ [3] normalise (decode HTML entities, numeric coercion, derive sector)
            ──▶ [4a] emit data/plots.geojson   (frontend / preview / QA)
            ──▶ [4b] load into PostGIS plots    (production seed)
```

- **[1–4a] implemented & verified:** `scripts/etl/kml-to-geojson.ps1` (Windows-native,
  no Node/Python). Output `data/plots.geojson` — **958 features, 17 land uses**, S19/E35
  spot-checked against the KMZ, bbox `lon[39.65693,39.70106] lat[24.45448,24.48469]`,
  centre `39.678995,24.469588`.
- **[4b] production loader:** `scripts/etl/load-postgis.*` uses GDAL `ogr2ogr` (or a
  Node loader) to insert `data/plots.geojson` into `plots`, computing `geom` and
  validating with `ST_MakeValid`. Idempotent upsert keyed on `code`.

Re-running is safe: re-parse from the KMZ, upsert by `code`; existing edits are preserved
by only overwriting source-derived fields on an explicit `--reseed` flag.

## 4.4 Coordinate systems
- Storage & API: **EPSG:4326** (WGS84 lon/lat).
- Tiles & rendering: **EPSG:3857** (Web Mercator) via Martin `ST_AsMVT`/`ST_TileEnvelope`.
- Area/length measurement: computed with `geography` casts for metric accuracy.

## 4.5 Vector tiles (Martin)
Martin publishes a `plots` function/table source producing MVT with the attribute
columns above. MapLibre style layers (`plots-fill`, `plots-line`, `plots-3d`,
`plots-label`) consume it. Selecting/editing a plot invalidates the affected tile cache
(ETag bump) so edits appear without a full reload.

## 4.6 Import / export (V2)
- **In:** GeoJSON, KML, KMZ, Shapefile → validated → staged → merged (GDAL/ogr2ogr).
- **Out:** current/filtered view as GeoJSON, KML, KMZ, Shapefile, and print PDF.

## 4.7 Data quality rules
- `code` unique and non-null; `land_use` ∈ catalogue; numerics ≥ 0.
- `ST_IsValid(geom)` true (auto-`ST_MakeValid` on load); ring closed.
- Orphan check: every plot resolves to a sector; unknown prefixes → `Other`.
