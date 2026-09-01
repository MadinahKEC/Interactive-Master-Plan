import { useMemo, useState } from 'react';
import { can, type PlotCollection } from '@kec/types';
import { useApp } from '../store';
import { useAuth } from '../lib/auth';
import { useOverrides } from '../lib/overrides';
import { resolveProject, estimatedElecLoadKva, STANDARD_PHASES, t, type ProjectInfo } from '../lib/domain';
import { IconClose, IconMerge, IconZoom, IconCalendar, IconTrash, IconBolt } from './icons';
import type { EffLandUse } from '../lib/effective';

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
  const maxUseArea = Math.max(1, ...agg.useList.map((u) => u.area));
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
        <div className="m-elec">
          <span className="m-elec-ic"><IconBolt size={16} /></span>
          <div className="m-elec-body">
            <div className="m-elec-l">{t('m.totalElec', lang)}</div>
            <div className="m-elec-v mono">{fmt(agg.elec)} <em>kVA</em></div>
          </div>
        </div>
        <div className="m-kpis">
          <div className="m-kpi"><span className="mono">{multi.length}</span><small>{t('m.selected', lang)}</small></div>
          <div className="m-kpi"><span className="mono">{fmt(agg.area)}</span><small>{t('m.totalArea', lang)}</small></div>
          <div className="m-kpi"><span className="mono">{fmt(agg.gfa)}</span><small>{t('m.totalGfa', lang)}</small></div>
          <div className="m-kpi"><span className="mono">{agg.avgFar.toFixed(2)}</span><small>{t('m.avgFar', lang)}</small></div>
          <div className="m-kpi"><span className="mono">{agg.useList.length}</span><small>{t('m.landUses', lang)}</small></div>
          <div className="m-kpi"><span className="mono">{agg.planned}</span><small>{t('m.inPlan', lang)}</small></div>
        </div>
        {agg.useList.length > 0 && (
          <div className="m-break">
            <div className="m-sub">{t('m.byUse', lang)}</div>
            {topUses.map((u) => (
              <div className="m-bk-row" key={u.key}>
                <span className="m-sw" style={{ background: luColor(u.key) }} />
                <span className="m-bk-name">{luLabel(u.key)}</span>
                <span className="m-bk-ct mono">{u.count}</span>
                <span className="m-bk-bar"><span style={{ width: `${(u.area / maxUseArea) * 100}%`, background: luColor(u.key) }} /></span>
              </div>
            ))}
            {restUses.length > 0 && (
              <div className="m-bk-row">
                <span className="m-sw" style={{ background: 'var(--kec-muted)' }} />
                <span className="m-bk-name">{t('m.otherUses', lang)} ({restUses.length})</span>
                <span className="m-bk-ct mono">{restCount}</span>
                <span className="m-bk-bar"><span style={{ width: `${(restArea / maxUseArea) * 100}%`, background: 'var(--kec-muted)' }} /></span>
              </div>
            )}
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
