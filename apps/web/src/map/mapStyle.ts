import type { StyleSpecification, ExpressionSpecification } from 'maplibre-gl';
import { LAND_USES, LAND_USE_FALLBACK } from '@kec/types';

export const KEC_CENTER: [number, number] = [39.678995, 24.469588];
export const KEC_BOUNDS: [[number, number], [number, number]] = [
  [39.65693, 24.45448],
  [39.70106, 24.48469],
];

/** Colour a development-plan plot outline by its project status. */
export function planStatusColor(): ExpressionSpecification {
  return ['match', ['get', 'planStatus'],
    'Completed', '#2F6B3E', 'UnderConstruction', '#9A8A1E', 'Future', '#5C6B60', 'Partner', '#7E6F1B', 'OnHold', '#B5462F',
    '#5C6B60'] as ExpressionSpecification;
}

/** MapLibre `match` expression: colour a plot by its land_use (colours overridable). */
export function landUseColor(colors?: Record<string, { color: string }>): ExpressionSpecification {
  const map = colors ?? LAND_USES;
  const expr: any[] = ['match', ['get', 'land_use']];
  for (const key of Object.keys(map)) {
    expr.push(key, map[key].color);
  }
  expr.push(LAND_USE_FALLBACK);
  return expr as ExpressionSpecification;
}

/** KEC-identity fill for development-plan plots: green body + gold outline, with a
 *  status-coloured glow (below) so the plan state stays readable. */
export const PLAN_FILL = '#2F6B3E';
/** Fill a plot by its land use, but flip to the plan colour when it's in the plan. */
export function plotFillColor(colors?: Record<string, { color: string }>, planFill: string = PLAN_FILL): ExpressionSpecification {
  return ['case', ['has', 'planStatus'], planFill, landUseColor(colors)] as ExpressionSpecification;
}

/**
 * Build the base style. If `tilesUrl` is provided (Martin MVT), the plots come from a
 * vector source; otherwise they come from a GeoJSON source (dev fallback, /plots.geojson).
 */
