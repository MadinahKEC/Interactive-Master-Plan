/**
 * Curated major landmarks of Al-Madinah Al-Munawwarah, shown as premium DOM
 * markers on the map (bilingual, so rendered as HTML — not glyph symbols — to
 * support Arabic without vendoring the full Arabic glyph range).
 *
 * `tier`: 1 = flagship (visible from a wide zoom), 2 = shown when zoomed in a bit.
 * Coordinates are [lon, lat] (WGS84), placed at each site for a labelled dot.
 */
export interface Landmark {
  name_ar: string;
  name_en: string;
  lon: number;
  lat: number;
  tier: 1 | 2;
  icon?: 'mosque' | 'mount' | 'airport' | 'edu' | 'city';
}

export const MEDINA_LANDMARKS: Landmark[] = [
  { name_ar: 'المسجد النبوي الشريف', name_en: 'Al-Masjid an-Nabawi', lon: 39.6112, lat: 24.4672, tier: 1, icon: 'mosque' },
  { name_ar: 'مسجد قباء', name_en: 'Quba Mosque', lon: 39.6172, lat: 24.4398, tier: 1, icon: 'mosque' },
  { name_ar: 'جبل أُحُد', name_en: 'Mount Uhud', lon: 39.6151, lat: 24.5100, tier: 1, icon: 'mount' },
  { name_ar: 'مسجد القبلتين', name_en: 'Masjid al-Qiblatayn', lon: 39.5788, lat: 24.4843, tier: 2, icon: 'mosque' },
  { name_ar: 'مقبرة البقيع', name_en: 'Al-Baqiʿ Cemetery', lon: 39.6165, lat: 24.4665, tier: 2, icon: 'mosque' },
  { name_ar: 'المساجد السبعة', name_en: 'The Seven Mosques', lon: 39.5930, lat: 24.4870, tier: 2, icon: 'mosque' },
  { name_ar: 'مجمع الملك فهد لطباعة المصحف', name_en: 'King Fahd Qurʾan Complex', lon: 39.5765, lat: 24.4530, tier: 2, icon: 'city' },
  { name_ar: 'الجامعة الإسلامية بالمدينة', name_en: 'Islamic University of Madinah', lon: 39.5720, lat: 24.4515, tier: 2, icon: 'edu' },
  { name_ar: 'مطار الأمير محمد بن عبدالعزيز', name_en: 'Prince Mohammad Airport', lon: 39.7051, lat: 24.5534, tier: 2, icon: 'airport' },
  { name_ar: 'مدينة المعرفة الاقتصادية', name_en: 'Knowledge Economic City', lon: 39.6790, lat: 24.4696, tier: 1, icon: 'city' },
];
