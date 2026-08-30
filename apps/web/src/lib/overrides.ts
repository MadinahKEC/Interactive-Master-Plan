import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProjectInfo, Phase } from './domain';

/**
 * Local (browser) persistence layer for admin edits. Everything the admin console
 * changes is stored here and merged into the base data at render time. When the real
 * backend (apps/api) is available, these actions get swapped for API calls — the shape
 * stays the same.
 */
export interface AuditEntry {
  id: string;
  at: number;
  actor: string;
  action: string;   // 'plot.attr' | 'plot.project' | 'landuse.color' | 'user.add' | ...
  target?: string;  // plot code / land-use key / user email
  detail: string;
  before?: RevertSnapshot;  // data slices just before this change (session-only, enables revert)
}
/** The revertible data slices captured before a change. */
type RevertSnapshot = Pick<OverridesState, 'plotAttrs' | 'projects' | 'landUses' | 'plotGeom' | 'merges' | 'splits' | 'annotations' | 'users' | 'optionLists' | 'createdPlots'>;
export interface LandUseOverride { color?: string; labelAr?: string; labelEn?: string }
/** An admin-added dropdown choice (persisted and reused across sessions). */
export interface OptionItem { value: string; ar?: string; en?: string }
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
/** A brand-new plot drawn on the map by an admin. */
export interface CreatedPlot {
  code: string;
  name_ar?: string; name_en?: string;
  land_use: string; sector: string;
  area: number; gfa?: number; floors?: number; height?: number; coverage?: number; far?: number;
  geometry: { type: 'Polygon'; coordinates: any };
}
/** A note left on a plot by a signed-in user (synced to everyone). */
export interface PlotComment { id: string; text: string; author: string; at: number }
/** An investor who expressed interest in a plot (interest pipeline / CRM-lite). */
export interface InvestorLead { id: string; name: string; contact?: string; note?: string; status: string; at: number; by?: string }
/** Border/glow styling for development-plan plots (fill stays the land-use colour). */
export interface PlanStyle {
  outline: string; dash: boolean; glow: boolean;
  outlineWidth?: number; glowWidth?: number; dashLen?: number; dashGap?: number;  // advanced border controls
}
export const DEFAULT_PLAN_STYLE: PlanStyle = { outline: '#9A8A1E', dash: true, glow: true, outlineWidth: 2.6, glowWidth: 9, dashLen: 2, dashGap: 1.4 };
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
  optionLists: Record<string, OptionItem[]>;   // admin-added choices per dropdown
  createdPlots: Record<string, CreatedPlot>;   // new plots drawn by admins
  comments: Record<string, PlotComment[]>;     // notes per plot code
  hiddenLandmarks: string[];                   // landmark ids removed by curators
  hiddenLandUses: string[];                     // land-use keys the admin removed (base ones too)
  hiddenCards: string[];                        // detail-card sections/fields the admin removed (prefixed keys: 's:…' / 'f:…')
  planStyle: PlanStyle;                        // map styling for development-plan plots
  investors: Record<string, InvestorLead[]>;   // investor-interest pipeline per plot
  audit: AuditEntry[];

  setPlotAttr: (code: string, patch: PlotAttrOverride, actor?: string) => void;
  setProject: (code: string, patch: ProjectInfo, actor?: string) => void;
  addPlotsToPlan: (codes: string[], phase: Phase, actor?: string) => number;
  setLandUse: (key: string, patch: LandUseOverride, actor?: string) => void;
  removeLandUse: (key: string, actor?: string) => void;
  restoreLandUse: (key: string) => void;
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
  addOption: (listKey: string, opt: OptionItem, actor?: string) => void;
  addCreatedPlot: (rec: CreatedPlot, actor?: string) => void;
  removeCreatedPlot: (code: string) => void;
  addComment: (code: string, text: string, author: string) => void;
  removeComment: (code: string, id: string) => void;
  hideLandmark: (id: string, actor?: string) => void;
  showAllLandmarks: () => void;
  toggleHiddenCard: (key: string, actor?: string) => void;
  setPlanStyle: (patch: Partial<PlanStyle>, actor?: string) => void;
  addInvestor: (code: string, lead: Omit<InvestorLead, 'id' | 'at'>, actor?: string) => void;
  updateInvestor: (code: string, id: string, patch: Partial<InvestorLead>) => void;
  removeInvestor: (code: string, id: string) => void;
  log: (e: Omit<AuditEntry, 'at' | 'id' | 'before'>) => void;
  revertTo: (id: string) => void;
  exportAll: () => string;
  importAll: (json: string) => boolean;
  reset: () => void;
}

