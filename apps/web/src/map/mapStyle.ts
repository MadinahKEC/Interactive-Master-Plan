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
    'Completed', '#2F6B3E', 'UnderConstruction', '#9A8A1E', 'Future', '#5C6B60', 'Partner', '#7E6F1B',
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
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      carto: {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        ],
        tileSize: 256,
        attribution: '© OpenStreetMap © CARTO',
      },
      cartoDark: {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        ],
        tileSize: 256,
        attribution: '© OpenStreetMap © CARTO',
      },
      esri: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: '© Esri World Imagery',
      },
      // labels-only overlays (drawn ABOVE the plots so place/street names stay legible)
      cartoLabels: {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}@2x.png',
        ],
        tileSize: 256,
      },
      esriLabels: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
      },
      plots: plotsSource,
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#EAF3E4' } },
      { id: 'base-light', type: 'raster', source: 'carto' },
      { id: 'base-dark', type: 'raster', source: 'cartoDark', layout: { visibility: 'none' } },
      { id: 'base-sat', type: 'raster', source: 'esri', layout: { visibility: 'none' } },
      {
        id: 'plots-fill', type: 'fill', source: 'plots', ...srcLayer,
        paint: {
          'fill-color': landUseColor(colors),
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
        id: 'plan-glow', type: 'line', source: 'plots', ...srcLayer,
        filter: ['has', 'planStatus'],
        paint: { 'line-color': planStatusColor(), 'line-width': 7, 'line-opacity': 0.22, 'line-blur': 3 },
      },
      {
        id: 'plan-outline', type: 'line', source: 'plots', ...srcLayer,
        filter: ['has', 'planStatus'],
        paint: { 'line-color': planStatusColor(), 'line-width': 2.6, 'line-opacity': 0.95, 'line-dasharray': [2, 1.4] },
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
          'fill-extrusion-color': landUseColor(colors),
          'fill-extrusion-height': height,
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.94,
          'fill-extrusion-vertical-gradient': true,
        },
      },
      {
        id: 'plots-label', type: 'symbol', source: 'plots', ...srcLayer, minzoom: 15.2,
        layout: { 'text-field': ['get', 'code'], 'text-font': ['Open Sans Regular'], 'text-size': 10 },
        paint: { 'text-color': '#143D1E', 'text-halo-color': '#FBFCFA', 'text-halo-width': 1.4 },
      },
      // place/street labels ON TOP of everything
      { id: 'labels-light', type: 'raster', source: 'cartoLabels', paint: { 'raster-opacity': 0.9 } },
      { id: 'labels-sat', type: 'raster', source: 'esriLabels', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.95 } },
    ],
  };
}
