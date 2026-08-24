import { create } from 'zustand';
import { LAND_USES, type PlotProps, type SectorKey } from '@kec/types';
import type { Lang } from './lib/domain';
import { LM_CAT_KEYS } from './lib/landmarks';

export type Basemap = 'light' | 'satellite';
export type Dim = '2d' | '3d' | 'earth';

/** Numeric-range + status filters (investor toolkit). Undefined bound = open. */
export interface AdvFilter {
  areaMin?: number; areaMax?: number;
  gfaMin?: number; gfaMax?: number;
  farMin?: number; farMax?: number;
  floorsMin?: number; floorsMax?: number;
  statuses: string[];   // planStatus values to keep; empty = any
}
export const emptyAdv: AdvFilter = { statuses: [] };
export const advActive = (a: AdvFilter): boolean =>
  a.statuses.length > 0 || [a.areaMin, a.areaMax, a.gfaMin, a.gfaMax, a.farMin, a.farMax, a.floorsMin, a.floorsMax].some((v) => v != null);

export interface AppState {
  lang: Lang;
  basemap: Basemap;
  dim: Dim;
  sector: SectorKey | 'all';
  uses: Set<string>;
  planOnly: boolean;              // show only plots that are in the development plan
  adv: AdvFilter;                 // advanced numeric/status filters
  search: string;
  searchCodes: string[] | null;   // computed match set (search-anything)
  selected: PlotProps | null;     // single selection
  multi: string[];                // ctrl multi-selection (codes)
  fitToken: number;               // bump to ask the map to fit the whole plan
  editGeom: string | null;        // plot code currently in shape-edit mode
  annotateMode: 'off' | 'text' | 'arrow' | 'rect';
  annotateColor: string;
  measuring: boolean;             // map measurement tool active
  measureMode: 'line' | 'route';  // straight polyline vs. driving route
  labels: boolean;                // force plot-code labels on the map
  landmarks: boolean;             // show Madinah city landmarks
  lmCats: Set<string>;            // enabled landmark categories
  creating: boolean;              // draw-a-new-plot mode
  zoomCode: string | null;        // plot to zoom to
  zoomToken: number;              // bump to trigger a zoom to zoomCode
  revealToken: number;            // bump to force a map resize+repaint (after overlays close)
  exportToken: number;            // bump to ask the map for a snapshot
  reportImage: string | null;     // captured map image (opens the report overlay)

  setLang: (l: Lang) => void;
  toggleLang: () => void;
  setBasemap: (b: Basemap) => void;
  setDim: (d: Dim) => void;
  setSector: (s: SectorKey | 'all') => void;
  togglePlanOnly: () => void;
  setAdv: (patch: Partial<AdvFilter>) => void;
  resetAdv: () => void;
  toggleUse: (k: string) => void;
  setSearch: (s: string) => void;
  setSearchCodes: (c: string[] | null) => void;
  select: (p: PlotProps | null) => void;
  toggleMulti: (code: string) => void;
  clearMulti: () => void;
  fitAll: () => void;
  setEditGeom: (code: string | null) => void;
  setAnnotateMode: (m: AppState['annotateMode']) => void;
  setAnnotateColor: (c: string) => void;
  toggleMeasure: () => void;
  setMeasuring: (v: boolean) => void;
  setMeasureMode: (m: 'line' | 'route') => void;
  toggleLabels: () => void;
  toggleLandmarks: () => void;
  toggleLmCat: (key: string) => void;
  setCreating: (v: boolean) => void;
  requestZoom: (code: string) => void;
  reveal: () => void;
  requestExport: () => void;
  setReportImage: (img: string | null) => void;
  reset: () => void;
}