const snap = (s: OverridesState): RevertSnapshot => ({
  plotAttrs: s.plotAttrs, projects: s.projects, landUses: s.landUses, plotGeom: s.plotGeom,
  merges: s.merges, splits: s.splits, annotations: s.annotations, users: s.users, optionLists: s.optionLists, createdPlots: s.createdPlots,
});
// Prepend an audit entry (with a pre-change snapshot for revert) and cap the log.
const pushAudit = (s: OverridesState, e: Omit<AuditEntry, 'at' | 'id' | 'before'>): AuditEntry[] =>
  [{ ...e, at: Date.now(), id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), before: snap(s) }, ...s.audit].slice(0, 120);

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
      optionLists: {},
      createdPlots: {},
      comments: {},
      hiddenLandmarks: [],
      hiddenLandUses: [],
      hiddenCards: [],
      planStyle: DEFAULT_PLAN_STYLE,
      investors: {},
      audit: [],

      addOption: (listKey, opt, actor = 'admin') =>
        set((s) => {
          const list = s.optionLists[listKey] ?? [];
          if (list.some((o) => o.value === opt.value)) return {} as any;
          return {
            optionLists: { ...s.optionLists, [listKey]: [...list, opt] },
            audit: pushAudit(s, { actor, action: 'option.add', target: listKey, detail: opt.en || opt.ar || opt.value }),
          };
        }),

      addCreatedPlot: (rec, actor = 'admin') =>
        set((s) => ({
          createdPlots: { ...s.createdPlots, [rec.code]: rec },
          audit: pushAudit(s, { actor, action: 'plot.create', target: rec.code, detail: `${Math.round(rec.area)} m²` }),
        })),
      removeCreatedPlot: (code) => set((s) => { const c = { ...s.createdPlots }; delete c[code]; return { createdPlots: c }; }),

      addComment: (code, text, author) =>
        set((s) => {
          const c: PlotComment = { id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), text, author, at: Date.now() };
          return { comments: { ...s.comments, [code]: [...(s.comments[code] ?? []), c] } };
        }),
      removeComment: (code, id) => set((s) => ({ comments: { ...s.comments, [code]: (s.comments[code] ?? []).filter((c) => c.id !== id) } })),

      hideLandmark: (id, actor = 'admin') =>
        set((s) => (s.hiddenLandmarks.includes(id) ? ({} as any) : {
          hiddenLandmarks: [...s.hiddenLandmarks, id],
          audit: pushAudit(s, { actor, action: 'landmark.hide', target: id, detail: 'removed' }),
        })),
      showAllLandmarks: () => set({ hiddenLandmarks: [] }),
      toggleHiddenCard: (key, actor = 'admin') =>
        set((s) => {
          const on = s.hiddenCards.includes(key);
          return {
            hiddenCards: on ? s.hiddenCards.filter((k) => k !== key) : [...s.hiddenCards, key],
            audit: pushAudit(s, { actor, action: on ? 'card.show' : 'card.hide', target: key, detail: on ? 'restored' : 'removed' }),
          };
        }),
      setPlanStyle: (patch, actor = 'admin') =>
        set((s) => ({ planStyle: { ...s.planStyle, ...patch }, audit: pushAudit(s, { actor, action: 'planStyle', target: 'plan', detail: JSON.stringify(patch) }) })),

      addInvestor: (code, lead, actor = 'admin') =>
        set((s) => {
          const l: InvestorLead = { ...lead, id: 'iv' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), at: Date.now() };
          return { investors: { ...s.investors, [code]: [...(s.investors[code] ?? []), l] }, audit: pushAudit(s, { actor, action: 'investor.add', target: code, detail: lead.name }) };
        }),
      updateInvestor: (code, id, patch) =>
        set((s) => ({ investors: { ...s.investors, [code]: (s.investors[code] ?? []).map((l) => (l.id === id ? { ...l, ...patch } : l)) } })),
      removeInvestor: (code, id) =>
        set((s) => ({ investors: { ...s.investors, [code]: (s.investors[code] ?? []).filter((l) => l.id !== id) } })),

      log: (e) => set((s) => ({ audit: pushAudit(s, e) })),

      setPlotAttr: (code, patch, actor = 'admin') =>
        set((s) => {
          const detail = Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(', ');
          return {
            plotAttrs: { ...s.plotAttrs, [code]: { ...s.plotAttrs[code], ...patch } },
            audit: pushAudit(s, { actor, action: 'plot.attr', target: code, detail }),
          };
        }),

      setProject: (code, patch, actor = 'admin') =>
        set((s) => ({
          projects: { ...s.projects, [code]: { ...s.projects[code], ...patch } },
          audit: pushAudit(s, { actor, action: 'plot.project', target: code, detail: patch.name_ar || patch.name_en || 'updated' }),
        })),

      // Bulk-join the development plan: seed a starter phase on every selected plot that
      // isn't already in the plan. One state update → one sync write. Returns how many
      // were added.
      addPlotsToPlan: (codes, phase, actor = 'admin') => {
        let added = 0;
        set((s) => {
          const projects = { ...s.projects };
          for (const code of codes) {
            const cur = projects[code];
            if ((cur?.phases?.length ?? 0) > 0) continue; // already in the plan
            projects[code] = { ...cur, phases: [{ ...phase }] };
            added++;
          }
          if (!added) return {} as any;
          return { projects, audit: pushAudit(s, { actor, action: 'plan.addMany', target: `${added} plots`, detail: codes.join(', ') }) };
        });
        return added;
      },

      setLandUse: (key, patch, actor = 'admin') =>
        set((s) => ({
          landUses: { ...s.landUses, [key]: { ...s.landUses[key], ...patch } },
          audit: pushAudit(s, { actor, action: 'landuse.edit', target: key, detail: JSON.stringify(patch) }),
        })),
      removeLandUse: (key, actor = 'admin') =>
        set((s) => {
          const lu = { ...s.landUses }; delete lu[key];   // drop any override (admin-created ones vanish)
          const hidden = s.hiddenLandUses.includes(key) ? s.hiddenLandUses : [...s.hiddenLandUses, key]; // hide base ones
          return { landUses: lu, hiddenLandUses: hidden, audit: pushAudit(s, { actor, action: 'landuse.remove', target: key, detail: 'removed' }) };
        }),
      restoreLandUse: (key) => set((s) => ({ hiddenLandUses: s.hiddenLandUses.filter((k) => k !== key) })),

      setGeometry: (code, geom, actor = 'admin') =>
        set((s) => ({
          plotGeom: { ...s.plotGeom, [code]: geom },
          audit: pushAudit(s, { actor, action: 'plot.geometry', target: code, detail: 'shape edited' }),
        })),
      resetGeometry: (code) =>
        set((s) => { const g = { ...s.plotGeom }; delete g[code]; return { plotGeom: g }; }),

      mergePlots: (codes, patch = {}, actor = 'admin') => {
        const id = 'M-' + Date.now();
        set((s) => ({
          merges: [...s.merges, { id, codes, ...patch }],
          // a merged unit is, by definition, owned — seed its project overlay
          projects: { ...s.projects, [id]: { name_ar: patch.name_ar, name_en: patch.name_en, owner: patch.owner, ownership: patch.owner ? 'owned' : 'reserved' } },
          audit: pushAudit(s, { actor, action: 'plots.merge', target: id, detail: codes.join(' + ') }),
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
            audit: pushAudit(s, { actor, action: 'plot.subdivide', target: parentCode, detail: `${parts.length} parts` }),
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
          audit: pushAudit(s, { actor, action: 'user.add', target: u.email, detail: `${u.name} · ${u.role}` }),
        })),
      updateUser: (id, patch) => set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) })),
      removeUser: (id) => set((s) => ({ users: s.users.filter((u) => u.id !== id) })),

      exportAll: () => JSON.stringify({ plotAttrs: get().plotAttrs, projects: get().projects, landUses: get().landUses, plotGeom: get().plotGeom, merges: get().merges, splits: get().splits, annotations: get().annotations, users: get().users, optionLists: get().optionLists, createdPlots: get().createdPlots, comments: get().comments, hiddenLandmarks: get().hiddenLandmarks, hiddenLandUses: get().hiddenLandUses, hiddenCards: get().hiddenCards, planStyle: get().planStyle, investors: get().investors }, null, 2),
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
            optionLists: o.optionLists ?? s.optionLists,
            createdPlots: o.createdPlots ?? s.createdPlots,
            comments: o.comments ?? s.comments,
            hiddenLandmarks: o.hiddenLandmarks ?? s.hiddenLandmarks,
            hiddenLandUses: o.hiddenLandUses ?? s.hiddenLandUses,
            hiddenCards: o.hiddenCards ?? s.hiddenCards,
            planStyle: o.planStyle ?? s.planStyle,
            investors: o.investors ?? s.investors,
            audit: o.audit ?? s.audit,
          }));
          return true;
        } catch {
          return false;
        }
      },
      revertTo: (id) => set((s) => {
        const idx = s.audit.findIndex((e) => e.id === id);
        if (idx < 0 || !s.audit[idx].before) return {} as any;
        // restore the snapshot taken before this edit; drop this edit and every newer one
        return { ...s.audit[idx].before, audit: s.audit.slice(idx + 1) } as any;
      }),
      reset: () => set({ plotAttrs: {}, projects: {}, landUses: {}, plotGeom: {}, merges: [], splits: {}, annotations: [], users: seedUsers, optionLists: {}, createdPlots: {}, comments: {}, hiddenLandmarks: [], hiddenLandUses: [], hiddenCards: [], planStyle: DEFAULT_PLAN_STYLE, investors: {}, audit: [] }),
    }),
    // `before` snapshots stay in memory only — persisting them would bloat storage/sync.
    { name: 'kec_overrides', partialize: (s) => ({ plotAttrs: s.plotAttrs, projects: s.projects, landUses: s.landUses, plotGeom: s.plotGeom, merges: s.merges, splits: s.splits, annotations: s.annotations, users: s.users, optionLists: s.optionLists, createdPlots: s.createdPlots, comments: s.comments, hiddenLandmarks: s.hiddenLandmarks, hiddenLandUses: s.hiddenLandUses, hiddenCards: s.hiddenCards, planStyle: s.planStyle, investors: s.investors, audit: s.audit.map(({ before, ...e }) => e) }) as any },
  ),
);