export function buildStyle(tilesUrl?: string, colors?: Record<string, { color: string }>): StyleSpecification {
  const plotsSource = tilesUrl
    ? { type: 'vector' as const, tiles: [tilesUrl], minzoom: 10, maxzoom: 20 }
    : { type: 'geojson' as const, data: { type: 'FeatureCollection', features: [] } as any, promoteId: 'code' };

  // vector tiles require a source-layer; geojson does not
  const srcLayer = tilesUrl ? { 'source-layer': 'plots' } : {};

  const height: ExpressionSpecification = [
    'coalesce',
    ['get', 'height'],
    ['*', ['coalesce', ['get', 'floors'], 1], 3],
  ] as ExpressionSpecification;

  return {
    version: 8,
    // Self-hosted glyphs (the public demo font CDN is unreachable/blocked in some
    // networks, which silently breaks ALL map text). The vendored 'Open Sans Regular'
    // 0–255 range covers every plot code.
    glyphs: import.meta.env.BASE_URL + 'fonts/{fontstack}/{range}.pbf',
    sources: {
      esri: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: '© Esri World Imagery',
      },
      // Free global DEM (AWS open-data terrarium tiles) for the Google-Earth-style
      // 3D view: real satellite imagery draped over real terrain. CORS-enabled.
      terrainDEM: {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 14,
        attribution: '© Mapzen / AWS Terrain Tiles',
      },
      // OpenFreeMap planet vector tiles (free, no key). Drives BOTH the clean light
      // basemap (real streets/water/buildings at high zoom over Medina — the Esri
      // canvas/street layers have no data there) and the 3D building footprints.
      ofm: { type: 'vector' as const, url: 'https://tiles.openfreemap.org/planet', attribution: 'OpenFreeMap © OpenMapTiles · OpenStreetMap' },
      plots: plotsSource,
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#eef1ec' } },
      // ── clean light vector basemap (OpenFreeMap / OpenMapTiles), ids prefixed basev- ──
      { id: 'basev-landcover', type: 'fill', source: 'ofm', 'source-layer': 'landcover',
        paint: { 'fill-color': ['match', ['get', 'class'], 'wood', '#dde7d6', 'grass', '#e6ede1', 'park', '#e2ece1', '#e8ece5'], 'fill-opacity': 0.7 } },
      { id: 'basev-water', type: 'fill', source: 'ofm', 'source-layer': 'water', paint: { 'fill-color': '#c4dcea' } },
      { id: 'basev-building', type: 'fill', source: 'ofm', 'source-layer': 'building', minzoom: 13.5,
        paint: { 'fill-color': '#e4e0d9', 'fill-outline-color': '#d3cec3', 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13.5, 0, 15, 0.75] } },
      { id: 'basev-road-casing', type: 'line', source: 'ofm', 'source-layer': 'transportation', minzoom: 11,
        filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#e2ddd2', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2, 16, 11, 19, 26] } },
      { id: 'basev-road', type: 'line', source: 'ofm', 'source-layer': 'transportation', minzoom: 11,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['match', ['get', 'class'], 'motorway', '#fdf3d3', 'trunk', '#fdf3d3', 'primary', '#ffffff', 'secondary', '#ffffff', 'tertiary', '#ffffff', '#f6f4ef'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.4, 14, 1.6, 16, 5, 19, 15] } },
      { id: 'base-sat', type: 'raster', source: 'esri', layout: { visibility: 'none' } },
      {
        id: 'plots-fill', type: 'fill', source: 'plots', ...srcLayer,
        paint: {
          'fill-color': plotFillColor(colors),
          'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.9, 0.58],
        },
      },
      {
        id: 'plots-line', type: 'line', source: 'plots', ...srcLayer,
        paint: {
          'line-color': '#143D1E',
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.3, 15, 0.7, 18, 1.4],
          'line-opacity': 0.55,
        },
      },
      // development-plan plots: soft glow + dashed status-coloured outline (always on)
      {
        // status-coloured glow (Completed / UnderConstruction / Future / Partner)
        id: 'plan-glow', type: 'line', source: 'plots', ...srcLayer,
        filter: ['has', 'planStatus'],
        paint: { 'line-color': planStatusColor(), 'line-width': 9, 'line-opacity': 0.5, 'line-blur': 3.5 },
      },
      {
        // constant gold identity border
        id: 'plan-outline', type: 'line', source: 'plots', ...srcLayer,
        filter: ['has', 'planStatus'],
        paint: { 'line-color': '#9A8A1E', 'line-width': 2.6, 'line-opacity': 1, 'line-dasharray': [2, 1.4] },
      },
      {
        id: 'plots-multi', type: 'fill', source: 'plots', ...srcLayer,
        paint: { 'fill-color': '#9A8A1E', 'fill-opacity': 0.28 },
        filter: ['in', ['get', 'code'], ['literal', []]],
      },
      {
        id: 'plots-sel-fill', type: 'fill', source: 'plots', ...srcLayer,
        paint: { 'fill-color': '#9A8A1E', 'fill-opacity': 0.32 },
        filter: ['==', ['get', 'code'], ''],
      },
      {
        id: 'plots-sel', type: 'line', source: 'plots', ...srcLayer,
        paint: { 'line-color': '#9A8A1E', 'line-width': 3.4, 'line-opacity': 1 },
        filter: ['==', ['get', 'code'], ''],
      },
      {
        id: 'plots-multi-line', type: 'line', source: 'plots', ...srcLayer,
        paint: { 'line-color': '#9A8A1E', 'line-width': 2.2, 'line-opacity': 0.95 },
        filter: ['in', ['get', 'code'], ['literal', []]],
      },
      {
        id: 'plots-3d', type: 'fill-extrusion', source: 'plots', ...srcLayer,
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': plotFillColor(colors),
          'fill-extrusion-height': height,
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.94,
          'fill-extrusion-vertical-gradient': true,
        },
      },
      // real OSM buildings extruded — the "clear 3D objects" of the Earth view
      {
        id: 'ofm-3d-buildings', type: 'fill-extrusion', source: 'ofm', 'source-layer': 'building',
        minzoom: 13, layout: { visibility: 'none' },
        filter: ['!=', ['get', 'hide_3d'], true],
        paint: {
          'fill-extrusion-color': [
            'interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 6],
            0, '#efe9df', 25, '#e2dccf', 80, '#cfc6b4', 200, '#b9ad96',
          ],
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.92,
          'fill-extrusion-vertical-gradient': true,
        },
      },
      {
        // plot-code labels — hidden by default, toggled from the panel. Collision is
        // on (allow-overlap:false) so only non-overlapping codes show → clean at any
        // zoom; larger plots win the collision via symbol-sort-key.
        id: 'plots-label', type: 'symbol', source: 'plots', ...srcLayer, minzoom: 11.5,
        layout: {
          visibility: 'none',
          'text-field': ['get', 'code'],
          'text-font': ['Open Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 11.5, 9.5, 14, 11.5, 17, 13.5],
          'text-allow-overlap': false,
          'text-padding': 6,
          'symbol-sort-key': ['-', 0, ['coalesce', ['get', 'area'], 0]],
        },
        paint: { 'text-color': '#143D1E', 'text-halo-color': '#FBFCFA', 'text-halo-width': 1.7, 'text-halo-blur': 0.3 },
      },
      // ── place / landmark / street labels — ON TOP of everything, shown in BOTH
      // light and satellite modes. Latin names only (the vendored Open Sans glyph
      // range renders Latin; Arabic-only names resolve to empty and are skipped).
      // Colours are re-tinted per basemap by MapView (dark on light, white on sat).
      { id: 'basev-place', type: 'symbol', source: 'ofm', 'source-layer': 'place', minzoom: 8,
        filter: ['all', ['in', ['get', 'class'], ['literal', ['city', 'town', 'suburb', 'neighbourhood', 'quarter', 'village']]], ['any', ['has', 'name:en'], ['has', 'name:latin']]],
        layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name:latin']], 'text-font': ['Open Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 9, 11, 14, 13.5, 17, 16], 'text-max-width': 7 },
        paint: { 'text-color': '#ffffff', 'text-halo-color': '#143D1E', 'text-halo-width': 1.7 } },
      // notable Medina landmarks (mosques, universities, hospitals, attractions…)
      { id: 'basev-poi', type: 'symbol', source: 'ofm', 'source-layer': 'poi', minzoom: 13.5,
        filter: ['all', ['in', ['get', 'class'], ['literal', ['place_of_worship', 'college', 'university', 'hospital', 'attraction', 'stadium', 'museum', 'park', 'government', 'townhall', 'landmark']]], ['any', ['has', 'name:en'], ['has', 'name:latin']]],
        layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name:latin']], 'text-font': ['Open Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 13.5, 10.5, 17, 13], 'text-max-width': 8,
          'symbol-sort-key': ['coalesce', ['get', 'rank'], 99] },
        paint: { 'text-color': '#FBE7A8', 'text-halo-color': '#143D1E', 'text-halo-width': 1.6 } },
      { id: 'basev-road-name', type: 'symbol', source: 'ofm', 'source-layer': 'transportation_name', minzoom: 13.5,
        filter: ['any', ['has', 'name:en'], ['has', 'name:latin']],
        layout: { 'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name:latin']], 'text-font': ['Open Sans Regular'], 'text-size': 11.5 },
        paint: { 'text-color': '#ffffff', 'text-halo-color': '#16221B', 'text-halo-width': 1.5 } },
    ],
  };
}
