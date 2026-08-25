/**
 * Investment analysis for a plot: a transparent 0–100 attractiveness score built
 * from weighted real-estate criteria, plus a simplified feasibility (DCF) model
 * that turns investor assumptions into IRR / NPV / ROI / MOIC / payback.
 *
 * The maths is intentionally explainable — every factor and weight is surfaced in
 * the UI so an investor can see *why* a plot scores the way it does.
 */
import type { PlotProps } from '@kec/types';
import type { ProjectInfo, Lang } from './domain';

/** Al-Masjid an-Nabawi — the anchor for the location factor. */
export const HARAM: [number, number] = [39.6112, 24.4672];

export function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371, toR = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toR, dLon = (b[0] - a[0]) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toR) * Math.cos(b[1] * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Rough polygon centroid (average of the outer ring vertices). */
export function centroidOf(geometry: any): [number, number] {
  const ring = geometry?.type === 'Polygon' ? geometry.coordinates[0] : geometry?.coordinates?.[0]?.[0];
  if (!ring || !ring.length) return HARAM;
  let x = 0, y = 0;
  for (const p of ring) { x += p[0]; y += p[1]; }
  return [x / ring.length, y / ring.length];
}

/** Market-demand weight by land use (0–1), reflecting Madinah's pilgrim economy. */
function demandForUse(use: string | null | undefined): number {
  const l = (use ?? '').toLowerCase();
  if (l.includes('hospitality')) return 1;           // hotels near the Haram — highest demand
  if (l.includes('mixed')) return 0.9;
  if (l.includes('commercial')) return 0.85;
  if (l.includes('high density residential')) return 0.8;
  if (l.includes('medical')) return 0.7;
  if (l.includes('residential')) return 0.62;
  if (l.includes('education')) return 0.5;
  if (l.includes('community') || l.includes('cultural')) return 0.45;
  if (l.includes('open space')) return 0.25;
  if (l.includes('utilit')) return 0.2;
  return 0.5;
}

export interface ScoreFactor { key: string; ar: string; en: string; value: number; weight: number }
export interface InvestmentScore { score: number; grade: string; factors: ScoreFactor[] }

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Composite 0–100 investment-attractiveness score with an explainable breakdown. */
export function computeInvestmentScore(p: PlotProps, o: ProjectInfo | undefined, haramKm: number): InvestmentScore {
  const location = clamp01(1 - haramKm / 12);                      // 0 km → 1, 12 km → 0
  const buildability = clamp01((p.far ?? 0) / 3);                  // FAR 3 = full
  const demand = demandForUse(p.land_use);
  const scale = clamp01(Math.log10((p.area ?? 0) + 1) / Math.log10(30000)); // ~30k m² = full
  const own = o?.ownership;
  const availability = own === 'owned' ? 0.1 : own === 'reserved' ? 0.5 : 1; // available = best
  const factors: ScoreFactor[] = [
    { key: 'location',     ar: 'الموقع (القرب من الحرم)', en: 'Location (Haram proximity)', value: Math.round(location * 100), weight: 0.30 },
    { key: 'buildability', ar: 'إمكانية البناء (FAR)',     en: 'Buildability (FAR)',          value: Math.round(buildability * 100), weight: 0.25 },
    { key: 'demand',       ar: 'الطلب على الاستخدام',       en: 'Land-use demand',            value: Math.round(demand * 100), weight: 0.20 },
    { key: 'scale',        ar: 'الحجم والكفاءة',            en: 'Scale',                      value: Math.round(scale * 100), weight: 0.10 },
    { key: 'availability', ar: 'إتاحة الاستثمار',           en: 'Availability',               value: Math.round(availability * 100), weight: 0.15 },
  ];
  const score = Math.round(factors.reduce((s, f) => s + f.value * f.weight, 0));
  const grade = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 35 ? 'D' : 'E';
  return { score, grade, factors };
}

// ---------------- Feasibility (simplified DCF) ----------------
export interface FeasInputs {
  gsa: number;              // gross saleable area (m²)
  salePrice: number;        // sale price per m² (SAR)
  buildCost: number;        // construction cost per m² (SAR)
  landCost: number;         // land cost (SAR, lump sum at t0)
  softPct: number;          // soft costs as % of build cost
  devMonths: number;        // construction period (months)
  salesMonths: number;      // period over which revenue is realised (months)
  discount: number;         // annual discount rate (%) for NPV
}
export const DEFAULT_FEAS: FeasInputs = {
  gsa: 0, salePrice: 6000, buildCost: 2800, landCost: 0, softPct: 15, devMonths: 24, salesMonths: 12, discount: 12,
};
export interface FeasResult {
  revenue: number; cost: number; profit: number;
  roi: number; moic: number; npv: number; irrAnnual: number | null; paybackMonths: number | null;
  cashflows: number[];
}

/** Internal rate of return (monthly) via bisection; null if no sign change. */
function irrMonthly(cf: number[]): number | null {
  const npvAt = (r: number) => cf.reduce((s, c, t) => s + c / Math.pow(1 + r, t), 0);
  let lo = -0.9, hi = 1; // -90%..+100% monthly
  let flo = npvAt(lo), fhi = npvAt(hi);
  if (flo * fhi > 0) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2, fmid = npvAt(mid);
    if (Math.abs(fmid) < 1) return mid;
    if (flo * fmid < 0) { hi = mid; fhi = fmid; } else { lo = mid; flo = fmid; }
  }
  return (lo + hi) / 2;
}

export function computeFeasibility(i: FeasInputs): FeasResult {
  const revenue = i.gsa * i.salePrice;
  const build = i.gsa * i.buildCost;
  const soft = build * (i.softPct / 100);
  const cost = i.landCost + build + soft;
  const profit = revenue - cost;
  const dev = Math.max(1, Math.round(i.devMonths));
  const sales = Math.max(1, Math.round(i.salesMonths));
  const cf: number[] = [];
  cf[0] = -i.landCost;
  const perDev = (build + soft) / dev;
  for (let m = 0; m < dev; m++) cf[m] = (cf[m] || 0) - perDev;
  const perSale = revenue / sales;
  for (let m = 0; m < sales; m++) { const t = dev + m; cf[t] = (cf[t] || 0) + perSale; }
  for (let t = 0; t < cf.length; t++) cf[t] = cf[t] || 0;

  const rM = i.discount / 100 / 12;
  const npv = cf.reduce((s, c, t) => s + c / Math.pow(1 + rM, t), 0);
  const irrM = irrMonthly(cf);
  const irrAnnual = irrM == null ? null : (Math.pow(1 + irrM, 12) - 1) * 100;
  let cum = 0, payback: number | null = null;
  for (let t = 0; t < cf.length; t++) { cum += cf[t]; if (cum >= 0) { payback = t; break; } }
  return {
    revenue, cost, profit,
    roi: cost ? (profit / cost) * 100 : 0,
    moic: cost ? revenue / cost : 0,
    npv, irrAnnual, paybackMonths: payback, cashflows: cf,
  };
}

export const scoreColor = (s: number) => (s >= 80 ? '#2F6B3E' : s >= 65 ? '#5E8C3A' : s >= 50 ? '#9A8A1E' : s >= 35 ? '#B5723A' : '#B5462F');
export const gradeLabel = (g: string, lang: Lang) => (lang === 'ar' ? { A: 'ممتاز', B: 'جيد جداً', C: 'جيد', D: 'مقبول', E: 'ضعيف' }[g] : { A: 'Excellent', B: 'Strong', C: 'Fair', D: 'Modest', E: 'Weak' }[g]);
