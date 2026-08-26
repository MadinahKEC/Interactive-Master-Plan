import { useEffect, useRef, useState } from 'react';
import maplibregl, { type FilterSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LAND_USES, type PlotCollection, type PlotProps } from '@kec/types';
import { buildStyle, plotFillColor, KEC_BOUNDS, KEC_CENTER } from './mapStyle';
import { useApp, type AdvFilter } from '../store';
import { useOverrides, type Annotation } from '../lib/overrides';
import { resolveProject, t, type ProjectInfo } from '../lib/domain';
import { geomArea } from '../lib/subdivide';
import { useDialog } from '../lib/dialog';
import { useLandmarks, LM_CAT_MAP, type Landmark } from '../lib/landmarks';
import { IconWalk, IconCar, IconClock } from '../components/icons';
import type { EffLandUse } from '../lib/effective';

/** Human-readable travel time from seconds (e.g. "12 min", "1 h 5 min"). */
function fmtDuration(sec: number, lang: 'ar' | 'en'): string {
  const min = Math.max(1, Math.round(sec / 60));
  const mLbl = lang === 'ar' ? 'د' : 'min';
  const hLbl = lang === 'ar' ? 'س' : 'h';
  if (min < 60) return `${min} ${mLbl}`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} ${hLbl} ${m} ${mLbl}` : `${h} ${hLbl}`;
}

const TILES_URL = import.meta.env.VITE_TILES_URL || undefined;
const FILTERED_LAYERS = ['plots-fill', 'plots-line', 'plots-3d', 'plots-label'];
const fs = (id: string | number) => ({ source: 'plots', id, ...(TILES_URL ? { sourceLayer: 'plots' } : {}) });
const PAD = { top: 90, bottom: 60, left: 360, right: 340 };

function buildFilter(sector: string, uses: Set<string>, codes: string[] | null, planOnly: boolean, adv?: AdvFilter): FilterSpecification | null {
  const parts: any[] = ['all'];
  if (sector !== 'all') parts.push(['==', ['get', 'sector'], sector]);
  if (uses.size < Object.keys(LAND_USES).length) parts.push(['in', ['get', 'land_use'], ['literal', [...uses]]]);
  if (planOnly) parts.push(['has', 'planStatus']);
  if (codes) parts.push(['in', ['get', 'code'], ['literal', codes]]);
  if (adv) {
    const rng = (key: string, min?: number, max?: number) => {
      if (min != null) parts.push(['>=', ['coalesce', ['get', key], 0], min]);
      if (max != null) parts.push(['<=', ['coalesce', ['get', key], 0], max]);
    };
    rng('area', adv.areaMin, adv.areaMax);
    rng('gfa', adv.gfaMin, adv.gfaMax);
    rng('far', adv.farMin, adv.farMax);
    rng('floors', adv.floorsMin, adv.floorsMax);
    if (adv.statuses.length) parts.push(['in', ['coalesce', ['get', 'planStatus'], ''], ['literal', adv.statuses]]);
  }
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

export function MapView({ data, projects, landUses, canAnnotate }: {
  data: PlotCollection | null; projects: Record<string, ProjectInfo>; landUses: Record<string, EffLandUse>; canAnnotate: boolean;
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
  const annotations = useOverrides((s) => s.annotations);
  const planStyle = useOverrides((s) => s.planStyle);
  const annotRef = useRef<Annotation[]>(annotations);
  const modeRef = useRef<'off' | 'text' | 'arrow' | 'rect'>('off');
  const colorRef = useRef('#B5462F');
  const pendingRef = useRef<number[] | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const canAnnotRef = useRef(canAnnotate);
  const focusIdRef = useRef<string | null>(null);
  useEffect(() => { canAnnotRef.current = canAnnotate; }, [canAnnotate]);
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
      zoom: 13.4, maxZoom: 19, maxPitch: 80, attributionControl: { compact: true }, preserveDrawingBuffer: true,
    });
    mapRef.current = map;
    if (import.meta.env.DEV) (window as any).__map = map;
    map.doubleClickZoom.disable();
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-left');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });

    // keep the map painted through layout changes / GPU context loss (fixes blank map)
    const ro = new ResizeObserver(() => { try { map.resize(); } catch { /* */ } });
    ro.observe(ref.current);
    const canvas = map.getCanvas();
    const onCtxLost = (e: Event) => { e.preventDefault(); };
    const onCtxRestored = () => { try { map.resize(); map.triggerRepaint(); } catch { /* */ } };
    canvas.addEventListener('webglcontextlost', onCtxLost, false);
    canvas.addEventListener('webglcontextrestored', onCtxRestored, false);
    const onVisible = () => { if (document.visibilityState === 'visible') { try { map.resize(); map.triggerRepaint(); } catch { /* */ } } };
    document.addEventListener('visibilitychange', onVisible);

    map.on('load', () => {
      const b = fullBounds.current ?? new maplibregl.LngLatBounds(KEC_BOUNDS[0], KEC_BOUNDS[1]);
      map.fitBounds(b, { padding: 60, duration: 0 });
      try { map.setLight({ anchor: 'viewport', color: '#ffffff', intensity: 0.45, position: [1.5, 210, 30] }); } catch { /* */ }
      // annotation layers (drawn on top)
      const empty = { type: 'FeatureCollection', features: [] } as any;
      if (!map.getSource('annot-polys')) map.addSource('annot-polys', { type: 'geojson', data: empty });
      if (!map.getSource('annot-lines')) map.addSource('annot-lines', { type: 'geojson', data: empty });
      if (!map.getLayer('annot-poly-fill')) map.addLayer({ id: 'annot-poly-fill', type: 'fill', source: 'annot-polys', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.16 } });
      if (!map.getLayer('annot-poly-line')) map.addLayer({ id: 'annot-poly-line', type: 'line', source: 'annot-polys', paint: { 'line-color': ['get', 'color'], 'line-width': 2 } });
      if (!map.getLayer('annot-lines-l')) map.addLayer({ id: 'annot-lines-l', type: 'line', source: 'annot-lines', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 3.4 } });
      renderAnnot(annotRef.current);
    });

    const HIT = ['plots-fill', 'plots-3d'];
    map.on('mousemove', HIT, (e) => {
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
    map.on('mouseleave', HIT, () => {
      map.getCanvas().style.cursor = ''; tip.remove();
      try { if (hovered.current != null) map.setFeatureState(fs(hovered.current), { hover: false }); } catch { /* */ }
      hovered.current = null;
    });

    // single = details only; ctrl = multi; double = zoom
    map.on('click', HIT, (e) => {
      if (useApp.getState().editGeom || useApp.getState().measuring || useApp.getState().creating || modeRef.current !== 'off') return;
      const p = e.features?.[0]?.properties as PlotProps | undefined; if (!p) return;
      const ctrl = (e.originalEvent as MouseEvent).ctrlKey || (e.originalEvent as MouseEvent).metaKey;
      if (ctrl) { if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; } useApp.getState().toggleMulti(p.code); return; }
      if (clickTimer.current) clearTimeout(clickTimer.current);
      clickTimer.current = window.setTimeout(() => { useApp.getState().select(p); clickTimer.current = null; }, 240);
    });
    // Google-Maps-style double-click: smooth, gradual zoom-in by one level toward the
    // cursor (works anywhere on the map). Edit/measure modes keep their own dblclick.
    map.on('dblclick', (e) => {
      if (useApp.getState().editGeom || modeRef.current !== 'off') return;
      if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
      map.easeTo({ zoom: Math.min(map.getMaxZoom(), map.getZoom() + 1), around: e.lngLat, duration: 450, easing: (t) => t * (2 - t) });
    });

    // annotation drawing (admin): text / arrow / rectangle. Click an existing one to delete.
    map.on('click', (e) => {
      const mode = modeRef.current; if (mode === 'off') return;
      const ll: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      const ov = useOverrides.getState();
      const hits = map.queryRenderedFeatures(e.point, { layers: ['annot-lines-l', 'annot-poly-fill'].filter((l) => map.getLayer(l)) });
      if (hits.length && hits[0].properties?.id) { ov.removeAnnotation(hits[0].properties.id as string); return; }
      if (mode === 'text') {
        focusIdRef.current = ov.addAnnotation({ kind: 'text', color: colorRef.current, coords: ll, text: '' });
      } else if (mode === 'arrow' || mode === 'rect') {
        if (!pendingRef.current) { pendingRef.current = ll; }
        else {
          const a = pendingRef.current, b = ll; pendingRef.current = null;
          if (mode === 'arrow') ov.addAnnotation({ kind: 'arrow', color: colorRef.current, coords: [a, b] });
          else ov.addAnnotation({ kind: 'rect', color: colorRef.current, coords: [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]], [a[0], a[1]]] });
        }
      }
    });

    return () => {
      ro.disconnect();
      canvas.removeEventListener('webglcontextlost', onCtxLost);
      canvas.removeEventListener('webglcontextrestored', onCtxRestored);
      document.removeEventListener('visibilitychange', onVisible);
      map.remove(); mapRef.current = null;
    };
  }, []);

  // effective data -> geojson source
  useEffect(() => {
    const map = mapRef.current; if (!map || !data || TILES_URL) return;
    const apply = () => { (map.getSource('plots') as maplibregl.GeoJSONSource | undefined)?.setData(data as any); };
    map.isStyleLoaded() ? apply() : map.once('idle', apply);
  }, [data]);

  const { sector, uses, searchCodes, planOnly, adv, basemap, selected, multi, dim, fitToken, editGeom, zoomToken, zoomCode, revealToken, exportToken, annotateMode, annotateColor, measuring, measureMode, labels, landmarks, lmCats, creating, flyover } = useApp();
  const lmData = useLandmarks();
  const [measure, setMeasure] = useState<{ dist: number; area: number; n: number; routeDist?: number; routeDur?: number; routing?: boolean; routeErr?: boolean }>({ dist: 0, area: 0, n: 0 });

  // capture a map snapshot for the report
  useEffect(() => {
    const map = mapRef.current; if (!map || exportToken === 0) return;
    map.triggerRepaint();
    const id = setTimeout(() => {
      try { useApp.getState().setReportImage(map.getCanvas().toDataURL('image/png')); }
      catch { useApp.getState().setReportImage(''); }
    }, 300);
    return () => clearTimeout(id);
  }, [exportToken]);

  useEffect(() => {
    modeRef.current = annotateMode; pendingRef.current = null;
    const map = mapRef.current; if (map) map.getCanvas().style.cursor = annotateMode !== 'off' ? 'crosshair' : '';
  }, [annotateMode]);
  useEffect(() => { colorRef.current = annotateColor; }, [annotateColor]);

  useEffect(() => { if (zoomToken && zoomCode) zoomTo(zoomCode); }, [zoomToken]); // eslint-disable-line

  // force a resize + repaint when overlays close (belt-and-braces against a blank map)
  useEffect(() => {
    const map = mapRef.current; if (!map || revealToken === 0) return;
    const id = requestAnimationFrame(() => { try { map.resize(); map.triggerRepaint(); } catch { /* */ } });
    return () => cancelAnimationFrame(id);
  }, [revealToken]);

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const apply = () => { const f = buildFilter(sector, uses, searchCodes, planOnly, adv); FILTERED_LAYERS.forEach((l) => map.getLayer(l) && map.setFilter(l, f)); };
    map.isStyleLoaded() ? apply() : map.once('idle', apply);
  }, [sector, uses, searchCodes, planOnly, adv]);

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const apply = () => {
      const expr = plotFillColor(landUses, planStyle.fill);
      if (map.getLayer('plots-fill')) map.setPaintProperty('plots-fill', 'fill-color', expr);
      if (map.getLayer('plots-3d')) map.setPaintProperty('plots-3d', 'fill-extrusion-color', expr);
      if (map.getLayer('plans-outline') || map.getLayer('plan-outline')) {
        map.setPaintProperty('plan-outline', 'line-color', planStyle.outline);
        map.setPaintProperty('plan-outline', 'line-dasharray', planStyle.dash ? [2, 1.4] : [1, 0]);
      }
      if (map.getLayer('plan-glow')) map.setLayoutProperty('plan-glow', 'visibility', planStyle.glow ? 'visible' : 'none');
    };
    map.isStyleLoaded() ? apply() : map.once('idle', apply);
  }, [landUses, planStyle]);

  // basemap (light + satellite only; light theme)
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const sat = basemap === 'satellite';
    ref.current?.classList.toggle('map-sat', sat);
    const apply = () => {
      map.setLayoutProperty('base-sat', 'visibility', sat ? 'visible' : 'none');
      // the light basemap ground is a set of OpenFreeMap vector layers (hidden on sat)
      ['basev-landcover', 'basev-water', 'basev-building', 'basev-road-casing', 'basev-road'].forEach((id) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', sat ? 'none' : 'visible');
      });
      // place / landmark / street labels stay ON in BOTH modes — just re-tinted:
      // white text on satellite, dark text on the light basemap.
      const tint = (id: string, dark: string, halo: string) => {
        if (!map.getLayer(id)) return;
        map.setPaintProperty(id, 'text-color', sat ? '#FFFFFF' : dark);
        map.setPaintProperty(id, 'text-halo-color', sat ? '#0B1A10' : halo);
      };
      tint('basev-place', '#3A4A40', '#eef1ec');
      tint('basev-road-name', '#6a7a6e', '#ffffff');
      tint('flagship-label', '#16221B', '#ffffff'); // bold landmark names — dark on light, white on sat
      // landmarks: warm gold on satellite, deep-green on light
      if (map.getLayer('basev-poi')) {
        map.setPaintProperty('basev-poi', 'text-color', sat ? '#FBE7A8' : '#1C6034');
        map.setPaintProperty('basev-poi', 'text-halo-color', sat ? '#0B1A10' : '#ffffff');
      }
      map.setPaintProperty('plots-line', 'line-color', sat ? '#FBFCFA' : '#143D1E');
      map.setPaintProperty('plots-line', 'line-opacity', sat ? 0.8 : 0.55);
      map.setPaintProperty('plots-label', 'text-color', sat ? '#FFFFFF' : '#143D1E');
      map.setPaintProperty('plots-label', 'text-halo-color', sat ? '#143D1E' : '#FBFCFA');
    };
    map.isStyleLoaded() ? apply() : map.once('idle', apply);
  }, [basemap]);

  // plot-code labels toggle — just flip visibility; styling/collision live in the style
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const apply = () => { if (map.getLayer('plots-label')) map.setLayoutProperty('plots-label', 'visibility', labels ? 'visible' : 'none'); };
    map.isStyleLoaded() ? apply() : map.once('idle', apply);
  }, [labels]);

  // ---------- Madinah landmarks & POIs (premium bilingual DOM markers) ----------
  // A pooled renderer: only the markers inside the viewport, matching the enabled
  // categories and the current zoom tier, are mounted (capped) — so the ~800-place
  // dataset stays fast and never clutters the map.
  const lmPool = useRef<Map<string, maplibregl.Marker>>(new Map());
  const lmCatsRef = useRef(lmCats);
  useEffect(() => { lmCatsRef.current = lmCats; }, [lmCats]);
  const hiddenLm = useOverrides((s) => s.hiddenLandmarks);
  const hiddenLmRef = useRef(hiddenLm);
  useEffect(() => { hiddenLmRef.current = hiddenLm; }, [hiddenLm]);
  const lmId = (lm: Landmark) => `${lm.c}:${lm.lat},${lm.lon}`;
  const makeLmEl = (lm: Landmark, L: 'ar' | 'en') => {
    const meta = LM_CAT_MAP[lm.c];
    const id = lmId(lm);
    const el = document.createElement('div');
    el.className = `lm-marker ${lm.t === 1 ? 'flag' : ''} lm-${lm.c}`;
    el.style.setProperty('--lm-color', meta?.color ?? '#5C6B60');
    el.style.zIndex = String(10 - lm.t);
    const dot = document.createElement('span'); dot.className = 'lm-dot';
    const label = document.createElement('span'); label.className = 'lm-label';
    label.textContent = L === 'ar' ? lm.na : lm.ne;
    el.append(dot, label);
    // curators can remove an unwanted landmark (persisted) via a hover × button
    if (canAnnotRef.current) {
      el.classList.add('editable');
      const del = document.createElement('button'); del.className = 'lm-del'; del.type = 'button'; del.textContent = '×';
      del.title = L === 'ar' ? 'إزالة هذا المعلم' : 'Remove this landmark';
      del.onclick = (ev) => { ev.stopPropagation(); useOverrides.getState().hideLandmark(id); };
      el.append(del);
    }
    return el;
  };
  const renderLandmarks = () => {
    const map = mapRef.current; if (!map) return;
    const pool = lmPool.current;
    if (!landmarks || !lmData.length) { pool.forEach((m) => m.remove()); pool.clear(); return; }
    const L = langRef.current;
    const z = map.getZoom();
    const tierMax = z < 11.5 ? 1 : z < 13 ? 2 : 3;
    const b = map.getBounds();
    const cats = lmCatsRef.current;
    const hidden = new Set(hiddenLmRef.current);
    const c = map.getCenter();
    const visible = lmData
      .filter((lm) => lm.t <= tierMax && cats.has(lm.c) && !hidden.has(lmId(lm)) && b.contains([lm.lon, lm.lat] as [number, number]))
      .sort((a, d) => a.t - d.t || (Math.hypot(a.lon - c.lng, a.lat - c.lat) - Math.hypot(d.lon - c.lng, d.lat - c.lat)))
      .slice(0, 90);
    const keep = new Set<string>();
    for (const lm of visible) {
      const id = lmId(lm); keep.add(id);
      if (!pool.has(id)) {
        const mk = new maplibregl.Marker({ element: makeLmEl(lm, L), anchor: 'left' }).setLngLat([lm.lon, lm.lat]).addTo(map);
        pool.set(id, mk);
      }
    }
    for (const [id, m] of pool) if (!keep.has(id)) { m.remove(); pool.delete(id); }
  };
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const onMove = () => renderLandmarks();
    map.on('moveend', onMove);
    renderLandmarks();
    return () => { map.off('moveend', onMove); lmPool.current.forEach((m) => m.remove()); lmPool.current.clear(); };
  }, [landmarks, lmData, lang, lmCats, hiddenLm, canAnnotate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- cinematic fly-through: tilt over the plan and slowly orbit ----------
  useEffect(() => {
    const map = mapRef.current; if (!map || !flyover) return;
    map.easeTo({ center: KEC_CENTER, zoom: 13.7, pitch: 70, bearing: map.getBearing(), duration: 1400 });
    let timer = 0;
    const start = window.setTimeout(() => {
      timer = window.setInterval(() => { try { map.setBearing((map.getBearing() + 0.25) % 360); } catch { /* */ } }, 33);
    }, 1500);
    return () => { clearTimeout(start); clearInterval(timer); };
  }, [flyover]);


  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const massing = dim === '3d';   // extruded plot volumes
    const earth = dim === 'earth';  // satellite draped on real terrain (Google-Earth-like)
    const apply = () => {
      map.setLayoutProperty('plots-3d', 'visibility', massing ? 'visible' : 'none');
      map.setLayoutProperty('plots-fill', 'visibility', massing ? 'none' : 'visible');
      if (map.getLayer('ofm-3d-buildings')) map.setLayoutProperty('ofm-3d-buildings', 'visibility', earth ? 'visible' : 'none');
      // 3D terrain + atmospheric sky only in Earth mode
      try {
        if (earth) {
          map.setTerrain({ source: 'terrainDEM', exaggeration: 1.4 });
          map.setSky({
            'sky-color': '#8fbce8', 'sky-horizon-blend': 0.6,
            'horizon-color': '#e9f1f8', 'horizon-fog-blend': 0.5,
            'fog-color': '#dde8f1', 'fog-ground-blend': 0.7,
          } as any);
        } else {
          map.setTerrain(null);
        }
      } catch { /* terrain tiles unreachable → stay flat */ }
      // Earth view reads best on imagery — switch the basemap for the user.
      if (earth && useApp.getState().basemap !== 'satellite') useApp.getState().setBasemap('satellite');
    };
    map.isStyleLoaded() ? apply() : map.once('idle', apply);
    // camera tilt animates immediately, independent of tile loading
    map.easeTo({
      pitch: earth ? 68 : massing ? 55 : 0,
      bearing: earth ? -22 : massing ? -18 : 0,
      duration: 900,
    });
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
    // midpoint "add" handles — one per edge; clicking inserts a new point there
    (map.getSource('ed-mid') as maplibregl.GeoJSONSource)?.setData({
      type: 'FeatureCollection',
      features: ring.map((pt, i) => {
        const nxt = ring[(i + 1) % ring.length];
        return { type: 'Feature', id: i, properties: { i }, geometry: { type: 'Point', coordinates: [(pt[0] + nxt[0]) / 2, (pt[1] + nxt[1]) / 2] } };
      }),
    } as any);
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
    map.addSource('ed-mid', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as any });
    map.addLayer({ id: 'ed-fill', type: 'fill', source: 'ed-poly', paint: { 'fill-color': '#9A8A1E', 'fill-opacity': 0.15 } });
    map.addLayer({ id: 'ed-line', type: 'line', source: 'ed-poly', paint: { 'line-color': '#9A8A1E', 'line-width': 2, 'line-dasharray': [2, 1] } });
    // midpoint "+" handles (hollow gold), shown between vertices to add a new point
    map.addLayer({ id: 'ed-mid-l', type: 'circle', source: 'ed-mid', paint: { 'circle-radius': 5, 'circle-color': '#9A8A1E', 'circle-opacity': 0.9, 'circle-stroke-color': '#FBFCFA', 'circle-stroke-width': 1.6 } });
    map.addLayer({ id: 'ed-mid-plus', type: 'symbol', source: 'ed-mid', layout: { 'text-field': '+', 'text-size': 13, 'text-font': ['Open Sans Regular'], 'text-allow-overlap': true }, paint: { 'text-color': '#FBFCFA' } });
    map.addLayer({ id: 'ed-verts-l', type: 'circle', source: 'ed-verts', paint: { 'circle-radius': 6, 'circle-color': '#FBFCFA', 'circle-stroke-color': '#2F6B3E', 'circle-stroke-width': 2.4 } });
    refreshEdit();
    zoomTo(editGeom);

    const onDown = (e: any) => { e.preventDefault(); dragIdx.current = e.features?.[0]?.id ?? null; map.dragPan.disable(); map.getCanvas().style.cursor = 'grabbing'; };
    const onMove = (e: any) => { if (dragIdx.current == null) return; editRing.current[dragIdx.current] = [e.lngLat.lng, e.lngLat.lat]; refreshEdit(); };
    const onUp = () => { if (dragIdx.current != null) { dragIdx.current = null; map.dragPan.enable(); map.getCanvas().style.cursor = ''; } };
    const onVertEnter = () => { if (dragIdx.current == null) map.getCanvas().style.cursor = 'grab'; };
    const onVertDbl = (e: any) => { e.preventDefault(); const i = e.features?.[0]?.id; if (i == null || editRing.current.length <= 3) return; editRing.current.splice(i, 1); refreshEdit(); };
    const insertAt = (segIdx: number, c: [number, number]) => { editRing.current.splice(segIdx + 1, 0, c); refreshEdit(); };
    // click a "+" midpoint handle: insert a new point on that exact edge, then start dragging it
    const onMidDown = (e: any) => {
      e.preventDefault();
      const i = e.features?.[0]?.id; if (i == null) return;
      const c: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      insertAt(i, c);
      dragIdx.current = i + 1; map.dragPan.disable(); map.getCanvas().style.cursor = 'grabbing';
    };
    const onMidEnter = () => { if (dragIdx.current == null) map.getCanvas().style.cursor = 'copy'; };
    const onLineClick = (e: any) => {
      // also allow clicking anywhere on an edge to add a vertex at the nearest segment
      const c: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      const r = editRing.current; let best = 0, bestD = Infinity;
      for (let i = 0; i < r.length; i++) {
        const a = r[i], b = r[(i + 1) % r.length];
        const d = distToSeg(c, a as [number, number], b as [number, number]);
        if (d < bestD) { bestD = d; best = i; }
      }
      insertAt(best, c);
    };

    map.on('mousedown', 'ed-verts-l', onDown);
    map.on('mousedown', 'ed-mid-l', onMidDown);
    map.on('mousemove', onMove);
    map.on('mouseup', onUp);
    map.on('mouseenter', 'ed-verts-l', onVertEnter);
    map.on('mouseenter', 'ed-mid-l', onMidEnter);
    map.on('dblclick', 'ed-verts-l', onVertDbl);
    map.on('click', 'ed-fill', onLineClick);

    return () => {
      map.off('mousedown', 'ed-verts-l', onDown); map.off('mousedown', 'ed-mid-l', onMidDown); map.off('mousemove', onMove); map.off('mouseup', onUp);
      map.off('mouseenter', 'ed-verts-l', onVertEnter); map.off('mouseenter', 'ed-mid-l', onMidEnter); map.off('dblclick', 'ed-verts-l', onVertDbl); map.off('click', 'ed-fill', onLineClick);
      ['ed-fill', 'ed-line', 'ed-mid-l', 'ed-mid-plus', 'ed-verts-l'].forEach((l) => map.getLayer(l) && map.removeLayer(l));
      ['ed-poly', 'ed-verts', 'ed-mid'].forEach((s) => map.getSource(s) && map.removeSource(s));
      map.dragPan.enable();
    };
  }, [editGeom]);

  // ---------- measurement tool (straight distance/area + driving route) ----------
  const measurePts = useRef<number[][]>([]);
  const routeTok = useRef(0);
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (!measuring) { measurePts.current = []; setMeasure({ dist: 0, area: 0, n: 0 }); return; }
    const route = measureMode === 'route';

    map.addSource('ms-line', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as any });
    map.addSource('ms-route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as any });
    map.addSource('ms-pts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as any });
    map.addLayer({ id: 'ms-fill', type: 'fill', source: 'ms-line', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#2E7D6B', 'fill-opacity': 0.14 } });
    // road route: soft casing + solid line
    map.addLayer({ id: 'ms-route-case', type: 'line', source: 'ms-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FBFCFA', 'line-width': 7, 'line-opacity': 0.9 } });
    map.addLayer({ id: 'ms-route-l', type: 'line', source: 'ms-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#2F6B3E', 'line-width': 4 } });
    map.addLayer({ id: 'ms-line-l', type: 'line', source: 'ms-line', paint: { 'line-color': '#2E7D6B', 'line-width': 2.4, 'line-dasharray': [2, 1] } });
    map.addLayer({ id: 'ms-pts-l', type: 'circle', source: 'ms-pts', paint: { 'circle-radius': 4.5, 'circle-color': '#FBFCFA', 'circle-stroke-color': '#2E7D6B', 'circle-stroke-width': 2 } });
    map.getCanvas().style.cursor = 'crosshair';

    const hav = (a: number[], b: number[]) => {
      const R = 6371000, toR = Math.PI / 180;
      const dLat = (b[1] - a[1]) * toR, dLon = (b[0] - a[0]) * toR;
      const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toR) * Math.cos(b[1] * toR) * Math.sin(dLon / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(s));
    };
    const setSrc = (id: string, data: any) => (map.getSource(id) as maplibregl.GeoJSONSource)?.setData(data);
    const refresh = () => {
      const pts = measurePts.current;
      let dist = 0; for (let i = 1; i < pts.length; i++) dist += hav(pts[i - 1], pts[i]);
      let area = 0; if (!route && pts.length >= 3) area = geomArea({ type: 'Polygon', coordinates: [[...pts, pts[0]]] });
      const lineGeom = !route && pts.length >= 3
        ? { type: 'Polygon', coordinates: [[...pts, pts[0]]] }
        : { type: 'LineString', coordinates: pts.length ? pts : [] };
      setSrc('ms-line', pts.length ? { type: 'Feature', properties: {}, geometry: lineGeom } : { type: 'FeatureCollection', features: [] });
      setSrc('ms-pts', { type: 'FeatureCollection', features: pts.map((p) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } })) });
      setMeasure((m) => ({ ...m, dist, area, n: pts.length }));
    };
    // OSRM public server → real driving road path between the two points
    const fetchRoute = async (a: number[], b: number[]) => {
      const tok = ++routeTok.current;
      setMeasure((m) => ({ ...m, routing: true, routeErr: false, routeDist: undefined, routeDur: undefined }));
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${a[0]},${a[1]};${b[0]},${b[1]}?overview=full&geometries=geojson`;
        const r = await fetch(url); const j = await r.json();
        if (tok !== routeTok.current) return;
        const rt = j.routes?.[0];
        if (!rt) throw new Error('no route');
        setSrc('ms-route', { type: 'Feature', properties: {}, geometry: rt.geometry });
        setSrc('ms-line', { type: 'FeatureCollection', features: [] }); // hide the straight preview
        setMeasure((m) => ({ ...m, routing: false, routeDist: rt.distance, routeDur: rt.duration }));
      } catch {
        if (tok !== routeTok.current) return;
        setMeasure((m) => ({ ...m, routing: false, routeErr: true }));
      }
    };
    const onClick = (e: any) => {
      const pt = [e.lngLat.lng, e.lngLat.lat];
      if (route) {
        if (measurePts.current.length >= 2) { measurePts.current = []; setSrc('ms-route', { type: 'FeatureCollection', features: [] }); setMeasure((m) => ({ ...m, routeDist: undefined, routeDur: undefined, routeErr: false })); }
        measurePts.current.push(pt); refresh();
        if (measurePts.current.length === 2) fetchRoute(measurePts.current[0], measurePts.current[1]);
      } else { measurePts.current.push(pt); refresh(); }
    };
    const onDbl = (e: any) => { e.preventDefault(); };
    map.on('click', onClick);
    map.on('dblclick', onDbl);
    refresh();

    return () => {
      map.off('click', onClick); map.off('dblclick', onDbl);
      ['ms-fill', 'ms-route-case', 'ms-route-l', 'ms-line-l', 'ms-pts-l'].forEach((l) => map.getLayer(l) && map.removeLayer(l));
      ['ms-line', 'ms-route', 'ms-pts'].forEach((s) => map.getSource(s) && map.removeSource(s));
      map.getCanvas().style.cursor = '';
    };
  }, [measuring, measureMode]);

  const clearMeasure = () => {
    measurePts.current = []; routeTok.current++;
    const map = mapRef.current;
    if (map) ['ms-line', 'ms-route', 'ms-pts'].forEach((s) => (map.getSource(s) as maplibregl.GeoJSONSource)?.setData({ type: 'FeatureCollection', features: [] } as any));
    setMeasure({ dist: 0, area: 0, n: 0 });
  };

  // ---------- create a new plot (draw a polygon) ----------
  const createRing = useRef<number[][]>([]);
  const [createN, setCreateN] = useState(0);
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (!creating) { createRing.current = []; setCreateN(0); return; }
    map.addSource('cr-poly', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as any });
    map.addSource('cr-verts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as any });
    map.addLayer({ id: 'cr-fill', type: 'fill', source: 'cr-poly', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#9A8A1E', 'fill-opacity': 0.18 } });
    map.addLayer({ id: 'cr-line', type: 'line', source: 'cr-poly', paint: { 'line-color': '#9A8A1E', 'line-width': 2.4, 'line-dasharray': [2, 1] } });
    map.addLayer({ id: 'cr-verts-l', type: 'circle', source: 'cr-verts', paint: { 'circle-radius': 5, 'circle-color': '#FBFCFA', 'circle-stroke-color': '#9A8A1E', 'circle-stroke-width': 2.2 } });
    map.getCanvas().style.cursor = 'crosshair';
    const refresh = () => {
      const r = createRing.current;
      const geom = r.length >= 3 ? { type: 'Polygon', coordinates: [[...r, r[0]]] } : { type: 'LineString', coordinates: r };
      (map.getSource('cr-poly') as maplibregl.GeoJSONSource)?.setData(r.length ? { type: 'Feature', properties: {}, geometry: geom } as any : { type: 'FeatureCollection', features: [] } as any);
      (map.getSource('cr-verts') as maplibregl.GeoJSONSource)?.setData({ type: 'FeatureCollection', features: r.map((p) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } })) } as any);
      setCreateN(r.length);
    };
    const onClick = (e: any) => { createRing.current.push([e.lngLat.lng, e.lngLat.lat]); refresh(); };
    map.on('click', onClick);
    refresh();
    return () => {
      map.off('click', onClick);
      ['cr-fill', 'cr-line', 'cr-verts-l'].forEach((l) => map.getLayer(l) && map.removeLayer(l));
      ['cr-poly', 'cr-verts'].forEach((s) => map.getSource(s) && map.removeSource(s));
      map.getCanvas().style.cursor = '';
    };
  }, [creating]);

  const undoCreatePt = () => { createRing.current.pop(); const map = mapRef.current; if (!map) return; const r = createRing.current; const geom = r.length >= 3 ? { type: 'Polygon', coordinates: [[...r, r[0]]] } : { type: 'LineString', coordinates: r }; (map.getSource('cr-poly') as maplibregl.GeoJSONSource)?.setData(r.length ? { type: 'Feature', properties: {}, geometry: geom } as any : { type: 'FeatureCollection', features: [] } as any); (map.getSource('cr-verts') as maplibregl.GeoJSONSource)?.setData({ type: 'FeatureCollection', features: r.map((p) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } })) } as any); setCreateN(r.length); };

  const saveCreate = async () => {
    const r = createRing.current; if (r.length < 3) return;
    const geom: any = { type: 'Polygon', coordinates: [[...r, r[0]]] };
    const area = Math.round(geomArea(geom));
    const lang = useApp.getState().lang;
    const nf = new Intl.NumberFormat('en-US');
    const dfltCode = 'NEW-' + Date.now().toString(36).slice(-4).toUpperCase();
    const res = await useDialog.getState().open({
      title: t('cr.title', lang),
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      body: (<p style={{ margin: 0 }}>{t('cr.area', lang)}: <b>{nf.format(area)} m²</b></p>),
      fields: [
        { key: 'code', label: t('cr.code', lang), value: dfltCode },
        { key: 'name', label: t('a.nameEn', lang), value: '' },
      ],
      buttons: [{ label: t('a.cancel', lang), value: 'cancel' }, { label: t('cr.save', lang), value: 'ok', variant: 'primary' }],
    });
    if (res.value !== 'ok') return;
    const code = (res.fields.code || '').trim() || dfltCode;
    const firstLu = Object.keys(LAND_USES)[0];
    useOverrides.getState().addCreatedPlot({ code, name_en: res.fields.name || undefined, land_use: firstLu, sector: 'Central', area, geometry: geom });
    useApp.getState().setCreating(false);
    setTimeout(() => { const f = dataRef.current?.features.find((x) => x.properties.code === code); if (f) { useApp.getState().select(f.properties); useApp.getState().requestZoom(code); } }, 250);
  };

  const saveShape = async () => {
    const meta = editMeta.current; if (!meta) return;
    const ring = [...editRing.current, editRing.current[0]];
    let geom: any;
    if (meta.geomType === 'Polygon') geom = { type: 'Polygon', coordinates: [ring] };
    else { const coords = meta.rest.coordinates.map((p: any) => p); coords[0] = [ring]; geom = { type: 'MultiPolygon', coordinates: coords }; }
    useOverrides.getState().setGeometry(meta.code, geom);
    useApp.getState().setEditGeom(null);

    // Ask what to do with the area: apply the recomputed value, edit it, or keep current.
    const cur = dataRef.current?.features.find((f) => f.properties.code === meta.code)?.properties as PlotProps | undefined;
    const far = cur?.far ?? null;
    const oldArea = Math.round(cur?.area ?? 0), oldGfa = Math.round(cur?.gfa ?? 0);
    const newArea = Math.round(geomArea(geom));
    const newGfa = far ? Math.round(far * newArea) : oldGfa;
    const lang = useApp.getState().lang;
    const nf = new Intl.NumberFormat('en-US');
    const delta = newArea - oldArea;
    const body = (
      <div>
        <p style={{ margin: '0 0 4px' }}>{t('shape.intro', lang)}</p>
        <div className="dlg-cmp">
          <div className="dlg-cmp-row">
            <span className="l">{t('d.area', lang)} (m²)</span>
            <span className="old">{nf.format(oldArea)}</span>
            <span className={`new ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}>{nf.format(newArea)}{delta ? ` (${delta > 0 ? '+' : ''}${nf.format(delta)})` : ''}</span>
          </div>
          <div className="dlg-cmp-row">
            <span className="l">GFA</span>
            <span className="old">{nf.format(oldGfa)}</span>
            <span className="new">{nf.format(newGfa)}</span>
          </div>
        </div>
      </div>
    );
    const r = await useDialog.getState().open({
      title: t('shape.title', lang),
      body,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      fields: [
        { key: 'area', label: `${t('d.area', lang)} (m²)`, value: newArea, type: 'number' },
        { key: 'gfa', label: 'GFA', value: newGfa, type: 'number' },
      ],
      buttons: [
        { label: t('shape.keep', lang), value: 'keep' },
        { label: t('shape.apply', lang), value: 'apply', variant: 'primary' },
      ],
    });
    if (r.value === 'apply') {
      const a = Math.round(Number(r.fields.area)) || newArea;
      const g = Math.round(Number(r.fields.gfa)) || newGfa;
      useOverrides.getState().setPlotAttr(meta.code, { area: a, gfa: g } as any);
    }
    // 'keep' or dismissed → geometry updated, area/GFA left unchanged
  };
  const resetShape = () => {
    const meta = editMeta.current; const map = mapRef.current; if (!meta || !map) return;
    const base = dataRef.current?.features.find((f) => f.properties.code === meta.code);
    if (!base) return;
    const g: any = base.geometry;
    editRing.current = (g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]).slice(0, -1).map((p: number[]) => [...p]);
    refreshEdit();
  };

  // ---------- annotations render ----------
  const renderAnnot = (annos: Annotation[]) => {
    const map = mapRef.current; if (!map) return;
    const lines: any[] = []; const polys: any[] = [];
    const F = (type: string, coords: any, a: Annotation) => ({ type: 'Feature', properties: { id: a.id, color: a.color }, geometry: { type, coordinates: coords } });
    for (const a of annos) {
      if (a.kind === 'arrow') { const [s, e] = a.coords; lines.push(F('LineString', [s, e], a)); for (const seg of arrowHead(s, e)) lines.push(F('LineString', seg, a)); }
      else if (a.kind === 'rect') { polys.push(F('Polygon', [a.coords], a)); }
    }
    (map.getSource('annot-lines') as maplibregl.GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: lines } as any);
    (map.getSource('annot-polys') as maplibregl.GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: polys } as any);
    const seen = new Set<string>();
    for (const a of annos) if (a.kind === 'text') {
      seen.add(a.id);
      let m = markersRef.current.get(a.id);
      if (!m) {
        const el = document.createElement('div'); el.className = 'annot-label';
        const dot = document.createElement('span'); dot.className = 'al-dot';
        const txt = document.createElement('span'); txt.className = 'al-text';
        const del = document.createElement('button'); del.className = 'al-del'; del.type = 'button'; del.textContent = '×';
        el.append(dot, txt, del);
        m = new maplibregl.Marker({ element: el, anchor: 'center', draggable: canAnnotRef.current }).setLngLat(a.coords as [number, number]).addTo(map);
        markersRef.current.set(a.id, m);
        del.onclick = (ev) => { ev.stopPropagation(); useOverrides.getState().removeAnnotation(a.id); };
        txt.addEventListener('blur', () => useOverrides.getState().updateAnnotation(a.id, { text: txt.textContent || '' }));
        txt.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') { e.preventDefault(); (txt as HTMLElement).blur(); } });
        m.on('dragend', () => { const ll = m!.getLngLat(); useOverrides.getState().updateAnnotation(a.id, { coords: [ll.lng, ll.lat] }); });
      }
      const el = m.getElement();
      const txtEl = el.querySelector('.al-text') as HTMLElement;
      const delEl = el.querySelector('.al-del') as HTMLElement;
      el.classList.toggle('editable', canAnnotRef.current);
      txtEl.contentEditable = canAnnotRef.current ? 'true' : 'false';
      delEl.style.display = canAnnotRef.current ? '' : 'none';
      el.style.setProperty('--al-color', a.color);
      if (document.activeElement !== txtEl) txtEl.textContent = a.text || '';
      m.setDraggable(canAnnotRef.current);
      if (document.activeElement !== txtEl) { const cur = m.getLngLat(); if (cur.lng !== a.coords[0] || cur.lat !== a.coords[1]) m.setLngLat(a.coords as [number, number]); }
      if (focusIdRef.current === a.id) { focusIdRef.current = null; setTimeout(() => txtEl.focus(), 30); }
    }
    for (const [id, m] of markersRef.current) { if (!seen.has(id)) { m.remove(); markersRef.current.delete(id); } }
  };

  useEffect(() => {
    annotRef.current = annotations;
    const map = mapRef.current; if (!map) return;
    const apply = () => renderAnnot(annotations);
    map.isStyleLoaded() ? apply() : map.once('idle', apply);
  }, [annotations]);

  return (
    <>
      <div ref={ref} style={{ position: 'absolute', top: 0, bottom: 0, insetInlineStart: 'var(--rail-w)', insetInlineEnd: 0 }} />
      {editGeom && (
        <div className="geo-toolbar">
          <span className="geo-hint">{t('g.addPoint', lang)}</span>
          <div className="geo-actions">
            <button className="btn" onClick={resetShape}>{t('g.reset', lang)}</button>
            <button className="btn" onClick={() => useApp.getState().setEditGeom(null)}>{t('g.cancel', lang)}</button>
            <button className="btn primary" onClick={saveShape}>{t('g.save', lang)}</button>
          </div>
        </div>
      )}
      {creating && (
        <div className="geo-toolbar">
          <span className="geo-hint">{t('cr.hint', lang)} · {createN} {t('cr.points', lang)}</span>
          <div className="geo-actions">
            <button className="btn" disabled={createN === 0} onClick={undoCreatePt}>{t('cr.undo', lang)}</button>
            <button className="btn" onClick={() => useApp.getState().setCreating(false)}>{t('g.cancel', lang)}</button>
            <button className="btn primary" disabled={createN < 3} onClick={saveCreate}>{t('cr.save', lang)}</button>
          </div>
        </div>
      )}
      {measuring && (
        <div className="meas-panel" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <div className="meas-title">{t('meas.title', lang)}</div>
          <div className="meas-seg">
            <button className={measureMode === 'line' ? 'on' : ''} onClick={() => useApp.getState().setMeasureMode('line')}>{t('meas.modeLine', lang)}</button>
            <button className={measureMode === 'route' ? 'on' : ''} onClick={() => useApp.getState().setMeasureMode('route')}>{t('meas.modeRoute', lang)}</button>
          </div>

          {measureMode === 'line' ? (
            <>
              <div className="meas-readout">
                <div className="meas-stat"><span className="meas-l">{t('meas.distance', lang)}</span><b>{measure.dist >= 1000 ? `${(measure.dist / 1000).toFixed(2)} km` : `${Math.round(measure.dist)} m`}</b></div>
                <div className="meas-stat"><span className="meas-l">{t('meas.area', lang)}</span><b>{measure.area >= 1e4 ? `${(measure.area / 1e4).toFixed(2)} ha` : `${Math.round(measure.area)} m²`}</b></div>
              </div>
              {measure.dist > 0 && (
                <div className="meas-time">
                  <div className="meas-time-h">{t('meas.time', lang)} <span className="meas-est">({t('meas.est', lang)})</span></div>
                  <div className="meas-time-row"><span className="mt-mode"><IconWalk size={14} /> {t('meas.walk', lang)}</span><b>{fmtDuration(measure.dist / 1.39, lang)}</b></div>
                  <div className="meas-time-row"><span className="mt-mode"><IconCar size={14} /> {t('meas.drive', lang)}</span><b>{fmtDuration(measure.dist / 11.1, lang)}</b></div>
                </div>
              )}
            </>
          ) : (
            <div className="meas-readout">
              <div className="meas-stat"><span className="meas-l"><IconCar size={14} /> {t('meas.roadDist', lang)}</span>
                <b>{measure.routing ? '…' : measure.routeDist != null ? (measure.routeDist >= 1000 ? `${(measure.routeDist / 1000).toFixed(2)} km` : `${Math.round(measure.routeDist)} m`) : '—'}</b></div>
              <div className="meas-stat"><span className="meas-l"><IconClock size={14} /> {t('meas.roadTime', lang)}</span>
                <b>{measure.routing ? '…' : measure.routeDur != null ? fmtDuration(measure.routeDur, lang) : '—'}</b></div>
              {measure.routeErr && <div className="meas-err">{t('meas.routeErr', lang)}</div>}
            </div>
          )}

          <div className="meas-hint">{measureMode === 'route' ? t('meas.routeHint', lang) : measure.n < 2 ? t('meas.twoPts', lang) : t('meas.hint', lang)}</div>
          <div className="meas-acts">
            <button className="btn sm" onClick={clearMeasure}>{t('meas.clear', lang)}</button>
            <button className="btn sm primary" onClick={() => useApp.getState().setMeasuring(false)}>{t('meas.done', lang)}</button>
          </div>
        </div>
      )}
    </>
  );
}

/** Two short segments forming an arrowhead at `e`, pointing along s→e. */
function arrowHead(s: number[], e: number[]): number[][][] {
  const cosLat = Math.max(0.2, Math.cos((e[1] * Math.PI) / 180));
  const dx = (e[0] - s[0]) * cosLat, dy = e[1] - s[1];
  const ang = Math.atan2(dy, dx);
  const size = 0.00030;
  const seg = (a: number): number[][] => [e, [e[0] + (Math.cos(a) * size) / cosLat, e[1] + Math.sin(a) * size]];
  return [seg(ang + Math.PI - 0.5), seg(ang + Math.PI + 0.5)];
}

function distToSeg(p: [number, number], a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = a[0] + t * dx, cy = a[1] + t * dy;
  return Math.hypot(p[0] - cx, p[1] - cy);
}
