# 05 · Database Design — تصميم قاعدة البيانات (PostgreSQL + PostGIS)

## 5.1 Principles
- PostGIS is the spatial **source of truth**. Every mutation is transactional and audited.
- Source-derived fields (from the KMZ) are preserved; curated fields (name, links) layer
  on top. Geometry and attribute history are versioned.
- UUID primary keys; `created_at`/`updated_at`/`created_by`/`updated_by` on core tables.

## 5.2 Core schema (DDL sketch)

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Managed land-use catalogue (17 seeded, admin-extendable)
CREATE TABLE land_uses (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         text UNIQUE NOT NULL,        -- 'Education'
  label_ar    text NOT NULL,               -- 'تعليمي'
  color       text NOT NULL,               -- '#5B8FB0'
  sort_order  int  DEFAULT 0
);

-- Sectors (N/S/C/E/W, extendable)
CREATE TABLE sectors (
  id       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  key      text UNIQUE NOT NULL,           -- 'South'
  label_ar text NOT NULL,                  -- 'جنوب'
  prefix   char(1)                         -- 'S'
);

-- Delivery-status vocabulary (Completed / Under Construction / Future / Partner)
CREATE TABLE statuses (
  id       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  key      text UNIQUE NOT NULL,
  label_ar text NOT NULL,
  color    text NOT NULL
);

-- Named destinations / projects (from the KEC Destinations map)
CREATE TABLE destinations (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_ar    text NOT NULL,
  name_en    text,
  status_id  uuid REFERENCES statuses(id),
  centroid   geometry(Point,4326),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- The 958 plots (بلوت)
CREATE TABLE plots (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code         text UNIQUE NOT NULL,               -- 'S19' (stable ID)
  name         text,                               -- friendly name (defaults to code)
  land_use_id  uuid REFERENCES land_uses(id),
  sector_id    uuid REFERENCES sectors(id),
  destination_id uuid REFERENCES destinations(id),
  status_id    uuid REFERENCES statuses(id),
  gfa          numeric,
  area         numeric,
  floors       int,
  height       numeric,
  coverage     numeric,
  far          numeric,
  source_style text,                               -- KMZ provenance
  geom         geometry(MultiPolygon,4326) NOT NULL,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  created_by   uuid,
  updated_by   uuid
);
CREATE INDEX plots_geom_gix ON plots USING GIST (geom);
CREATE INDEX plots_code_trgm ON plots USING GIN (code gin_trgm_ops);
CREATE INDEX plots_land_use_ix ON plots (land_use_id);
CREATE INDEX plots_sector_ix ON plots (sector_id);

-- Full attribute+geometry version history
CREATE TABLE plot_versions (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  plot_id    uuid REFERENCES plots(id) ON DELETE CASCADE,
  version    int NOT NULL,
  snapshot   jsonb NOT NULL,                       -- full attributes
  geom       geometry(MultiPolygon,4326),
  changed_by uuid,
  changed_at timestamptz DEFAULT now(),
  reason     text
);

-- Documents & media (V2) stored in MinIO, referenced here
CREATE TABLE documents (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       text NOT NULL,
  kind        text,                                -- doc | image | video | dwg | pdf
  storage_key text NOT NULL,                       -- MinIO object key
  mime        text,
  size_bytes  bigint,
  plot_id     uuid REFERENCES plots(id),
  destination_id uuid REFERENCES destinations(id),
  uploaded_by uuid,
  created_at  timestamptz DEFAULT now()
);

-- Investment opportunities (V2)
CREATE TABLE opportunities (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       text NOT NULL,
  plot_id     uuid REFERENCES plots(id),
  status_id   uuid REFERENCES statuses(id),
  value       numeric,
  currency    text DEFAULT 'SAR',
  details     jsonb,
  created_at  timestamptz DEFAULT now()
);

-- Saved map views
CREATE TABLE bookmarks (
  id       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id  uuid NOT NULL,
  name     text NOT NULL,
  view     jsonb NOT NULL,                         -- center/zoom/pitch/filters
  created_at timestamptz DEFAULT now()
);

-- Identity (mirrors Keycloak; or primary in V1)
CREATE TABLE users (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email      text UNIQUE NOT NULL,
  full_name  text,
  role       text NOT NULL DEFAULT 'viewer',       -- administrator|editor|contributor|viewer
  is_active  boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Immutable audit trail
CREATE TABLE audit_log (
  id         bigserial PRIMARY KEY,
  actor_id   uuid,
  action     text NOT NULL,                        -- plot.update | plot.rename | geom.edit | ...
  entity     text NOT NULL,                        -- 'plot'
  entity_id  uuid,
  before     jsonb,
  after      jsonb,
  at         timestamptz DEFAULT now(),
  ip         inet
);
CREATE INDEX audit_entity_ix ON audit_log (entity, entity_id, at DESC);
```

## 5.3 Tile source (Martin)
```sql
-- Function source: returns MVT for the plots layer within a tile
CREATE OR REPLACE FUNCTION plots_mvt(z int, x int, y int)
RETURNS bytea AS $$
  WITH bounds AS (SELECT ST_TileEnvelope(z,x,y) AS env),
  mvtgeom AS (
    SELECT ST_AsMVTGeom(ST_Transform(p.geom,3857),(SELECT env FROM bounds)) AS geom,
           p.code, p.name, lu.key AS land_use, s.key AS sector,
           p.gfa, p.area, p.floors, p.height, p.coverage, p.far
    FROM plots p
    LEFT JOIN land_uses lu ON lu.id=p.land_use_id
    LEFT JOIN sectors  s  ON s.id=p.sector_id
    WHERE ST_Transform(p.geom,3857) && (SELECT env FROM bounds)
  )
  SELECT ST_AsMVT(mvtgeom,'plots') FROM mvtgeom;
$$ LANGUAGE sql STABLE PARALLEL SAFE;
```

## 5.4 Integrity & operations
- `plots.geom` GIST-indexed; `code` GIN-trigram-indexed for fuzzy search.
- Mutations run in one transaction: update `plots` + insert `plot_versions` + `audit_log`.
- `ST_MakeValid` on insert/edit; check constraints keep numerics ≥ 0.
- Nightly `pg_dump` backups; PITR via WAL archiving in production.
- Least-privilege DB roles: `app_rw` (API), `tiles_ro` (Martin), `migrator` (CI).
