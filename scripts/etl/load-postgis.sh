#!/bin/sh
# Load data/plots.geojson into PostGIS.
# Runs inside the GDAL container (see infra/docker-compose.yml "loader" service).
# Idempotent: truncates staging, re-imports, then upserts into plots by code.
set -e

GEOJSON="${GEOJSON:-/work/data/plots.geojson}"
echo "Loading $GEOJSON into PostGIS ($PGHOST/$PGDATABASE)…"

# 1) Import raw features into the staging table (geometry + attributes).
ogr2ogr -f PostgreSQL \
  "PG:host=$PGHOST port=$PGPORT dbname=$PGDATABASE user=$PGUSER password=$PGPASSWORD" \
  "$GEOJSON" \
  -nln plots_import -overwrite \
  -lco GEOMETRY_NAME=geom -lco FID=fid \
  -nlt PROMOTE_TO_MULTI -t_srs EPSG:4326

# 2) Upsert staging -> plots, resolving land_use/sector keys to ids, validating geometry.
psql "host=$PGHOST port=$PGPORT dbname=$PGDATABASE user=$PGUSER password=$PGPASSWORD" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO plots (code, name, land_use_id, sector_id, gfa, area, floors, height, coverage, far, source_style, geom)
SELECT
  i.code,
  COALESCE(i.name, i.code),
  lu.id,
  s.id,
  i.gfa, i.area, NULLIF(i.floors,NULL)::int, i.height, i.coverage, i.far,
  i.style,
  ST_Multi(ST_MakeValid(i.geom))
FROM plots_import i
LEFT JOIN land_uses lu ON lu.key = i.land_use
LEFT JOIN sectors  s  ON s.key  = i.sector
ON CONFLICT (code) DO UPDATE SET
  land_use_id = EXCLUDED.land_use_id,
  sector_id   = EXCLUDED.sector_id,
  gfa = EXCLUDED.gfa, area = EXCLUDED.area, floors = EXCLUDED.floors,
  height = EXCLUDED.height, coverage = EXCLUDED.coverage, far = EXCLUDED.far,
  source_style = EXCLUDED.source_style,
  geom = EXCLUDED.geom,
  updated_at = now();

SELECT count(*) AS plots_loaded FROM plots;
SELECT count(*) AS invalid_geom FROM plots WHERE NOT ST_IsValid(geom);
SQL

echo "Done."
