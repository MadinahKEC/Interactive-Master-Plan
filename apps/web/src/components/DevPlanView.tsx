import { useMemo, useState } from 'react';
import { can, type PlotCollection } from '@kec/types';
import { useApp } from '../store';
import { useAuth } from '../lib/auth';
import { useOverrides } from '../lib/overrides';
import { resolveProject, STATUS_META, STANDARD_PHASES, t, type ProjectInfo } from '../lib/domain';
import { IconClose, IconPlus, IconZoom, IconEdit, IconTrash, IconCalendar, TypeIcon } from './icons';
import { confirmDialog } from '../lib/dialog';
import type { EffLandUse } from '../lib/effective';

const nf = new Intl.NumberFormat('en-US');
const compact = (v: number) => (v >= 1e6 ? (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : nf.format(Math.round(v)));
const PLAN_STATUSES = ['Completed', 'UnderConstruction', 'Future', 'Partner'];

export function DevPlanView({
  open, onClose, data, projects, landUses, onEdit,
}: {
  open: boolean; onClose: () => void; data: PlotCollection | null;
  projects: Record<string, ProjectInfo>; landUses: Record<string, EffLandUse>; onEdit: (code: string) => void;
}) {
  const { lang, select, requestZoom } = useApp();
  const role = useAuth((s) => s.user?.role);
  const canEdit = can(role as any, 'plot:attr:update');
  const setProject = useOverrides((s) => s.setProject);
  const [addCode, setAddCode] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const sar = lang === 'ar' ? 'ر.س' : 'SAR';

  const planned = useMemo(
    () => (data ? data.features.filter((f) => (projects[f.properties.code]?.phases?.length ?? 0) > 0) : []),
    [data, projects],
  );
  const stats = useMemo(() => {
    let area = 0, gfa = 0, invest = 0; const byStatus: Record<string, number> = {};
    for (const f of planned) {
      const p = f.properties; const pr = resolveProject(p.code, p.land_use, projects);
      area += p.area || 0; gfa += p.gfa || 0; invest += projects[p.code]?.investment?.totalValue || 0;
      byStatus[pr.status.key] = (byStatus[pr.status.key] || 0) + 1;
    }
    return { area, gfa, invest, byStatus };
  }, [planned, projects]);
  const shown = useMemo(
    () => (filter ? planned.filter((f) => resolveProject(f.properties.code, f.properties.land_use, projects).status.key === filter) : planned),
    [planned, filter, projects],
  );

  if (!open || !data) return null;

  const addToPlan = () => {
    const code = addCode.trim().toUpperCase();
    const f = data.features.find((x) => x.properties.code.toUpperCase() === code);
    if (!f) { setNotFound(true); return; }
    const existing = projects[f.properties.code]?.phases ?? [];
    if (!existing.length) {
      const today = new Date().toISOString().slice(0, 10);
      const end = new Date(Date.now() + 180 * 864e5).toISOString().slice(0, 10);
      setProject(f.properties.code, { phases: [{ name_ar: STANDARD_PHASES[2].ar, name_en: STANDARD_PHASES[2].en, start: today, end, status: 'Future' }] });
    }
    setAddCode(''); setNotFound(false);
    onEdit(f.properties.code);
  };

  const viewOnMap = (code: string) => {
    const f = data.features.find((x) => x.properties.code === code);
    if (f) { select(f.properties); requestZoom(code); onClose(); }
  };

  const num = (v: number | null | undefined, d = 0) => (v || v === 0 ? nf.format(Number(v.toFixed?.(d) ?? v)) : '—');

  return (
    <div className="admin-root devplan-view" style={{ ['--mod' as string]: '#3E8E7E' }}>
      <div className="admin-head">
        <div className="admin-brand">
          <img src={import.meta.env.BASE_URL + 'KEC.png'} alt="KEC" />
          <span className="admin-bicon"><IconCalendar size={18} /></span>
          <div className="admin-btitle">
            <span className="admin-kicker">{t('brand.title', lang)}</span>
            <b>{t('dp.title', lang)}</b>
          </div>
          <span className="dp-badge">{planned.length} {t('dp.count', lang)}</span>
        </div>
        <button className="ic-btn lg" onClick={onClose}><IconClose size={20} /></button>
      </div>

      {canEdit && (
        <div className="dp-addbar">
          <input value={addCode} placeholder={t('dp.addHint', lang)} onChange={(e) => { setAddCode(e.target.value); setNotFound(false); }} onKeyDown={(e) => e.key === 'Enter' && addToPlan()} />
          <button className="btn primary" onClick={addToPlan}><IconPlus size={15} /> {t('dp.addPlot', lang)}</button>
          {notFound && <span className="dp-nf">{t('dp.notFound', lang)}</span>}
        </div>
      )}

      {planned.length > 0 && (
        <div className="dpv-summary">
          <div className="dpv-kpis">
            <div className="dpv-kpi"><span className="dk-v">{planned.length}</span><span className="dk-l">{t('dp.count', lang)}</span></div>
            <div className="dpv-kpi"><span className="dk-v">{compact(stats.area)}</span><span className="dk-l">{t('kpi.area', lang)} (m²)</span></div>
            <div className="dpv-kpi"><span className="dk-v">{compact(stats.gfa)}</span><span className="dk-l">{t('kpi.gfa', lang)} (m²)</span></div>
            {stats.invest > 0 && <div className="dpv-kpi accent"><span className="dk-v">{compact(stats.invest)} {sar}</span><span className="dk-l">{t('exec.portfolio', lang)}</span></div>}
          </div>
          <div className="dpv-filters">
            <button className={`dpf ${!filter ? 'on' : ''}`} onClick={() => setFilter(null)}>{t('cp.all', lang)}</button>
            {PLAN_STATUSES.filter((k) => stats.byStatus[k]).map((k) => {
              const on = filter === k; const m = STATUS_META[k];
              return (
                <button key={k} className={`dpf ${on ? 'on' : ''}`} style={on ? { background: m.color, borderColor: m.color, color: '#fff' } : { borderColor: m.color }} onClick={() => setFilter(on ? null : k)}>
                  <span className="dpf-dot" style={{ background: m.color }} />{lang === 'ar' ? m.ar : m.en} <b>{stats.byStatus[k]}</b>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="admin-content dpl-wrap">
        {planned.length === 0 && <div className="empty">{t('dp.noPlan', lang)}</div>}
        {shown.length > 0 && (
          <div className="dpl">
            <div className="dpl-head">
              <span className="dpl-ch-id">{t('dp.plot', lang)}</span>
              <span className="dpl-ch-status">{t('d.status', lang)}</span>
              <span className="dpl-ch-lu">{t('d.landuse', lang)}</span>
              <span className="dpl-ch-metrics">{t('d.area', lang)} · GFA · {t('d.floors', lang)}</span>
              <span className="dpl-ch-prog">{t('sec.devplan', lang)}</span>
              <span className="dpl-ch-acts" />
            </div>
            {shown.map((f) => {
              const p = f.properties;
              const pr = resolveProject(p.code, p.land_use, projects);
              const name = pr.named ? (lang === 'ar' ? pr.overlay.name_ar || pr.overlay.name_en : pr.overlay.name_en || pr.overlay.name_ar) : 'N/A';
              const lu = landUses[p.land_use as string];
              const phases = pr.overlay.phases ?? [];
              const done = phases.filter((ph) => ph.status === 'Completed').length;
              const pct = phases.length ? Math.round((done / phases.length) * 100) : 0;
              const range = (() => {
                const ds = phases.map((ph) => ph.start).filter(Boolean).sort();
                const de = phases.map((ph) => ph.end).filter(Boolean).sort();
                return ds.length && de.length ? `${ds[0]} → ${de[de.length - 1]}` : '—';
              })();
              return (
                <div className="dpr" key={p.code} style={{ ['--st' as string]: pr.status.color }} onClick={() => canEdit && onEdit(p.code)}>
                  <div className="dpr-id">
                    <span className="dpr-ic"><TypeIcon typeKey={pr.type.key} size={16} /></span>
                    <div className="dpr-idt">
                      <div className="dpr-name" title={name}>{name}</div>
                      <div className="dpr-code"><span className="mono">{p.code}</span> · {lang === 'ar' ? pr.type.ar : pr.type.en}</div>
                    </div>
                  </div>
                  <span className="dpr-status" style={{ background: pr.status.color }}>{lang === 'ar' ? pr.status.ar : pr.status.en}</span>
                  <div className="dpr-lu">
                    <span className="dpr-lu-nm"><i style={{ background: lu?.color ?? '#ccc' }} />{lang === 'ar' ? lu?.labelAr ?? p.land_use : lu?.labelEn ?? p.land_use}</span>
                    {pr.owner && <span className="dpr-owner" style={{ color: pr.ownership.color }}>{pr.owner}</span>}
                  </div>
                  <div className="dpr-metrics">
                    <div><b>{num(p.area, 0)}</b><span>m²</span></div>
                    <div><b>{num(p.gfa, 0)}</b><span>GFA</span></div>
                    <div><b>{num(p.floors)}</b><span>{t('d.floors', lang)}</span></div>
                  </div>
                  <div className="dpr-prog">
                    <div className="dpr-bar">
                      {phases.length === 0 ? <span className="dpr-seg" style={{ flex: 1, background: 'var(--kec-surface-2)' }} />
                        : phases.map((ph, i) => <span key={i} className="dpr-seg" style={{ flex: 1, background: (STATUS_META[ph.status ?? 'Future'] ?? STATUS_META.Future).color }} title={(lang === 'ar' ? ph.name_ar || ph.name_en : ph.name_en || ph.name_ar) || ''} />)}
                    </div>
                    <div className="dpr-prog-foot">
                      <span className="dpr-range mono">{range}</span>
                      <span className="dpr-pct">{pct}% · {phases.length} {t('dp.phasesShort', lang)}</span>
                    </div>
                  </div>
                  <div className="dpr-acts" onClick={(e) => e.stopPropagation()}>
                    <button className="mini-btn" title={t('dp.viewOnMap', lang)} onClick={() => viewOnMap(p.code)}><IconZoom size={13} /></button>
                    {canEdit && <button className="mini-btn" title={t('d.editAttrs', lang)} onClick={() => onEdit(p.code)}><IconEdit size={13} /></button>}
                    {canEdit && <button className="mini-btn danger" title={t('d.removeFromPlan', lang)} onClick={async () => { if (await confirmDialog({ title: t('d.removeFromPlan', lang), body: <><b>{p.code}</b> — {t('d.removeFromPlanConfirm', lang)}</>, icon: <IconCalendar size={24} />, confirmLabel: t('d.removeFromPlan', lang), cancelLabel: t('a.cancel', lang), danger: true, dir: lang === 'ar' ? 'rtl' : 'ltr' })) setProject(p.code, { phases: [] }); }}><IconTrash size={13} /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
