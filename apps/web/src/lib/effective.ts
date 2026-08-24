import { LAND_USES, type PlotCollection, type PlotProps, type PlotFeature } from '@kec/types';
import type { ProjectInfo } from './domain';
import type { CreatedPlot, GeomOverride, LandUseOverride, MergeRecord, PlotAttrOverride, SubPlotRecord } from './overrides';

export interface EffLandUse { key: string; labelAr: string; labelEn: string; color: string }

/** Base land-use catalogue merged with admin colour/label overrides. */
export function effectiveLandUses(over: Record<string, LandUseOverride>): Record<string, EffLandUse> {
  const out: Record<string, EffLandUse> = {};
  for (const key of Object.keys(LAND_USES)) {
    const base = LAND_USES[key];
    const o = over[key] ?? {};
    out[key] = { key, labelAr: o.labelAr ?? base.labelAr, labelEn: o.labelEn ?? key, color: o.color ?? base.color };
  }
  return out;
}

/** Flatten any polygonal geometry to a list of polygon coordinate arrays. */
function toPolygons(geom: any): any[] {
  if (!geom) return [];
  return geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates];
}

/**
 * Build the effective GeoJSON: base + attribute overrides + geometry overrides + merges.
 * Merges hide their source plots and add one combined MultiPolygon ownership unit.
 */
export function effectiveCollection(
  base: PlotCollection | null,
  attrs: Record<string, PlotAttrOverride>,
  geom: Record<string, GeomOverride>,
  merges: MergeRecord[],
  projects: Record<string, ProjectInfo> = {},
  splits: Record<string, SubPlotRecord[]> = {},
  created: Record<string, CreatedPlot> = {},
): PlotCollection | null {
  if (!base) return null;
  const hidden = new Set<string>();
  merges.forEach((m) => m.codes.forEach((c) => hidden.add(c)));
  Object.keys(splits).forEach((parent) => hidden.add(parent));
  const byCode = new Map(base.features.map((f) => [f.properties.code, f]));
  const planStatusOf = (code: string): string | undefined => {
    const p = projects[code];
    return p && (p.phases?.length ?? 0) > 0 ? (p.status ?? 'Future') : undefined;
  };

  const features: PlotFeature[] = [];

  // 1) sub-plot features (from splits), with attribute + geometry overrides applied.
  //    Built first and indexed so they can also feed merges (an investor buying
  //    several adjacent sub-plots), not just render on their own.
  const subFeatures: PlotFeature[] = [];
  const subByCode = new Map<string, PlotFeature>();
  for (const parent of Object.keys(splits)) {
    const sector = byCode.get(parent)?.properties.sector ?? 'Other';
    for (const part of splits[parent]) {
      const ps = planStatusOf(part.code);
      const patch = attrs[part.code];
      const g = geom[part.code];
      const feat: PlotFeature = {
        type: 'Feature',
        properties: {
          code: part.code, name: part.name_en || part.name_ar || part.code,
          land_use: part.land_use, sector,
          gfa: part.gfa ?? null, area: part.area ?? null, floors: part.floors ?? null,
          height: part.height ?? null, coverage: part.coverage ?? null, far: part.far ?? null, style: null,
          ...(patch ?? {}),
          ...(ps ? { planStatus: ps } : {}),
        } as PlotProps,
        geometry: g ? ({ type: g.type, coordinates: g.coordinates } as any) : (part.geometry as any),
      };
      subFeatures.push(feat);
      subByCode.set(part.code, feat);
    }
  }

  // 2) base plots (skip merged / subdivided-parent).
  for (const f of base.features) {
    if (hidden.has(f.properties.code)) continue;
    const patch = attrs[f.properties.code];
    const g = geom[f.properties.code];
    const ps = planStatusOf(f.properties.code);
    let feat = f;
    if (patch || g || ps) {
      feat = {
        ...f,
        properties: { ...f.properties, ...(patch ?? {}), ...(ps ? { planStatus: ps } : {}) } as PlotProps,
        geometry: g ? ({ type: g.type, coordinates: g.coordinates } as any) : f.geometry,
      };
    }
    features.push(feat);
  }

  // 3) sub-plots that are not themselves merged away.
  for (const f of subFeatures) if (!hidden.has(f.properties.code)) features.push(f);

  // 4) merged ownership units — resolve each code from base OR sub-plots, so a merge
  //    of subdivided pieces becomes a single unit carrying the summed figures.
  const resolve = (c: string): PlotFeature | undefined => byCode.get(c) ?? subByCode.get(c);
  for (const m of merges) {
    const src = m.codes.map(resolve).filter(Boolean) as PlotFeature[];
    if (!src.length) continue;
    const polys: any[] = [];
    let area = 0, gfa = 0;
    for (const s of src) {
      polys.push(...toPolygons((geom[s.properties.code] as any) ?? s.geometry));
      area += s.properties.area || 0;
      gfa += s.properties.gfa || 0;
    }
    const first = src[0].properties;
    const mps = planStatusOf(m.id);
    features.push({
      type: 'Feature',
      properties: {
        code: m.id, name: m.name_ar || m.name_en || m.codes.join('+'),
        land_use: first.land_use, sector: first.sector,
        gfa, area, floors: first.floors, height: first.height,
        coverage: first.coverage, far: first.far, style: null,
        ...(mps ? { planStatus: mps } : {}),
      } as PlotProps,
      geometry: { type: 'MultiPolygon', coordinates: polys } as any,
    });
  }

  // 5) admin-drawn new plots (with their own attribute/geometry overrides).
  for (const code of Object.keys(created)) {
    if (hidden.has(code)) continue;
    const c = created[code];
    const patch = attrs[code];
    const g = geom[code];
    const ps = planStatusOf(code);
    features.push({
      type: 'Feature',
      properties: {
        code, name: c.name_en || c.name_ar || code,
        land_use: c.land_use, sector: c.sector,
        gfa: c.gfa ?? null, area: c.area ?? null, floors: c.floors ?? null,
        height: c.height ?? null, coverage: c.coverage ?? null, far: c.far ?? null, style: null,
        ...(patch ?? {}),
        ...(ps ? { planStatus: ps } : {}),
      } as PlotProps,
      geometry: g ? ({ type: g.type, coordinates: g.coordinates } as any) : (c.geometry as any),
    });
  }

  return { ...base, features };
}

/** Base project overlay merged with admin project overrides. */
export function effectiveProjects(
  base: Record<string, ProjectInfo>, over: Record<string, ProjectInfo>,
): Record<string, ProjectInfo> {
  const out: Record<string, ProjectInfo> = { ...base };
  for (const code of Object.keys(over)) out[code] = { ...base[code], ...over[code] };
  return out;
}
