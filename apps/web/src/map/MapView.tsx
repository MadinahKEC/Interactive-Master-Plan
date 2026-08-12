import { useEffect, useRef } from 'react';
import maplibregl, { type FilterSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LAND_USES, type PlotCollection, type PlotProps } from '@kec/types';
import { buildStyle, landUseColor, KEC_BOUNDS, KEC_CENTER } from './mapStyle';
import { useApp } from '../store';
import { useOverrides } from '../lib/overrides';
import { resolveProject, t, type ProjectInfo } from '../lib/domain';
import type { EffLandUse } from '../lib/effective';

const TILES_URL = import.meta.env.VITE_TILES_URL || undefined;
const FILTERED_LAYERS = ['plots-fill', 'plots-line', 'plots-3d', 'plots-label'];
const fs = (id: string | number) => ({ source: 'plots', id, ...(TILES_URL ? { sourceLayer: 'plots' } : {}) });
const PAD = { top: 90, bottom: 60, left: 360, right: 340 };

function buildFilter(sector: string, uses: Set<string>, codes: string[] | null): FilterSpecification | null {
  const parts: any[] = ['all'];
  if (sector !== 'all') parts.push(['==', ['get', 'sector'], sector]);
  if (uses.size < Object.keys(LAND_USES).length) parts.push(['in', ['get', 'land_use'], ['literal', [...uses]]]);
  if (codes) parts.push(['in', ['get', 'code'], ['literal', codes]]);
  return parts.length === 1 ? null : (parts as unknown as FilterSpecification);
}

function ringOf(geom: any): number[][] {
  return geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0][0];
}
function boundsOf(data: PlotCollection): maplibregl.LngLatBounds {
  const b = new maplibregl.LngLatBounds();
  for (const f of data.features) ringOf(f.geometry).forEach((pt) => b.extend(pt as [number, number]));
  return b;
}