export const useApp = create<AppState>((set) => ({
  lang: 'en',
  basemap: 'light',
  dim: '2d',
  sector: 'all',
  uses: new Set(Object.keys(LAND_USES)),
  planOnly: false,
  adv: emptyAdv,
  search: '',
  searchCodes: null,
  selected: null,
  multi: [],
  fitToken: 0,
  editGeom: null,
  annotateMode: 'off',
  annotateColor: '#2F6B3E',
  measuring: false,
  measureMode: 'line',
  labels: false,
  landmarks: false,
  lmCats: new Set(LM_CAT_KEYS),
  creating: false,
  zoomCode: null,
  zoomToken: 0,
  revealToken: 0,
  exportToken: 0,
  reportImage: null,

  setLang: (lang) => set({ lang }),
  toggleLang: () => set((s) => ({ lang: s.lang === 'ar' ? 'en' : 'ar' })),
  setBasemap: (basemap) => set({ basemap }),
  setDim: (dim) => set({ dim }),
  setSector: (sector) => set({ sector }),
  togglePlanOnly: () => set((s) => ({ planOnly: !s.planOnly })),
  setAdv: (patch) => set((s) => ({ adv: { ...s.adv, ...patch } })),
  resetAdv: () => set({ adv: { statuses: [] } }),
  toggleUse: (k) =>
    set((s) => { const uses = new Set(s.uses); uses.has(k) ? uses.delete(k) : uses.add(k); return { uses }; }),
  setSearch: (search) => set({ search }),
  setSearchCodes: (searchCodes) => set({ searchCodes }),
  select: (selected) => set({ selected, multi: [] }),
  toggleMulti: (code) =>
    set((s) => {
      const has = s.multi.includes(code);
      const multi = has ? s.multi.filter((c) => c !== code) : [...s.multi, code];
      return { multi, selected: null };
    }),
  clearMulti: () => set({ multi: [] }),
  fitAll: () => set((s) => ({ selected: null, multi: [], fitToken: s.fitToken + 1 })),
  setEditGeom: (editGeom) => set({ editGeom }),
  setAnnotateMode: (annotateMode) => set({ annotateMode }),
  setAnnotateColor: (annotateColor) => set({ annotateColor }),
  toggleMeasure: () => set((s) => ({ measuring: !s.measuring, annotateMode: 'off' })),
  setMeasuring: (measuring) => set({ measuring }),
  setMeasureMode: (measureMode) => set({ measureMode }),
  toggleLabels: () => set((s) => ({ labels: !s.labels })),
  toggleLandmarks: () => set((s) => ({ landmarks: !s.landmarks })),
  toggleLmCat: (key) => set((s) => { const lmCats = new Set(s.lmCats); lmCats.has(key) ? lmCats.delete(key) : lmCats.add(key); return { lmCats }; }),
  setCreating: (creating) => set({ creating, measuring: false, annotateMode: 'off' }),
  requestZoom: (code) => set((s) => ({ zoomCode: code, zoomToken: s.zoomToken + 1 })),
  reveal: () => set((s) => ({ revealToken: s.revealToken + 1 })),
  requestExport: () => set((s) => ({ exportToken: s.exportToken + 1 })),
  setReportImage: (reportImage) => set({ reportImage }),
  reset: () => set((s) => ({ sector: 'all', uses: new Set(Object.keys(LAND_USES)), planOnly: false, adv: { statuses: [] }, search: '', searchCodes: null, selected: null, multi: [], fitToken: s.fitToken + 1 })),
}));

const inRange = (v: number | null | undefined, min?: number, max?: number): boolean => {
  const n = v ?? 0;
  if (min != null && n < min) return false;
  if (max != null && n > max) return false;
  return true;
};

/** Client-side predicate mirrored from the MapLibre filter (for KPI recompute). */
export function matchPlot(p: PlotProps, s: AppState): boolean {
  if (s.sector !== 'all' && p.sector !== s.sector) return false;
  if (!s.uses.has(p.land_use ?? '')) return false;
  if (s.planOnly && !p.planStatus) return false;
  if (s.searchCodes && !s.searchCodes.includes(p.code)) return false;
  const a = s.adv;
  if (!inRange(p.area, a.areaMin, a.areaMax)) return false;
  if (!inRange(p.gfa, a.gfaMin, a.gfaMax)) return false;
  if (!inRange(p.far, a.farMin, a.farMax)) return false;
  if (!inRange(p.floors, a.floorsMin, a.floorsMax)) return false;
  if (a.statuses.length && !a.statuses.includes((p as any).planStatus ?? '')) return false;
  return true;
}
