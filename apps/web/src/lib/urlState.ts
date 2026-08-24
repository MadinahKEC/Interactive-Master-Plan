import { useEffect, useRef } from 'react';
import type { PlotCollection } from '@kec/types';
import { useApp, type AppState } from '../store';

/** Serialise the shareable slice of the app state into a URL query string. */
export function encodeState(s: AppState): string {
  const p = new URLSearchParams();
  if (s.selected) p.set('plot', s.selected.code);
  if (s.sector !== 'all') p.set('sector', s.sector);
  if (s.basemap !== 'light') p.set('map', s.basemap);
  if (s.dim !== '2d') p.set('dim', s.dim);
  if (s.planOnly) p.set('plan', '1');
  return p.toString();
}

/** Absolute link that reopens the current view (plot, filters, basemap). */
export function shareUrl(): string {
  const q = encodeState(useApp.getState());
  const base = location.origin + location.pathname;
  return q ? `${base}#${q}` : base;
}

/**
 * Two-way sync between the app state and the URL hash, so any view is a shareable
 * link. Reads the hash once the data is ready (to resolve a linked plot), then
 * mirrors later changes back into the hash with replaceState (no history spam).
 */
export function useUrlSync(data: PlotCollection | null) {
  const applied = useRef(false);

  useEffect(() => {
    if (!data || applied.current) return;
    applied.current = true;
    const p = new URLSearchParams(location.hash.replace(/^#/, ''));
    const st = useApp.getState();
    const sector = p.get('sector'); if (sector) st.setSector(sector as any);
    const map = p.get('map'); if (map === 'satellite') st.setBasemap('satellite');
    const dim = p.get('dim'); if (dim === '3d') st.setDim('3d');
    if (p.get('plan') === '1' && !st.planOnly) st.togglePlanOnly();
    const code = p.get('plot');
    if (code) {
      const f = data.features.find((x) => x.properties.code === code);
      if (f) { st.select(f.properties); setTimeout(() => useApp.getState().requestZoom(code), 120); }
    }
  }, [data]);

  useEffect(() => {
    let last = '';
    return useApp.subscribe((s) => {
      const q = encodeState(s);
      if (q === last) return;
      last = q;
      const url = q ? `#${q}` : location.pathname + location.search;
      history.replaceState(null, '', url);
    });
  }, []);
}
