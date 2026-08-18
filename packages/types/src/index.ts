/**
 * @kec/types — shared source of truth for the KEC GIS platform.
 * Imported by both apps/web and apps/api. Never duplicate these definitions.
 */

// ---------- Plot schema ----------
export interface PlotProps {
  code: string;          // stable internal ID, e.g. "S19"
  name: string | null;   // friendly / destination name; defaults to code
  land_use: LandUseKey | null;
  sector: SectorKey;
  gfa: number | null;    // m²
  area: number | null;   // m²
  floors: number | null;
  height: number | null; // m
  coverage: number | null;
  far: number | null;
  style?: string | null;      // KMZ provenance
  planStatus?: string | null; // set when the plot is in the development plan (status key)
}

export type PlotFeature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, PlotProps>;
export type PlotCollection = GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  PlotProps
>;

// ---------- Land-use catalogue (17, from GIS KEC.kmz) ----------
export interface LandUse {
  key: string;
  labelAr: string;
  color: string;
}

export const LAND_USES: Record<string, LandUse> = {
  'Low/Med Density Residential':              { key: 'Low/Med Density Residential',              labelAr: 'سكني منخفض/متوسط الكثافة', color: '#F2D8A7' },
  'Medium Density Residential':               { key: 'Medium Density Residential',               labelAr: 'سكني متوسط الكثافة',       color: '#E9C583' },
  'High Density Residential & Commercial':    { key: 'High Density Residential & Commercial',    labelAr: 'سكني تجاري عالي الكثافة',  color: '#E39A54' },
  'Low/Med Density Residential & Commercial': { key: 'Low/Med Density Residential & Commercial', labelAr: 'سكني تجاري منخفض/متوسط',   color: '#EDC58C' },
  'Medium Density Residential & Commercial':  { key: 'Medium Density Residential & Commercial',  labelAr: 'سكني تجاري متوسط الكثافة', color: '#E3B36B' },
  'High Density Mixed-Use':                   { key: 'High Density Mixed-Use',                   labelAr: 'استخدام مختلط عالي الكثافة',color: '#D97E4E' },
  'Medium Density Mixed-Use':                 { key: 'Medium Density Mixed-Use',                 labelAr: 'استخدام مختلط متوسط',      color: '#E0A277' },
  'Commercial':                               { key: 'Commercial',                               labelAr: 'تجاري',                   color: '#C85C4E' },
  'Cultural & Commercial':                    { key: 'Cultural & Commercial',                    labelAr: 'ثقافي وتجاري',            color: '#B5588F' },
  'Offices':                                  { key: 'Offices',                                  labelAr: 'مكاتب',                   color: '#8A6D4F' },
  'Hospitality':                              { key: 'Hospitality',                              labelAr: 'ضيافة',                   color: '#9C6BB0' },
  'Medical':                                  { key: 'Medical',                                  labelAr: 'طبي',                     color: '#D06B84' },
  'Education':                                { key: 'Education',                                labelAr: 'تعليمي',                  color: '#5B8FB0' },
  'Community Facilities':                     { key: 'Community Facilities',                     labelAr: 'مرافق مجتمعية',           color: '#4FA5A0' },
  'Open Space':                               { key: 'Open Space',                               labelAr: 'مساحات مفتوحة',           color: '#88BF6A' },
  'Utilities':                                { key: 'Utilities',                                labelAr: 'مرافق وبنية تحتية',       color: '#9AA0A6' },
  'Train station and reservation':            { key: 'Train station and reservation',            labelAr: 'محطة قطار ومحمية',        color: '#6D7B8A' },
};
export type LandUseKey = keyof typeof LAND_USES | string;
export const LAND_USE_FALLBACK = '#C9C9C9';

// ---------- Sectors (derived from code prefix) ----------
export const SECTORS = {
  North:   { key: 'North',   labelAr: 'شمال', prefix: 'N' },
  South:   { key: 'South',   labelAr: 'جنوب', prefix: 'S' },
  Central: { key: 'Central', labelAr: 'وسط',  prefix: 'C' },
  East:    { key: 'East',    labelAr: 'شرق',  prefix: 'E' },
  West:    { key: 'West',    labelAr: 'غرب',  prefix: 'W' },
  Other:   { key: 'Other',   labelAr: 'أخرى', prefix: '?' },
} as const;
export type SectorKey = keyof typeof SECTORS;

export function sectorFromCode(code: string): SectorKey {
  const p = (code?.[0] ?? '').toUpperCase();
  const hit = (Object.values(SECTORS) as { key: SectorKey; prefix: string }[]).find(s => s.prefix === p);
  return (hit?.key ?? 'Other') as SectorKey;
}

// ---------- Roles & permissions ----------
export type Role = 'administrator' | 'editor' | 'contributor' | 'viewer';

export type Permission =
  | 'plot:view' | 'plot:attr:update' | 'plot:rename' | 'plot:geometry:update'
  | 'plot:create' | 'plot:delete'
  | 'doc:manage' | 'opportunity:manage'
  | 'admin:optionlists' | 'admin:users' | 'audit:view' | 'settings:manage'
  | 'export:view';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  administrator: [
    'plot:view','plot:attr:update','plot:rename','plot:geometry:update','plot:create','plot:delete',
    'doc:manage','opportunity:manage','admin:optionlists','admin:users','audit:view','settings:manage','export:view',
  ],
  editor: [
    'plot:view','plot:attr:update','plot:rename','plot:geometry:update','plot:create',
    'doc:manage','opportunity:manage','audit:view','export:view',
  ],
  contributor: ['plot:view','plot:attr:update','doc:manage','opportunity:manage','export:view'],
  viewer: ['plot:view','export:view'],
};

export function can(role: Role, perm: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

// ---------- Delivery status vocabulary ----------
export const STATUSES = {
  Completed:          { key: 'Completed',          labelAr: 'مكتمل',            color: '#2F6B3E' },
  UnderConstruction:  { key: 'UnderConstruction',  labelAr: 'تحت الإنشاء',      color: '#9A8A1E' },
  Future:             { key: 'Future',             labelAr: 'مستقبلي',          color: '#5C6B60' },
  Partner:            { key: 'Partner',            labelAr: 'مشاريع شركاء',     color: '#7E6F1B' },
} as const;
export type StatusKey = keyof typeof STATUSES;
