import { useMemo, useState } from 'react';
import { can, type PlotCollection } from '@kec/types';
import { useApp } from '../store';
import { useAuth } from '../lib/auth';
import { useOverrides } from '../lib/overrides';
import { resolveProject, t, type ProjectInfo } from '../lib/domain';
import { IconClose, IconMerge, IconZoom } from './icons';

const nf = new Intl.NumberFormat('en-US');
const fmt = (x: number) => (x >= 1e6 ? (x / 1e6).toFixed(2) + 'M' : nf.format(Math.round(x)));

export function MultiSelectPanel({ data, projects }: { data: PlotCollection; projects: Record<string, ProjectInfo> }) {
  const { multi, lang, toggleMulti, clearMulti, requestZoom } = useApp();
  const role = useAuth((s) => s.user?.role);
  const canMerge = can(role as any, 'plot:attr:update');
  const mergePlots = useOverrides((s) => s.mergePlots);
  const [owner, setOwner] = useState('');
  const byCode = useMemo(() => new Map(data.features.map((f) => [f.properties.code, f.properties])), [data]);
  if (multi.length < 1) return null;

  const rows = multi.map((code) => {
    const p = byCode.get(code); const pr = p ? resolveProject(code, p.land_use, projects) : null;
    const name = pr?.named ? (lang === 'ar' ? pr.overlay.name_ar || pr.overlay.name_en : pr.overlay.name_en || pr.overlay.name_ar) : '—';
    return { code, name, area: p?.area ?? 0, gfa: p?.gfa ?? 0 };
  });
  const totalArea = rows.reduce((a, r) => a + r.area, 0);
  const totalGfa = rows.reduce((a, r) => a + r.gfa, 0);

  const doMerge = () => {
    const id = mergePlots(multi, owner ? { owner } : {});
    clearMulti(); setOwner('');
    setTimeout(() => requestZoom(id), 60);
  };

  return (
    <div className="panel" id="multi">
      <div className="m-head">
        <button className="d-close" onClick={clearMulti}><IconClose size={16} /></button>
        <div className="m-count"><b>{multi.length}</b> {t('m.selected', lang)}</div>
      </div>
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
        <div className="m-agg-grid">
          <div><span className="mono">{multi.length}</span><small>{t('m.selected', lang)}</small></div>
          <div><span className="mono">{fmt(totalArea)}</span><small>{t('m.totalArea', lang)}</small></div>
          <div><span className="mono">{fmt(totalGfa)}</span><small>{t('m.totalGfa', lang)}</small></div>
        </div>
      </div>
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
