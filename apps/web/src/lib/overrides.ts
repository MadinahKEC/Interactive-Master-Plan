import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProjectInfo } from './domain';

/**
 * Local (browser) persistence layer for admin edits. Everything the admin console
 * changes is stored here and merged into the base data at render time. When the real
 * backend (apps/api) is available, these actions get swapped for API calls — the shape
 * stays the same.
 */
export interface AuditEntry {
  at: number;
  actor: string;
  action: string;   // 'plot.attr' | 'plot.project' | 'landuse.color' | 'user.add' | ...
  target?: string;  // plot code / land-use key / user email
  detail: string;
}
export interface LandUseOverride { color?: string; labelAr?: string; labelEn?: string }
export interface AdminUser { id: string; name: string; email: string; role: string; active: boolean }
export type PlotAttrOverride = Partial<Record<'land_use' | 'sector' | 'gfa' | 'area' | 'floors' | 'height' | 'coverage' | 'far' | 'name', string | number | null>>;
/** GeoJSON geometry override for a plot (from the shape editor). */
export interface GeomOverride { type: 'Polygon' | 'MultiPolygon'; coordinates: any }
/** A merged ownership unit built from >=2 source plots. */
export interface MergeRecord {
  id: string;            // e.g. 'M-1712…'
  codes: string[];       // source plot codes
  name_ar?: string; name_en?: string;
  owner?: string;
}
/** One piece produced by subdividing a plot. */
export interface SubPlotRecord {
  code: string;
  name_ar?: string; name_en?: string;
  land_use: string;
  area: number; gfa?: number; floors?: number; height?: number; coverage?: number; far?: number;
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: any };
}
/** A free annotation drawn on the map (admin only). */
export interface Annotation {
  id: string;
  kind: 'text' | 'arrow' | 'rect';
  color: string;
  coords: any;           // text:[lng,lat] · arrow:[[lng,lat],[lng,lat]] · rect: ring [[lng,lat]...]
  text?: string;
}

interface OverridesState {
  plotAttrs: Record<string, PlotAttrOverride>;
  projects: Record<string, ProjectInfo>;
  landUses: Record<string, LandUseOverride>;
  plotGeom: Record<string, GeomOverride>;
  merges: MergeRecord[];
  splits: Record<string, SubPlotRecord[]>;
  annotations: Annotation[];
  users: AdminUser[];
  audit: AuditEntry[];

  setPlotAttr: (code: string, patch: PlotAttrOverride, actor?: string) => void;
  setProject: (code: string, patch: ProjectInfo, actor?: string) => void;
  setLandUse: (key: string, patch: LandUseOverride, actor?: string) => void;
  setGeometry: (code: string, geom: GeomOverride, actor?: string) => void;
  resetGeometry: (code: string) => void;
  mergePlots: (codes: string[], patch?: Partial<MergeRecord>, actor?: string) => string;
  unmerge: (id: string) => void;
  subdividePlot: (parentCode: string, parts: SubPlotRecord[], actor?: string) => void;
  unsubdivide: (parentCode: string) => void;
  addAnnotation: (a: Omit<Annotation, 'id'>) => string;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  removeAnnotation: (id: string) => void;
  clearAnnotations: () => void;
  addUser: (u: Omit<AdminUser, 'id'>, actor?: string) => void;
  updateUser: (id: string, patch: Partial<AdminUser>) => void;
  removeUser: (id: string) => void;
  log: (e: Omit<AuditEntry, 'at'>) => void;
  exportAll: () => string;
  importAll: (json: string) => boolean;
  reset: () => void;
}

export const SUPER_ADMIN_EMAIL = 'shamdan@madinahkec.com';
export const seedUsers: AdminUser[] = [
  { id: 'u-super', name: 'Administrator', email: SUPER_ADMIN_EMAIL, role: 'administrator', active: true },
];

