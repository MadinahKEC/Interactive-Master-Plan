import { area } from '@turf/area';
import { bbox } from '@turf/bbox';
import { bboxClip } from '@turf/bbox-clip';

/**
 * Split a plot polygon into N pieces whose areas are proportional to `targets`.
 * The pieces tile the parent exactly and stay within its real shape (via bbox-clip
 * along the longer axis + binary search for each cut). Absolute areas won't match the
 * source document (the parent may differ), but the proportions and total do.
 */
export function splitPolygon(geom: any, targets: number[]): any[] {
  const feat: any = { type: 'Feature', properties: {}, geometry: geom };
  const [minX, minY, maxX, maxY] = bbox(feat);
  const horizontal = maxX - minX >= maxY - minY; // cut along X when wider than tall
  const total = area(feat);
  const sum = targets.reduce((a, b) => a + b, 0) || 1;
  const fracs = targets.map((t) => t / sum);

  const clip = (lo: number, hi: number): any => {
    const box = horizontal ? [lo, minY, hi, maxY] : [minX, lo, maxX, hi];
    return bboxClip(feat, box as [number, number, number, number]);
  };
  const start = horizontal ? minX : minY;
  const end = horizontal ? maxX : maxY;
  const areaUpTo = (cut: number) => area(clip(start, cut));

  const out: any[] = [];
  let prev = start;
  let cum = 0;
  for (let i = 0; i < targets.length; i++) {
    cum += fracs[i];
    let cut: number;
    if (i === targets.length - 1) {
      cut = end;
    } else {
      const targetArea = cum * total;
      let lo = prev, hi = end;
      for (let it = 0; it < 30; it++) {
        const mid = (lo + hi) / 2;
        if (areaUpTo(mid) < targetArea) lo = mid; else hi = mid;
      }
      cut = (lo + hi) / 2;
    }
    out.push(clip(prev, cut).geometry);
    prev = cut;
  }
  return out;
}

/** Actual area (m²) of a polygon geometry. */
export function geomArea(geom: any): number {
  return area({ type: 'Feature', properties: {}, geometry: geom } as any);
}
