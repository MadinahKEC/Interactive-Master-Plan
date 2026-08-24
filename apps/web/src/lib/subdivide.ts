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

// ---- Multaqa Park Side layout (plot C36-1) --------------------------------
// Partition the WHOLE plot into the five Multaqa uses so they fill C36-1 completely
// (no wasted land): Retail & Office is a strip along the boulevard; the central park
// sits in the middle directly behind it; the three residential plots fill the rest —
// west, centre-back and east. Cuts run along the boulevard axis U and its inward
// normal N, each sized so the pieces are proportional to the document's plot areas.
const MULTAQA_AREAS: Record<string, number> = { west: 16737, centre: 21133, east: 21783, park: 8423, retail: 32390 };

function polyAreaM(p: number[][]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; a += x1 * y2 - x2 * y1; }
  return Math.abs(a) / 2;
}
// Clip polygon to the half-plane a*x + b*y <= c (Sutherland–Hodgman).
function halfClip(p: number[][], a: number, b: number, c: number): number[][] {
  const out: number[][] = []; const n = p.length;
  for (let i = 0; i < n; i++) {
    const A = p[i], B = p[(i + 1) % n];
    const da = a * A[0] + b * A[1] - c, db = a * B[0] + b * B[1] - c;
    const inA = da <= 1e-9, inB = db <= 1e-9;
    if (inA) out.push(A);
    if (inA !== inB) { const t = da / (da - db); out.push([A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1])]); }
  }
  return out;
}
// Slide a cut with normal (a,b) until the kept side reaches `target` area.
function cutByArea(p: number[][], a: number, b: number, target: number) {
  let lo = Infinity, hi = -Infinity;
  for (const v of p) { const d = a * v[0] + b * v[1]; if (d < lo) lo = d; if (d > hi) hi = d; }
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    const piece = halfClip(p, a, b, mid);
    const ar = piece.length >= 3 ? polyAreaM(piece) : 0;
    if (ar < target) lo = mid; else hi = mid;
  }
  const c = (lo + hi) / 2;
  return { keep: halfClip(p, a, b, c), rest: halfClip(p, -a, -b, -c) };
}

/**
 * Build the five Multaqa sub-plot geometries that tile C36-1 completely. `_targets`
 * is accepted for signature parity with splitPolygon but the split is fixed by the
 * plan. Returned order matches the preset: [West, Centre, East, Park, Retail].
 */
export function multaqaSubdivision(geom: any, _targets?: number[]): any[] {
  const ring0: number[][] = geom.coordinates[0].slice(0, -1);
  let minx = Infinity, miny = Infinity, sumLat = 0;
  for (const [x, y] of ring0) { if (x < minx) minx = x; if (y < miny) miny = y; sumLat += y; }
  const kx = 111320 * Math.cos(((sumLat / ring0.length) * Math.PI) / 180), ky = 110574;
  const poly = ring0.map(([x, y]) => [(x - minx) * kx, (y - miny) * ky]);
  const toLL = ([X, Y]: number[]): number[] => [minx + X / kx, miny + Y / ky];

  // Boulevard axis U = southern-most → eastern-most vertex; N = inward normal.
  let S = poly[0], E = poly[0];
  for (const v of poly) { if (v[1] < S[1]) S = v; if (v[0] > E[0]) E = v; }
  let ux = E[0] - S[0], uy = E[1] - S[1]; const L = Math.hypot(ux, uy) || 1; ux /= L; uy /= L;
  let nx = -uy, ny = ux;
  const cen = poly.reduce((s, v) => [s[0] + v[0] / poly.length, s[1] + v[1] / poly.length], [0, 0]);
  if (nx * (cen[0] - S[0]) + ny * (cen[1] - S[1]) < 0) { nx = -nx; ny = -ny; }

  const PA = polyAreaM(poly);
  const A = MULTAQA_AREAS;
  const sum = A.west + A.centre + A.east + A.park + A.retail;
  const tg = (k: string) => (A[k] / sum) * PA;

  const r1 = cutByArea(poly, nx, ny, tg('retail')); const retail = r1.keep;      // front strip
  const r2 = cutByArea(r1.rest, ux, uy, tg('west')); const west = r2.keep;       // west block
  const r3 = cutByArea(r2.rest, -ux, -uy, tg('east')); const east = r3.keep;     // east block
  const r4 = cutByArea(r3.rest, nx, ny, tg('park')); const park = r4.keep;       // central park (front of centre column)
  const centre = r4.rest;                                                        // central residential (behind park)

  const close = (pc: number[][]): any => {
    const r = pc.map(toLL);
    if (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])) r.push(r[0]);
    return { type: 'Polygon', coordinates: [r] };
  };
  return [close(west), close(centre), close(east), close(park), close(retail)];
}
