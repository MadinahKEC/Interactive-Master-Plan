<div dir="rtl">

# منصة KEC GIS — المخطط العام التفاعلي لمدينة المعرفة الاقتصادية

منصة خرائط جغرافية مؤسسية تحل محل Google Earth داخل الشركة. مصدر البيانات الأولي هو
`GIS KEC.kmz` (**958 بلوت** بمضلعات دقيقة وسمات كاملة).

## ابدأ الآن (بدون أي أدوات)
افتح الملف التالي بالنقر المزدوج في المتصفح — خريطة تفاعلية كاملة بهوية KEC:

**`preview/kec-master-plan.html`**  · (يحتاج اتصال إنترنت لخلفية الخريطة فقط)

يشمل: تلوين حسب الاستخدام، تبديل خلفية فاتح/قمر صناعي، عرض مجسّم 3D، لوحة تفاصيل البلوت،
تصفية حسب القطاع والاستخدام، وبحث بالكود.

</div>

## Repository map
```
docs/       10 focused architecture docs (start at docs/01_Project_Vision.md)
data/       plots.geojson — ETL output (958 features)
scripts/    ETL (KMZ → GeoJSON → PostGIS)
preview/    standalone, self-contained interactive map (open in a browser)
infra/      docker-compose stack (postgis, martin, redis, minio, keycloak, proxy)
apps/web/   React + Vite + MapLibre frontend (production)
apps/api/   NestJS + PostGIS backend (production)
packages/   shared TS types + KEC design-system
```

## Current status
| Piece | State |
|---|---|
| ETL `KMZ → plots.geojson` | ✅ done & verified (958 features; S19/E35 checked) |
| Standalone interactive map | ✅ done & verified (runs with no toolchain) |
| Architecture docs (10) | ✅ done |
| Production web app scaffold | ✅ scaffolded (run with `npm install`) |
| Backend + infra scaffold | ✅ scaffolded (run with Docker) |

> This workstation has **no Node/npm/Docker**, so the production app/backend were written
> but **not run here**. They are standard scaffolds that run on any dev machine with
> Node 20+ and Docker. The ETL and the standalone map work today, as delivered.

## Regenerate the data
```bash
powershell -ExecutionPolicy Bypass -File scripts/etl/kml-to-geojson.ps1 \
  -Kmz "C:\Users\shamdan\Desktop\GIS KEC.kmz" -Out ".\data\plots.geojson"
```

## Run the full stack (on a machine with Node + Docker)
```bash
cd infra && docker compose up -d          # postgis + martin + redis + minio + keycloak
docker compose run --rm loader            # load plots.geojson into PostGIS
cd ../apps/api && npm install && npm run start:dev
cd ../web && npm install && npm run dev    # http://localhost:5173
```

See `docs/10_Project_Structure_Dev_Guidelines.md` for details.
