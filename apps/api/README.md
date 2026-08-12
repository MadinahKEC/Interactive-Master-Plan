# @kec/api — KEC GIS backend (NestJS + PostGIS)

Geometry-aware REST API. Every mutation runs in a transaction and writes both a
`plot_versions` snapshot and an immutable `audit_log` row.

## Run
```bash
cp .env.example .env
npm install
npm run start:dev          # http://localhost:3000/api
```
Requires the PostGIS stack up (see `infra/docker-compose.yml`) and data loaded.

## Auth (V1 vs V2)
- **V1 scaffold:** the caller's role is read from an `x-role` header
  (`administrator | editor | contributor | viewer`); `PermissionGuard` enforces the
  permission each route requires (see `src/common/rbac.ts`).
- **V2:** replace the header with Keycloak/OIDC token validation; the permission map is
  unchanged.

## Endpoints
| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/api/health` | — | DB up + plot count |
| GET | `/api/plots?sector=&land_use=&search=&limit=` | `plot:view` | list attributes |
| GET | `/api/plots/:code` | `plot:view` | one plot |
| GET | `/api/plots/:code/history` | `audit:view` | version history |
| PATCH | `/api/plots/:code` | `plot:attr:update` | edit attributes (audited/versioned) |
| PATCH | `/api/plots/:code/name` | `plot:rename` | rename (audited/versioned) |
| PATCH | `/api/plots/:code/geometry` | `plot:geometry:update` | reshape polygon (audited/versioned) |

### Example
```bash
# rename S19 as an editor
curl -X PATCH http://localhost:3000/api/plots/S19/name \
  -H 'content-type: application/json' -H 'x-role: editor' \
  -d '{"name":"Al Alyaa","reason":"align with destinations map"}'
```

Geometry body is a GeoJSON `Polygon`/`MultiPolygon`; the server validates and stores it
as `MultiPolygon`/4326 via `ST_MakeValid`.
