import { create } from 'zustand';
import { LAND_USES, type PlotProps, type SectorKey } from '@kec/types';
import type { Lang } from './lib/domain';

export type Basemap = 'light' | 'satellite';
export type Dim = '2d' | '3d';

export interface AppState {
  lang: Lang;
  basemap: Basemap;
  dim: Dim;
  sector: SectorKey | 'all';
  uses: Set<string>;
  search: string;
  searchCodes: string[] | null;   // computed match set (search-anything)
  selected: PlotProps | null;     // single selection
  multi: string[];                // ctrl multi-selection (codes)
  fitToken: number;               // bump to ask the map to fit the whole plan
  editGeom: string | null;        // plot code currently in shape-edit mode
  zoomCode: string | null;        // plot to zoom to
  zoomToken: number;              // bump to trigger a zoom to zoomCode

  setLang: (l: Lang) => void;
  toggleLang: () => void;
  setBasemap: (b: Basemap) => void;
  setDim: (d: Dim) => void;
  setSector: (s: SectorKey | 'all') => void;
  toggleUse: (k: string) => void;
  setSearch: (s: string) => void;
  setSearchCodes: (c: string[] | null) => void;
  select: (p: PlotProps | null) => void;
  toggleMulti: (code: string) => void;
  clearMulti: () => void;
  fitAll: () => void;
  setEditGeom: (code: string | null) => void;
  requestZoom: (code: string) => void;
  reset: () => void;
}

export const useApp = create<AppState>((set) => ({
  lang: 'en',
  basemap: 'light',
  dim: '2d',
  sector: 'all',
  uses: new Set(Object.keys(LAND_USES)),
  search: '',
  searchCodes: null,
  selected: null,
  multi: [],
  fitToken: 0,
  editGeom: null,
  zoomCode: null,
  zoomToken: 0,

  setLang: (lang) => set({ lang }),
  toggleLang: () => set((s) => ({ lang: s.lang === 'ar' ? 'en' : 'ar' })),
  setBasemap: (basemap) => set({ basemap }),
  setDim: (dim) => set({ dim }),
  setSector: (sector) => set({ sector }),
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
  requestZoom: (code) => set((s) => ({ zoomCode: code, zoomToken: s.zoomToken + 1 })),
  reset: () => set((s) => ({ sector: 'all', uses: new Set(Object.keys(LAND_USES)), search: '', searchCodes: null, selected: null, multi: [], fitToken: s.fitToken + 1 })),
}));

/** Client-side predicate mirrored from the MapLibre filter (for KPI recompute). */
export function matchPlot(p: PlotProps, s: AppState): boolean {
  if (s.sector !== 'all' && p.sector !== s.sector) return false;
  if (!s.uses.has(p.land_use ?? '')) return false;
  if (s.searchCodes && !s.searchCodes.includes(p.code)) return false;
  return true;
}
