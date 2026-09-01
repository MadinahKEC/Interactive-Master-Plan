import { useMemo, useState } from 'react';
import { can, type PlotCollection } from '@kec/types';
import { useApp } from '../store';
import { useAuth } from '../lib/auth';
import { useOverrides } from '../lib/overrides';
import { resolveProject, estimatedElecLoadKva, STANDARD_PHASES, t, type ProjectInfo } from '../lib/domain';
import { IconClose, IconMerge, IconZoom, IconCalendar, IconTrash, IconBolt, IconPlots, IconRuler, IconBuilding, IconCube } from './icons';
import type { EffLandUse } from '../lib/effective';
import type { ReactNode } from 'react';

const nf = new Intl.NumberFormat('en-US');
const fmt = (x: number) => (x >= 1e6 ? (x / 1e6).toFixed(2) + 'M' : nf.format(Math.round(x)));

export function MultiSelectPanel({ data, projects, landUses }: { data: PlotCollection; projects: Record<string, ProjectInfo>; landUses: Record<string, EffLandUse> }) {
  const { multi, lang, toggleMulti, clearMulti, requestZoom } = useApp();
  const role = useAuth((s) => s.user?.role);
  const canMerge = can(role as any, 'plot:attr:update');
  const mergePlots = useOverrides((s) => s.mergePlots);
  const addPlotsToPlan = useOverrides((s) => s.addPlotsToPlan);
  const removePlotsFromPlan = useOverrides((s) => s.removePlotsFromPlan);
  const projOver = useOverrides((s) => s.projects);
  const [owner, setOwner] = useState('');
  const byCode = useMemo(() => new Map(data.features.map((f) => [f.properties.code, f.properties])), [data]);

  // Aggregate richer stats across the selection (elegant summary of the chosen lands).
  const agg = useMemo(() => {
    let area = 0, gfa = 0, elec = 0, farW = 0, farA = 0, floors = 0, planned = 0;
    const uses: Record<string, { count: number; area: number }> = {};
    const sectors = new Set<string>();
    for (const code of multi) {
      const p = byCode.get(code); if (!p) continue;
      area += p.area || 0; gfa += p.gfa || 0;
      const manual = p.elecLoad != null && !Number.isNaN(p.elecLoad as number);
      elec += manual ? (p.elecLoad as number) : (estimatedElecLoadKva(p.gfa, p.land_use) ?? 0);
      if (p.far) { farW += p.far * (p.area || 0); farA += p.area || 0; }
      floors = Math.max(floors, p.floors || 0);
      if (p.sector) sectors.add(p.sector);
      if (p.planStatus) planned++;
      const k = p.land_use ?? '—';
      (uses[k] ??= { count: 0, area: 0 }); uses[k].count++; uses[k].area += p.area || 0;
    }
    const useList = Object.entries(uses).map(([k, v]) => ({ key: k, ...v })).sort((a, b) => b.area - a.area);
    return { area, gfa, elec, avgFar: farA ? farW / farA : 0, maxFloors: floors, planned, sectors: sectors.size, useList };
  }, [multi, byCode]);

  if (multi.length < 1) return null;

  const rows = multi.map((code) => {
    const p = byCode.get(code); const pr = p ? resolveProject(code, p.land_use, projects) : null;
    const name = pr?.named ? (lang === 'ar' ? pr.overlay.name_ar || pr.overlay.name_en : pr.overlay.name_en || pr.overlay.name_ar) : '—';
    return { code, name, area: p?.area ?? 0, gfa: p?.gfa ?? 0 };
  });
  const luLabel = (k: string) => (k === '—' ? '—' : (lang === 'ar' ? landUses[k]?.labelAr : landUses[k]?.labelEn) ?? k);
  const luColor = (k: string) => landUses[k]?.color ?? '#C9C9C9';
  const TOP = 5;
  const topUses = agg.useList.slice(0, TOP);
  const restUses = agg.useList.slice(TOP);
  const restCount = restUses.reduce((a, u) => a + u.count, 0);
  const restArea = restUses.reduce((a, u) => a + u.area, 0);

  const doMerge = () => {
    const id = mergePlots(multi, owner ? { owner } : {});
    clearMulti(); setOwner('');
    setTimeout(() => requestZoom(id), 60);
  };
  const inPlanCount = multi.filter((c) => (projOver[c]?.phases?.length ?? 0) > 0).length;
  const doAddToPlan = () => {
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + 180 * 864e5).toISOString().slice(0, 10);
    addPlotsToPlan(multi, { name_ar: STANDARD_PHASES[2].ar, name_en: STANDARD_PHASES[2].en, start: today, end, status: 'Future' });
    clearMulti();
  };
  const doRemoveFromPlan = () => { removePlotsFromPlan(multi); clearMulti(); };

  return (
    <div className="panel" id="multi">
      <div className="m-head">
        <button className="d-close" onClick={clearMulti}><IconClose size={16} /></button>
        <div className="m-count"><b>{multi.length}</b> {t('m.selected', lang)}</div>
      </div>
      <div className="m-body">
      <div className="m-list">
        {rows.map((r) => (
          <div className="m-row" key={r.code}>
            <span className="mono m-code">{r.code}</span>
            <span className="m-name">{r.name}</span>
            <span className="mono m-area">{fmt(r.area)}</span>
            <button className="mini-btn" onClick={() => requestZoom(r.code)}><IconZoom size={13} /></button>
            <button className="mini-btn" onClick={() => toggleMulti(r.code)}>×</button>
          </div>
        ))}
      </div>
      <div className="m-agg">
        <div className="m-agg-title">{t('m.aggregate', lang)}</div>
        <div className="m-stats">
          <MStat icon={<IconPlots size={15} />} v={fmt(multi.length)} l={t('m.selected', lang)} />
          <MStat icon={<IconRuler size={15} />} v={fmt(agg.area)} l={t('m.totalArea', lang)} />
          <MStat icon={<IconBuilding size={15} />} v={fmt(agg.gfa)} l={t('m.totalGfa', lang)} />
          <MStat icon={<IconBolt size={15} />} v={fmt(agg.elec)} l={t('m.totalElec', lang)} />
          <MStat icon={<IconCube size={15} />} v={agg.avgFar.toFixed(2)} l={t('m.avgFar', lang)} />
          <MStat icon={<IconCalendar size={15} />} v={fmt(agg.planned)} l={t('m.inPlan', lang)} />
        </div>
        {agg.useList.length > 0 && agg.area > 0 && (
          <div className="m-comp">
            <div className="m-sub">{t('m.byUse', lang)}</div>
            <div className="m-comp-bar">
              {agg.useList.map((u) => (
                <span key={u.key} style={{ width: `${(u.area / agg.area) * 100}%`, background: luColor(u.key) }} title={luLabel(u.key)} />
              ))}
            </div>
            <div className="m-comp-legend">
              {topUses.map((u) => (
                <div className="m-cl" key={u.key}>
                  <span className="m-sw" style={{ background: luColor(u.key) }} />
                  <span className="m-cl-name">{luLabel(u.key)}</span>
                  <span className="m-cl-ct mono">{u.count}</span>
                  <span className="m-cl-pct mono">{Math.round((u.area / agg.area) * 100)}%</span>
                </div>
              ))}
              {restUses.length > 0 && (
                <div className="m-cl">
                  <span className="m-sw" style={{ background: 'var(--kec-muted)' }} />
                  <span className="m-cl-name">{t('m.otherUses', lang)} ({restUses.length})</span>
                  <span className="m-cl-ct mono">{restCount}</span>
                  <span className="m-cl-pct mono">{Math.round((restArea / agg.area) * 100)}%</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </div>
      {canMerge && (
        <div className="m-actions">
          {inPlanCount < multi.length && <button className="btn primary m-plan-btn" onClick={doAddToPlan}><IconCalendar size={15} /> {t('m.addToPlan', lang)}</button>}
          {inPlanCount > 0 && <button className="btn danger m-plan-btn" onClick={doRemoveFromPlan}><IconTrash size={15} /> {t('m.removeFromPlan', lang)}</button>}
        </div>
      )}
      {multi.length >= 2 && canMerge && (
        <div className="m-merge">
          <input placeholder={t('a.owner', lang)} value={owner} onChange={(e) => setOwner(e.target.value)} />
          <button className="btn primary" onClick={doMerge}><IconMerge size={15} /> {t('m.merge', lang)}</button>
          <div className="m-merge-hint">{t('m.mergeHint', lang)}</div>
        </div>
      )}
    </div>
  );
}

/** Uniform premium stat tile — icon badge, value, label — used across the selection summary. */
function MStat({ icon, v, l }: { icon: ReactNode; v: string; l: string }) {
  return (
    <div className="m-stat">
      <span className="m-stat-ic">{icon}</span>
      <div className="m-stat-body">
        <div className="m-stat-v mono">{v}</div>
        <div className="m-stat-l">{l}</div>
      </div>
    </div>
  );
}
