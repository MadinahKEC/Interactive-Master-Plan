import { LAND_USES, type PlotCollection, type PlotProps, type PlotFeature } from '@kec/types';
import type { ProjectInfo } from './domain';
import type { GeomOverride, LandUseOverride, MergeRecord, PlotAttrOverride } from './overrides';

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
): PlotCollection | null {
  if (!base) return null;
  const hidden = new Set<string>();
  merges.forEach((m) => m.codes.forEach((c) => hidden.add(c)));
  const byCode = new Map(base.features.map((f) => [f.properties.code, f]));

  const features: PlotFeature[] = [];
  for (const f of base.features) {
    if (hidden.has(f.properties.code)) continue;
    let feat = f;
    const patch = attrs[f.properties.code];
    const g = geom[f.properties.code];
    if (patch || g) {
      feat = {
        ...f,
        properties: patch ? ({ ...f.properties, ...patch } as PlotProps) : f.properties,
        geometry: g ? ({ type: g.type, coordinates: g.coordinates } as any) : f.geometry,
      };
    }
    features.push(feat);
  }

  // merged ownership units
  for (const m of merges) {
    const src = m.codes.map((c) => byCode.get(c)).filter(Boolean) as PlotFeature[];
    if (!src.length) continue;
    const polys: any[] = [];
    let area = 0, gfa = 0;
    for (const s of src) {
      polys.push(...toPolygons((geom[s.properties.code] as any) ?? s.geometry));
      area += s.properties.area || 0;
      gfa += s.properties.gfa || 0;
    }
    const first = src[0].properties;
    features.push({
      type: 'Feature',
      properties: {
        code: m.id, name: m.name_ar || m.name_en || m.codes.join('+'),
        land_use: first.land_use, sector: first.sector,
        gfa, area, floors: first.floors, height: first.height,
        coverage: first.coverage, far: first.far, style: null,
      } as PlotProps,
      geometry: { type: 'MultiPolygon', coordinates: polys } as any,
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