export function MapView({ data, projects, landUses }: {
  data: PlotCollection | null; projects: Record<string, ProjectInfo>; landUses: Record<string, EffLandUse>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const hovered = useRef<string | number | null>(null);
  const byCode = useRef<Record<string, { ring: number[][] }>>({});
  const dataRef = useRef(data);
  const clickTimer = useRef<number | null>(null);
  const fullBounds = useRef<maplibregl.LngLatBounds | null>(null);
  const { lang } = useApp();
  const langRef = useRef(lang);
  const projRef = useRef(projects);
  const luRef = useRef(landUses);
  useEffect(() => { langRef.current = lang; }, [lang]);
  useEffect(() => { projRef.current = projects; }, [projects]);
  useEffect(() => { luRef.current = landUses; }, [landUses]);
  useEffect(() => { dataRef.current = data; }, [data]);

  useEffect(() => {
    if (!data) return;
    const idx: typeof byCode.current = {};
    for (const f of data.features) idx[f.properties.code] = { ring: ringOf(f.geometry) };
    byCode.current = idx;
    fullBounds.current = boundsOf(data);
  }, [data]);

  const zoomTo = (code: string) => {
    const map = mapRef.current; const ring = byCode.current[code]?.ring; if (!map || !ring) return;
    const b = new maplibregl.LngLatBounds(); ring.forEach((pt) => b.extend(pt as [number, number]));
    map.fitBounds(b, { padding: PAD, maxZoom: 18, duration: 800 });
  };

  // ---------- init ----------
  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: ref.current, style: buildStyle(TILES_URL, luRef.current), center: KEC_CENTER,
      zoom: 13.4, maxZoom: 19, attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.doubleClickZoom.disable();
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-left');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });

    map.on('load', () => {
      const b = fullBounds.current ?? new maplibregl.LngLatBounds(KEC_BOUNDS[0], KEC_BOUNDS[1]);
      map.fitBounds(b, { padding: 60, duration: 0 });
    });

    map.on('mousemove', 'plots-fill', (e) => {
      if (useApp.getState().editGeom) return;
      map.getCanvas().style.cursor = 'pointer';
      const f = e.features?.[0]; if (!f) return;
      const p = f.properties as PlotProps;
      try {
        if (hovered.current != null) map.setFeatureState(fs(hovered.current), { hover: false });
        hovered.current = f.id ?? p.code;
        map.setFeatureState(fs(hovered.current!), { hover: true });
      } catch { /* */ }
      const L = langRef.current;
      const pr = resolveProject(p.code, p.land_use, projRef.current);
      const title = pr.named ? (L === 'ar' ? pr.overlay.name_ar || pr.overlay.name_en : pr.overlay.name_en || pr.overlay.name_ar) : p.code;
      const type = L === 'ar' ? pr.type.ar : pr.type.en;
      const own = L === 'ar' ? pr.ownership.ar : pr.ownership.en;
      tip.setLngLat(e.lngLat).setHTML(
        `<div class="tip"><span class="tt">${title}</span><span class="ts">${type} · <b class="mono">${p.code}</b> · <span style="color:${pr.ownership.color}">${own}</span></span></div>`,
      ).addTo(map);
    });
    map.on('mouseleave', 'plots-fill', () => {
      map.getCanvas().style.cursor = ''; tip.remove();
      try { if (hovered.current != null) map.setFeatureState(fs(hovered.current), { hover: false }); } catch { /* */ }
      hovered.current = null;
    });

    // single = details only; ctrl = multi; double = zoom
    map.on('click', 'plots-fill', (e) => {
      if (useApp.getState().editGeom) return;
      const p = e.features?.[0]?.properties as PlotProps | undefined; if (!p) return;
      const ctrl = (e.originalEvent as MouseEvent).ctrlKey || (e.originalEvent as MouseEvent).metaKey;
      if (ctrl) { if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; } useApp.getState().toggleMulti(p.code); return; }
      if (clickTimer.current) clearTimeout(clickTimer.current);
      clickTimer.current = window.setTimeout(() => { useApp.getState().select(p); clickTimer.current = null; }, 240);
    });
    map.on('dblclick', 'plots-fill', (e) => {
      if (useApp.getState().editGeom) return;
      if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
      const p = e.features?.[0]?.properties as PlotProps | undefined; if (p) zoomTo(p.code);
    });

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // effective data -> geojson source
  useEffect(() => {
    const map = mapRef.current; if (!map || !data || TILES_URL) return;
    const apply = () => { (map.getSource('plots') as maplibregl.GeoJSONSource | undefined)?.setData(data as any); };
    map.isStyleLoaded() ? apply() : map.once('idle', apply);
  }, [data]);

  const { sector, uses, searchCodes, basemap, selected, multi, dim, fitToken, editGeom, zoomToken, zoomCode } = useApp();

  useEffect(() => { if (zoomToken && zoomCode) zoomTo(zoomCode); }, [zoomToken]); // eslint-disable-line

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const apply = () => { const f = buildFilter(sector, uses, searchCodes); FILTERED_LAYERS.forEach((l) => map.getLayer(l) && map.setFilter(l, f)); };
    map.isStyleLoaded() ? apply() : map.once('idle', apply);
  }, [sector, uses, searchCodes]);

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const apply = () => {
      const expr = landUseColor(landUses);
      if (map.getLayer('plots-fill')) map.setPaintProperty('plots-fill', 'fill-color', expr);
      if (map.getLayer('plots-3d')) map.setPaintProperty('plots-3d', 'fill-extrusion-color', expr);
    };
    map.isStyleLoaded() ? apply() : map.once('idle', apply);
  }, [landUses]);

  // basemap (light + satellite only; light theme)
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const sat = basemap === 'satellite';
    const apply = () => {
      map.setLayoutProperty('base-sat', 'visibility', sat ? 'visible' : 'none');
      map.setLayoutProperty('base-light', 'visibility', sat ? 'none' : 'visible');
      if (map.getLayer('base-dark')) map.setLayoutProperty('base-dark', 'visibility', 'none');
      if (map.getLayer('labels-light')) map.setLayoutProperty('labels-light', 'visibility', sat ? 'none' : 'visible');
      if (map.getLayer('labels-sat')) map.setLayoutProperty('labels-sat', 'visibility', sat ? 'visible' : 'none');
      map.setPaintProperty('plots-line', 'line-color', sat ? '#FBFCFA' : '#143D1E');
      map.setPaintProperty('plots-line', 'line-opacity', sat ? 0.8 : 0.55);
      map.setPaintProperty('plots-label', 'text-color', sat ? '#FFFFFF' : '#143D1E');
      map.setPaintProperty('plots-label', 'text-halo-color', sat ? '#143D1E' : '#FBFCFA');
    };
    map.isStyleLoaded() ? apply() : map.once('idle', apply);
  }, [basemap]);

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const is3d = dim === '3d';
    const apply = () => {
      map.setLayoutProperty('plots-3d', 'visibility', is3d ? 'visible' : 'none');
      map.setLayoutProperty('plots-fill', 'visibility', is3d ? 'none' : 'visible');
      map.easeTo({ pitch: is3d ? 55 : 0, bearing: is3d ? -18 : 0, duration: 700 });
    };
    map.isStyleLoaded() ? apply() : map.once('idle', apply);
  }, [dim]);

  // single-selection highlight (fill + outline; no auto zoom)
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const code = selected?.code ?? '';
    const f: any = ['==', ['get', 'code'], code];
    const apply = () => {
      if (map.getLayer('plots-sel')) map.setFilter('plots-sel', f);
      if (map.getLayer('plots-sel-fill')) map.setFilter('plots-sel-fill', f);
    };
    map.isStyleLoaded() ? apply() : map.once('idle', apply);
  }, [selected]);

  // multi-selection highlight
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const apply = () => {
      const f: any = ['in', ['get', 'code'], ['literal', multi]];
      if (map.getLayer('plots-multi')) map.setFilter('plots-multi', f);
      if (map.getLayer('plots-multi-line')) map.setFilter('plots-multi-line', f);
    };
    map.isStyleLoaded() ? apply() : map.once('idle', apply);
  }, [multi]);

  // fit whole plan on request (close / reset)
  useEffect(() => {
    const map = mapRef.current; if (!map || fitToken === 0) return;
    const b = fullBounds.current; if (b) map.fitBounds(b, { padding: 60, duration: 800 });
  }, [fitToken]);

  // ---------- geometry (shape) editor ----------
  const editRing = useRef<number[][]>([]);
  const editMeta = useRef<{ code: string; geomType: string; rest: any } | null>(null);
  const dragIdx = useRef<number | null>(null);

  const refreshEdit = () => {
    const map = mapRef.current; if (!map) return;
    const ring = editRing.current;
    const closed = [...ring, ring[0]];
    (map.getSource('ed-poly') as maplibregl.GeoJSONSource)?.setData({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [closed] } } as any);
    (map.getSource('ed-verts') as maplibregl.GeoJSONSource)?.setData({ type: 'FeatureCollection', features: ring.map((pt, i) => ({ type: 'Feature', id: i, properties: { i }, geometry: { type: 'Point', coordinates: pt } })) } as any);
  };

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (!editGeom) return;
    const feat = dataRef.current?.features.find((f) => f.properties.code === editGeom);
    if (!feat) return;
    const g: any = feat.geometry;
    const ring = (g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]).slice(0, -1).map((p: number[]) => [...p]);
    editRing.current = ring;
    editMeta.current = { code: editGeom, geomType: g.type, rest: g };

    map.addSource('ed-poly', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as any });
    map.addSource('ed-verts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as any });
    map.addLayer({ id: 'ed-fill', type: 'fill', source: 'ed-poly', paint: { 'fill-color': '#9A8A1E', 'fill-opacity': 0.15 } });
    map.addLayer({ id: 'ed-line', type: 'line', source: 'ed-poly', paint: { 'line-color': '#9A8A1E', 'line-width': 2, 'line-dasharray': [2, 1] } });
    map.addLayer({ id: 'ed-verts-l', type: 'circle', source: 'ed-verts', paint: { 'circle-radius': 6, 'circle-color': '#FBFCFA', 'circle-stroke-color': '#2F6B3E', 'circle-stroke-width': 2.4 } });
    refreshEdit();
    zoomTo(editGeom);

    const onDown = (e: any) => { e.preventDefault(); dragIdx.current = e.features?.[0]?.id ?? null; map.dragPan.disable(); map.getCanvas().style.cursor = 'grabbing'; };
    const onMove = (e: any) => { if (dragIdx.current == null) return; editRing.current[dragIdx.current] = [e.lngLat.lng, e.lngLat.lat]; refreshEdit(); };
    const onUp = () => { if (dragIdx.current != null) { dragIdx.current = null; map.dragPan.enable(); map.getCanvas().style.cursor = ''; } };
    const onVertEnter = () => { if (dragIdx.current == null) map.getCanvas().style.cursor = 'grab'; };
    const onVertDbl = (e: any) => { e.preventDefault(); const i = e.features?.[0]?.id; if (i == null || editRing.current.length <= 3) return; editRing.current.splice(i, 1); refreshEdit(); };
    const onLineClick = (e: any) => {
      // insert a vertex at the nearest segment
      const c: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      const r = editRing.current; let best = 0, bestD = Infinity;
      for (let i = 0; i < r.length; i++) {
        const a = r[i], b = r[(i + 1) % r.length];
        const d = distToSeg(c, a as [number, number], b as [number, number]);
        if (d < bestD) { bestD = d; best = i; }
      }
      r.splice(best + 1, 0, c); refreshEdit();
    };

    map.on('mousedown', 'ed-verts-l', onDown);
    map.on('mousemove', onMove);
    map.on('mouseup', onUp);
    map.on('mouseenter', 'ed-verts-l', onVertEnter);
    map.on('dblclick', 'ed-verts-l', onVertDbl);
    map.on('click', 'ed-fill', onLineClick);

    return () => {
      map.off('mousedown', 'ed-verts-l', onDown); map.off('mousemove', onMove); map.off('mouseup', onUp);
      map.off('mouseenter', 'ed-verts-l', onVertEnter); map.off('dblclick', 'ed-verts-l', onVertDbl); map.off('click', 'ed-fill', onLineClick);
      ['ed-fill', 'ed-line', 'ed-verts-l'].forEach((l) => map.getLayer(l) && map.removeLayer(l));
      ['ed-poly', 'ed-verts'].forEach((s) => map.getSource(s) && map.removeSource(s));
      map.dragPan.enable();
    };
  }, [editGeom]);

  const saveShape = () => {
    const meta = editMeta.current; if (!meta) return;
    const ring = [...editRing.current, editRing.current[0]];
    let geom: any;
    if (meta.geomType === 'Polygon') geom = { type: 'Polygon', coordinates: [ring] };
    else { const coords = meta.rest.coordinates.map((p: any) => p); coords[0] = [ring]; geom = { type: 'MultiPolygon', coordinates: coords }; }
    useOverrides.getState().setGeometry(meta.code, geom);
    useApp.getState().setEditGeom(null);
  };
  const resetShape = () => {
    const meta = editMeta.current; const map = mapRef.current; if (!meta || !map) return;
    const base = dataRef.current?.features.find((f) => f.properties.code === meta.code);
    if (!base) return;
    const g: any = base.geometry;
    editRing.current = (g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]).slice(0, -1).map((p: number[]) => [...p]);
    refreshEdit();
  };

  return (
    <>
      <div ref={ref} style={{ position: 'absolute', inset: 0 }} />
      {editGeom && (
        <div className="geo-toolbar">
          <span className="geo-hint">{t('g.hint', lang)}</span>
          <div className="geo-actions">
            <button className="btn" onClick={resetShape}>{t('g.reset', lang)}</button>
            <button className="btn" onClick={() => useApp.getState().setEditGeom(null)}>{t('g.cancel', lang)}</button>
            <button className="btn primary" onClick={saveShape}>{t('g.save', lang)}</button>
          </div>
        </div>
      )}
    </>
  );
}

function distToSeg(p: [number, number], a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = a[0] + t * dx, cy = a[1] + t * dy;
  return Math.hypot(p[0] - cx, p[1] - cy);
}
