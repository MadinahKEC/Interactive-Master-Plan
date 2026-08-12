-- KEC GIS Platform — authoritative schema + seeds + tile function.
-- Applied automatically by PostGIS on first container start.
-- See docs/05_Database_Design.md.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------- Option lists ----------
CREATE TABLE IF NOT EXISTS land_uses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  key text UNIQUE NOT NULL,
  label_ar text NOT NULL,
  color text NOT NULL,
  sort_order int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sectors (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  key text UNIQUE NOT NULL,
  label_ar text NOT NULL,
  prefix char(1)
);

CREATE TABLE IF NOT EXISTS statuses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  key text UNIQUE NOT NULL,
  label_ar text NOT NULL,
  color text NOT NULL
);

CREATE TABLE IF NOT EXISTS destinations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_ar text NOT NULL,
  name_en text,
  status_id uuid REFERENCES statuses(id),
  centroid geometry(Point, 4326),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---------- Plots (958) ----------
CREATE TABLE IF NOT EXISTS plots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text UNIQUE NOT NULL,
  name text,
  land_use_id uuid REFERENCES land_uses(id),
  sector_id uuid REFERENCES sectors(id),
  destination_id uuid REFERENCES destinations(id),
  status_id uuid REFERENCES statuses(id),
  gfa numeric, area numeric, floors int, height numeric, coverage numeric, far numeric,
  source_style text,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid, updated_by uuid
);
CREATE INDEX IF NOT EXISTS plots_geom_gix ON plots USING GIST (geom);
CREATE INDEX IF NOT EXISTS plots_code_trgm ON plots USING GIN (code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS plots_land_use_ix ON plots (land_use_id);
CREATE INDEX IF NOT EXISTS plots_sector_ix ON plots (sector_id);

CREATE TABLE IF NOT EXISTS plot_versions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  plot_id uuid REFERENCES plots(id) ON DELETE CASCADE,
  version int NOT NULL,
  snapshot jsonb NOT NULL,
  geom geometry(MultiPolygon, 4326),
  changed_by uuid,
  changed_at timestamptz DEFAULT now(),
  reason text
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'viewer',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  actor_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  before jsonb,
  after jsonb,
  at timestamptz DEFAULT now(),
  ip inet
);
CREATE INDEX IF NOT EXISTS audit_entity_ix ON audit_log (entity, entity_id, at DESC);

-- Raw import staging table for the GDAL loader
CREATE TABLE IF NOT EXISTS plots_import (
  code text, name text, land_use text, sector text,
  gfa numeric, area numeric, floors numeric, height numeric,
  coverage numeric, far numeric, style text,
  geom geometry(Geometry, 4326)
);

-- ---------- Seeds ----------
INSERT INTO sectors (key, label_ar, prefix) VALUES
  ('North','شمال','N'),('South','جنوب','S'),('Central','وسط','C'),
  ('East','شرق','E'),('West','غرب','W'),('Other','أخرى','?')
ON CONFLICT (key) DO NOTHING;

INSERT INTO statuses (key, label_ar, color) VALUES
  ('Completed','مكتمل','#2F6B3E'),
  ('UnderConstruction','تحت الإنشاء','#9A8A1E'),
  ('Future','مستقبلي','#5C6B60'),
  ('Partner','مشاريع شركاء','#7E6F1B')
ON CONFLICT (key) DO NOTHING;

INSERT INTO land_uses (key, label_ar, color, sort_order) VALUES
  ('Low/Med Density Residential','سكني منخفض/متوسط الكثافة','#F2D8A7',1),
  ('Medium Density Residential','سكني متوسط الكثافة','#E9C583',2),
  ('High Density Residential & Commercial','سكني تجاري عالي الكثافة','#E39A54',3),
  ('Low/Med Density Residential & Commercial','سكني تجاري منخفض/متوسط','#EDC58C',4),
  ('Medium Density Residential & Commercial','سكني تجاري متوسط الكثافة','#E3B36B',5),
  ('High Density Mixed-Use','استخدام مختلط عالي الكثافة','#D97E4E',6),
  ('Medium Density Mixed-Use','استخدام مختلط متوسط','#E0A277',7),
  ('Commercial','تجاري','#C85C4E',8),
  ('Cultural & Commercial','ثقافي وتجاري','#B5588F',9),
  ('Offices','مكاتب','#8A6D4F',10),
  ('Hospitality','ضيافة','#9C6BB0',11),
  ('Medical','طبي','#D06B84',12),
  ('Education','تعليمي','#5B8FB0',13),
  ('Community Facilities','مرافق مجتمعية','#4FA5A0',14),
  ('Open Space','مساحات مفتوحة','#88BF6A',15),
  ('Utilities','مرافق وبنية تحتية','#9AA0A6',16),
  ('Train station and reservation','محطة قطار ومحمية','#6D7B8A',17)
ON CONFLICT (key) DO NOTHING;

-- ---------- Vector-tile function (Martin) ----------
CREATE OR REPLACE FUNCTION plots_mvt(z integer, x integer, y integer)
RETURNS bytea AS $$
  WITH bounds AS (SELECT ST_TileEnvelope(z, x, y) AS env),
  mvtgeom AS (
    SELECT ST_AsMVTGeom(ST_Transform(p.geom, 3857), (SELECT env FROM bounds)) AS geom,
           p.code, COALESCE(p.name, p.code) AS name,
           lu.key AS land_use, s.key AS sector,
           p.gfa, p.area, p.floors, p.height, p.coverage, p.far
    FROM plots p
    LEFT JOIN land_uses lu ON lu.id = p.land_use_id
    LEFT JOIN sectors s ON s.id = p.sector_id
    WHERE ST_Transform(p.geom, 3857) && (SELECT env FROM bounds)
  )
  SELECT ST_AsMVT(mvtgeom, 'plots') FROM mvtgeom;
$$ LANGUAGE sql STABLE PARALLEL SAFE;