export const useOverrides = create<OverridesState>()(
  persist(
    (set, get) => ({
      plotAttrs: {},
      projects: {},
      landUses: {},
      plotGeom: {},
      merges: [],
      splits: {},
      annotations: [],
      users: seedUsers,
      audit: [],

      log: (e) => set((s) => ({ audit: [{ ...e, at: Date.now() }, ...s.audit].slice(0, 500) })),

      setPlotAttr: (code, patch, actor = 'admin') =>
        set((s) => {
          const detail = Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(', ');
          return {
            plotAttrs: { ...s.plotAttrs, [code]: { ...s.plotAttrs[code], ...patch } },
            audit: [{ at: Date.now(), actor, action: 'plot.attr', target: code, detail }, ...s.audit].slice(0, 500),
          };
        }),

      setProject: (code, patch, actor = 'admin') =>
        set((s) => ({
          projects: { ...s.projects, [code]: { ...s.projects[code], ...patch } },
          audit: [{ at: Date.now(), actor, action: 'plot.project', target: code, detail: patch.name_ar || patch.name_en || 'updated' }, ...s.audit].slice(0, 500),
        })),

      setLandUse: (key, patch, actor = 'admin') =>
        set((s) => ({
          landUses: { ...s.landUses, [key]: { ...s.landUses[key], ...patch } },
          audit: [{ at: Date.now(), actor, action: 'landuse.edit', target: key, detail: JSON.stringify(patch) }, ...s.audit].slice(0, 500),
        })),

      setGeometry: (code, geom, actor = 'admin') =>
        set((s) => ({
          plotGeom: { ...s.plotGeom, [code]: geom },
          audit: [{ at: Date.now(), actor, action: 'plot.geometry', target: code, detail: 'shape edited' }, ...s.audit].slice(0, 500),
        })),
      resetGeometry: (code) =>
        set((s) => { const g = { ...s.plotGeom }; delete g[code]; return { plotGeom: g }; }),

      mergePlots: (codes, patch = {}, actor = 'admin') => {
        const id = 'M-' + Date.now();
        set((s) => ({
          merges: [...s.merges, { id, codes, ...patch }],
          // a merged unit is, by definition, owned — seed its project overlay
          projects: { ...s.projects, [id]: { name_ar: patch.name_ar, name_en: patch.name_en, owner: patch.owner, ownership: patch.owner ? 'owned' : 'reserved' } },
          audit: [{ at: Date.now(), actor, action: 'plots.merge', target: id, detail: codes.join(' + ') }, ...s.audit].slice(0, 500),
        }));
        return id;
      },
      unmerge: (id) => set((s) => ({ merges: s.merges.filter((m) => m.id !== id) })),

      subdividePlot: (parentCode, parts, actor = 'admin') =>
        set((s) => {
          const projects = { ...s.projects };
          for (const part of parts) {
            if (part.name_ar || part.name_en) projects[part.code] = { ...projects[part.code], name_ar: part.name_ar, name_en: part.name_en };
          }
          return {
            splits: { ...s.splits, [parentCode]: parts },
            projects,
            audit: [{ at: Date.now(), actor, action: 'plot.subdivide', target: parentCode, detail: `${parts.length} parts` }, ...s.audit].slice(0, 500),
          };
        }),
      unsubdivide: (parentCode) => set((s) => { const sp = { ...s.splits }; delete sp[parentCode]; return { splits: sp }; }),

      addAnnotation: (a) => {
        const id = 'an-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        set((s) => ({ annotations: [...s.annotations, { ...a, id }] }));
        return id;
      },
      updateAnnotation: (id, patch) => set((s) => ({ annotations: s.annotations.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
      removeAnnotation: (id) => set((s) => ({ annotations: s.annotations.filter((a) => a.id !== id) })),
      clearAnnotations: () => set({ annotations: [] }),

      addUser: (u, actor = 'admin') =>
        set((s) => ({
          users: [...s.users, { ...u, id: 'u' + Date.now() }],
          audit: [{ at: Date.now(), actor, action: 'user.add', target: u.email, detail: `${u.name} · ${u.role}` }, ...s.audit].slice(0, 500),
        })),
      updateUser: (id, patch) => set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) })),
      removeUser: (id) => set((s) => ({ users: s.users.filter((u) => u.id !== id) })),

      exportAll: () => JSON.stringify({ plotAttrs: get().plotAttrs, projects: get().projects, landUses: get().landUses, plotGeom: get().plotGeom, merges: get().merges, splits: get().splits, annotations: get().annotations, users: get().users }, null, 2),
      importAll: (json) => {
        try {
          const o = JSON.parse(json);
          set((s) => ({
            plotAttrs: o.plotAttrs ?? s.plotAttrs,
            projects: o.projects ?? s.projects,
            landUses: o.landUses ?? s.landUses,
            plotGeom: o.plotGeom ?? s.plotGeom,
            merges: o.merges ?? s.merges,
            splits: o.splits ?? s.splits,
            annotations: o.annotations ?? s.annotations,
            users: o.users ?? s.users,
            audit: o.audit ?? s.audit,
          }));
          return true;
        } catch {
          return false;
        }
      },
      reset: () => set({ plotAttrs: {}, projects: {}, landUses: {}, plotGeom: {}, merges: [], splits: {}, annotations: [], users: seedUsers, audit: [] }),
    }),
    { name: 'kec_overrides', partialize: (s) => ({ plotAttrs: s.plotAttrs, projects: s.projects, landUses: s.landUses, plotGeom: s.plotGeom, merges: s.merges, splits: s.splits, annotations: s.annotations, users: s.users, audit: s.audit }) as any },
  ),
);
