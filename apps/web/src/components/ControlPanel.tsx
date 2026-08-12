import { useMemo } from 'react';
import { SECTORS, type PlotCollection, type SectorKey } from '@kec/types';
import { useApp, matchPlot } from '../store';
import { resolveProject, t, type ProjectInfo } from '../lib/domain';
import type { EffLandUse } from '../lib/effective';

const nf = new Intl.NumberFormat('en-US');
const fmtBig = (x: number) =>
  x >= 1e6 ? (x / 1e6).toFixed(1) + 'M' : x >= 1e3 ? (x / 1e3).toFixed(1) + 'K' : nf.format(Math.round(x));

export function ControlPanel({ data, landUses, projects }: { data: PlotCollection; landUses: Record<string, EffLandUse>; projects: Record<string, ProjectInfo> }) {
  const state = useApp();
  const { lang, sector, uses, setSector, toggleUse, setSearch, setSearchCodes, select } = state;

  const sectorCounts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const f of data.features) { const s = f.properties.sector; c[s] = (c[s] || 0) + 1; c.all++; }
    return c;
  }, [data]);

  const useCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of data.features) { const k = f.properties.land_use ?? ''; c[k] = (c[k] || 0) + 1; }
    return c;
  }, [data]);

  const kpis = useMemo(() => {
    let n = 0, gfa = 0, area = 0; const u = new Set<string>();
    for (const f of data.features) {
      if (!matchPlot(f.properties, state)) continue;
      n++; gfa += f.properties.gfa || 0; area += f.properties.area || 0;
      if (f.properties.land_use) u.add(f.properties.land_use);
    }
    return { n, gfa, area, uses: u.size };
  }, [data, state]);

  // search anything: code, project name, area, or owner/investor
  const onSearch = (v: string) => {
    const s = v.trim();
    setSearch(s);
    if (!s) { setSearchCodes(null); return; }
    const q = s.toUpperCase();
    const matches: string[] = [];
    for (const f of data.features) {
      const p = f.properties;
      const pr = resolveProject(p.code, p.land_use, projects);
      const name = `${pr.overlay.name_ar ?? ''} ${pr.overlay.name_en ?? ''}`.toUpperCase();
      const owner = (pr.owner ?? '').toUpperCase();
      const area = String(Math.round(p.area ?? 0));
      if (p.code.toUpperCase().includes(q) || name.includes(q) || owner.includes(q) || area.includes(s)) matches.push(p.code);
    }
    setSearchCodes(matches);
    const exact = data.features.find((f) => (f.properties.code ?? '').toUpperCase() === q);
    if (exact) select(exact.properties);
  };

  const sectorOrder: (SectorKey | 'all')[] = ['all', 'North', 'South', 'Central', 'East', 'West'];

  return (
    <div className="panel" id="controls">
      <div className="ctl-scroll">
        <div className="search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          <input placeholder={t('cp.searchAny', lang)} onChange={(e) => onSearch(e.target.value)} />
        </div>

        <div className="sect-title">{t('cp.sectors', lang)} <span className="mini">{sectorCounts.all} {t('cp.plotsWord', lang)}</span></div>
        <div className="chips">
          {sectorOrder.filter((s) => s === 'all' || sectorCounts[s]).map((s) => (
            <div key={s} className={`chip ${sector === s ? 'on' : ''}`} onClick={() => setSector(s)}>
              {s === 'all' ? t('cp.all', lang) : lang === 'ar' ? SECTORS[s as SectorKey].labelAr : s}{' '}
              <span className="mono" style={{ opacity: 0.7 }}>{sectorCounts[s] || 0}</span>
            </div>
          ))}
        </div>

        <div className="kpis">
          <Kpi v={nf.format(kpis.n)} l={t('kpi.count', lang)} />
          <Kpi v={String(kpis.uses)} l={t('kpi.uses', lang)} />
          <Kpi v={fmtBig(kpis.gfa)} l={t('kpi.gfa', lang)} />
          <Kpi v={fmtBig(kpis.area)} l={t('kpi.area', lang)} />
        </div>

        <div className="sect-title">{t('cp.uses', lang)} <span className="mini">{t('cp.filterHint', lang)}</span></div>
        <div className="legend">
          {Object.keys(landUses).filter((k) => useCounts[k]).sort((a, b) => useCounts[b] - useCounts[a]).map((k) => (
            <div key={k} className={`lg ${uses.has(k) ? '' : 'off'}`} onClick={() => toggleUse(k)}>
              <span className="sw" style={{ background: landUses[k].color }} />
              <span className="nm">{lang === 'ar' ? landUses[k].labelAr : landUses[k].labelEn}</span>
              <span className="ct">{useCounts[k]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({ v, l }: { v: string; l: string }) {
  return (<div className="kpi"><div className="v">{v}</div><div className="l">{l}</div></div>);
}
