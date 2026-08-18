import { useMemo, useState } from 'react';
import { SECTORS, can, type PlotCollection } from '@kec/types';
import { useApp } from '../store';
import { useAuth } from '../lib/auth';
import { useOverrides } from '../lib/overrides';
import { resolveProject, STATUS_META, STANDARD_PHASES, t, type ProjectInfo } from '../lib/domain';
import { IconClose, IconPlus, IconZoom, IconEdit, IconTrash, TypeIcon } from './icons';
import type { EffLandUse } from '../lib/effective';

const nf = new Intl.NumberFormat('en-US');

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

  const planned = useMemo(
    () => (data ? data.features.filter((f) => (projects[f.properties.code]?.phases?.length ?? 0) > 0) : []),
    [data, projects],
  );
  const times = planned.flatMap((f) => (projects[f.properties.code].phases ?? []).filter((p) => p.start && p.end).flatMap((p) => [new Date(p.start!).getTime(), new Date(p.end!).getTime()]));
  const min = times.length ? Math.min(...times) : 0;
  const max = times.length ? Math.max(...times) : 1;
  const span = Math.max(1, max - min);

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
    <div className="admin-root devplan-view">
      <div className="admin-head">
        <div className="admin-brand"><img src="/KEC.png" alt="KEC" /><b>{t('dp.title', lang)}</b>
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

      <div className="admin-content">
        {planned.length === 0 && <div className="empty">{t('dp.noPlan', lang)}</div>}
        {planned.map((f) => {
          const p = f.properties;
          const pr = resolveProject(p.code, p.land_use, projects);
          const name = pr.named ? (lang === 'ar' ? pr.overlay.name_ar || pr.overlay.name_en : pr.overlay.name_en || pr.overlay.name_ar) : p.code;
          const lu = landUses[p.land_use as string];
          return (
            <div className="dpv-card" key={p.code}>
              <div className="dpv-head">
                <div className="dpv-title">
                  <span className="dpv-ic"><TypeIcon typeKey={pr.type.key} size={18} /></span>
                  <div>
                    <div className="dpv-name">{name} <span className="mono dpv-code">{p.code}</span></div>
                    <div className="dpv-sub">{lang === 'ar' ? pr.type.ar : pr.type.en} · <span style={{ color: pr.ownership.color }}>{lang === 'ar' ? pr.ownership.ar : pr.ownership.en}</span>{pr.owner ? ` · ${pr.owner}` : ''}</div>
                  </div>
                </div>
                <div className="dpv-actions">
                  <span className="dpv-status" style={{ background: pr.status.color }}>{lang === 'ar' ? pr.status.ar : pr.status.en}</span>
                  <button className="mini-btn" onClick={() => viewOnMap(p.code)}><IconZoom size={13} /> {t('dp.viewOnMap', lang)}</button>
                  {canEdit && <button className="mini-btn" onClick={() => onEdit(p.code)} title={t('d.editAttrs', lang)}><IconEdit size={13} /></button>}
                  {canEdit && <button className="mini-btn danger" onClick={() => setProject(p.code, { phases: [] })} title={t('d.removeFromPlan', lang)}><IconTrash size={13} /></button>}
                </div>
              </div>

              <div className="dpv-facts">
                <Fact l={t('d.landuse', lang)} v={lang === 'ar' ? lu?.labelAr ?? p.land_use : lu?.labelEn ?? p.land_use} />
                <Fact l={t('d.sector', lang)} v={lang === 'ar' ? SECTORS[p.sector]?.labelAr ?? p.sector : p.sector} />
                <Fact l={t('d.area', lang)} v={num(p.area, 0)} />
                <Fact l={t('d.gfa', lang)} v={num(p.gfa, 0)} />
                <Fact l={t('d.floors', lang)} v={num(p.floors)} />
                <Fact l={t('d.height', lang)} v={num(p.height)} />
              </div>

              <div className="dpv-gantt">
                {(pr.overlay.phases ?? []).map((ph, i) => {
                  const s = ph.start ? new Date(ph.start).getTime() : min;
                  const e = ph.end ? new Date(ph.end).getTime() : s;
                  const left = ((s - min) / span) * 100;
                  const width = Math.max(3, ((e - s) / span) * 100);
                  const st = STATUS_META[ph.status ?? 'Future'] ?? STATUS_META.Future;
                  const nm = (lang === 'ar' ? ph.name_ar || ph.name_en : ph.name_en || ph.name_ar) || `${lang === 'ar' ? 'مرحلة' : 'Phase'} ${i + 1}`;
                  return (
                    <div className="dp-track" key={i}>
                      <span className="dp-plabel">{nm}</span>
                      <div className="dp-line"><span className="dp-bar" style={{ insetInlineStart: `${left}%`, width: `${width}%`, background: st.color }} title={`${ph.start ?? ''} → ${ph.end ?? ''}`} /></div>
                      <span className="dp-pdate mono">{ph.start ?? '—'} → {ph.end ?? '—'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Fact({ l, v }: { l: string; v: string }) {
  return (<div className="dpv-fact"><span className="fl">{l}</span><span className="fv mono">{v}</span></div>);
}
