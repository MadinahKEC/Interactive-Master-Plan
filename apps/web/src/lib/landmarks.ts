/**
 * Al-Madinah Al-Munawwarah landmarks & points of interest.
 *
 * The dataset (public/landmarks.json, ~800 places from OpenStreetMap) is loaded
 * at runtime and rendered as premium bilingual DOM markers. Flagship sites are
 * curated (tier 1); the rest are real POIs across categories (tiers 2–3), shown
 * viewport- and zoom-aware so the map never clutters.
 */
import { useEffect, useState } from 'react';

export interface Landmark {
  na: string;   // Arabic name
  ne: string;   // English name
  lat: number;
  lon: number;
  c: string;    // category key
  t: 1 | 2 | 3; // tier (1 = flagship)
}

export interface LmCategory { key: string; ar: string; en: string; color: string; icon: string }
/** Category catalogue: colour + glyph for each POI family. */
export const LM_CATEGORIES: LmCategory[] = [
  { key: 'religious', ar: 'مساجد ومعالم دينية', en: 'Mosques & religious', color: '#2F6B3E', icon: '🕌' },
  { key: 'heritage',  ar: 'مواقع تاريخية وثقافية', en: 'Heritage & culture', color: '#9A8A1E', icon: '🏛️' },
  { key: 'shopping',  ar: 'مولات ومراكز تسوّق', en: 'Malls & shopping', color: '#B5723A', icon: '🛍️' },
  { key: 'grocery',   ar: 'أسواق ومتاجر', en: 'Markets & stores', color: '#A8873A', icon: '🛒' },
  { key: 'hotel',     ar: 'فنادق وإقامة', en: 'Hotels & stays', color: '#2E7D6B', icon: '🏨' },
  { key: 'leisure',   ar: 'ترفيه وحدائق', en: 'Leisure & parks', color: '#4E8B4A', icon: '🌳' },
  { key: 'education', ar: 'تعليم', en: 'Education', color: '#3A6BB5', icon: '🎓' },
  { key: 'health',    ar: 'صحة ومستشفيات', en: 'Health', color: '#B5462F', icon: '🏥' },
  { key: 'transport', ar: 'نقل ومطارات', en: 'Transport', color: '#5C6B60', icon: '✈️' },
  { key: 'city',      ar: 'مشاريع ومدن', en: 'Cities & projects', color: '#143D1E', icon: '🏙️' },
];
export const LM_CAT_MAP: Record<string, LmCategory> = Object.fromEntries(LM_CATEGORIES.map((c) => [c.key, c]));
export const LM_CAT_KEYS = LM_CATEGORIES.map((c) => c.key);

/** Load the landmark dataset once (cached). */
export function useLandmarks(): Landmark[] {
  const [list, setList] = useState<Landmark[]>([]);
  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'landmarks.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((j: Landmark[]) => setList(Array.isArray(j) ? j : []))
      .catch(() => setList([]));
  }, []);
  return list;
}
