import { type ReactNode } from 'react';
import { SECTORS, can } from '@kec/types';
import { useApp } from '../store';
import { useAuth } from '../lib/auth';
import { useOverrides } from '../lib/overrides';
import { resolveProject, STATUS_META, STANDARD_PHASES, t, type ProjectInfo } from '../lib/domain';
import { ProgressGallery } from './ProgressGallery';
import { IconClose, IconEdit, IconShape, IconZoom, IconOwner, IconMerge, IconCalendar, IconPlus, TypeIcon } from './icons';
import type { EffLandUse } from '../lib/effective';

export function DetailPanel({
  projects, landUses, onEdit,
}: {
  projects: Record<string, ProjectInfo>; landUses: Record<string, EffLandUse>; onEdit: (code: string) => void;
}) {
  const { selected, lang, fitAll, setEditGeom, requestZoom } = useApp();
  const role = useAuth((s) => s.user?.role);
  const merges = useOverrides((s) => s.merges);
  const unmerge = useOverrides((s) => s.unmerge);
  const setProject = useOverrides((s) => s.setProject);
  const canAttr = can(role as any, 'plot:attr:update');
  const canGeom = can(role as any, 'plot:geometry:update');
  if (!selected) return null;
  const p = selected;
  const lu = landUses[p.land_use as string] ?? { labelAr: p.land_use ?? '—', labelEn: p.land_use ?? '—', color: '#C9C9C9', key: p.land_use ?? '' };
  const luLabel = lang === 'ar' ? lu.labelAr : lu.labelEn;
  const pr = resolveProject(p.code, p.land_use, projects);
  const title = pr.named ? (lang === 'ar' ? pr.overlay.name_ar || pr.overlay.name_en : pr.overlay.name_en || pr.overlay.name_ar) : p.code;
  const typeLabel = lang === 'ar' ? pr.type.ar : pr.type.en;
  const statusLabel = lang === 'ar' ? pr.status.ar : pr.status.en;
  const ownLabel = lang === 'ar' ? pr.ownership.ar : pr.ownership.en;
  const summary = lang === 'ar' ? pr.overlay.summary_ar : pr.overlay.summary_en;
  const mergeRec = merges.find((m) => m.id === p.code);
  const phases = pr.overlay.phases ?? [];
  const num = (v: number | null | undefined, d = 0) => (v || v === 0 ? new Intl.NumberFormat('en-US', { maximumFractionDigits: d }).format(v) : '—');

  const addToPlan = () => {
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + 180 * 864e5).toISOString().slice(0, 10);
    setProject(p.code, { phases: [{ name_ar: STANDARD_PHASES[2].ar, name_en: STANDARD_PHASES[2].en, start: today, end, status: 'Future' }] });
    onEdit(p.code);
  };

  return (
    <div className="panel" id="detail">
      <div className="d-head">
        <button className="d-close" onClick={fitAll} title={t('d.fullPlan', lang)}><IconClose size={17} /></button>
        <div className="d-type"><TypeIcon typeKey={pr.type.key} size={14} />{typeLabel}</div>
        <div className="d-title">{title}</div>
        <div className="d-sub">
          <span className="d-code mono">{p.code}</span>
          {!pr.named && <span className="d-unnamed">{t('d.unnamed', lang)}</span>}
          <span className="d-status" style={{ background: pr.status.color }}>{statusLabel}</span>
        </div>
      </div>

      <div className="d-scroll">
        <Section title={t('sec.ownership', lang)}>
          <div className="own-row">
            <span className="own-badge" style={{ background: pr.ownership.color }}>{ownLabel}</span>
            <span className="own-name"><IconOwner size={14} />{pr.owner || (lang === 'ar' ? 'لا يوجد مالك' : 'No owner')}</span>
          </div>
          {pr.overlay.purchase_date && <div className="own-date">{t('d.purchase', lang)}: <b className="mono">{pr.overlay.purchase_date}</b></div>}
          {mergeRec && (
            <div className="own-merge">
              <div className="own-date">{t('merged.of', lang)}: <b className="mono">{mergeRec.codes.join(' + ')}</b></div>
              {canAttr && <button className="btn sm danger" onClick={() => { unmerge(mergeRec.id); fitAll(); }}><IconMerge size={14} /> {t('d.unmerge', lang)}</button>}
            </div>
          )}
        </Section>

        {phases.length > 0 && (
          <Section title={t('sec.devplan', lang)}>
            <Timeline phases={phases} lang={lang} />
          </Section>
        )}
        {phases.length === 0 && canAttr && (
          <Section title={t('sec.devplan', lang)}>
            <div className="dp-add-card"><button className="btn sm" onClick={addToPlan}><IconPlus size={14} /> {t('d.addToPlan', lang)}</button></div>
          </Section>
        )}

        <Section title={t('sec.project', lang)}>
          <ProgressGallery lang={lang} type={pr.type} status={pr.status} progress={pr.progress} gallery={pr.overlay.gallery} />
          {summary && <p className="d-summary">{summary}</p>}
        </Section>

        <Section title={t('sec.land', lang)}>
          <div className="d-grid">
            <Cell l={t('d.landuse', lang)} v={luLabel} chip={lu.color} sm />
            <Cell l={t('d.sector', lang)} v={lang === 'ar' ? SECTORS[p.sector]?.labelAr ?? p.sector : p.sector} sm />
            <Cell l={t('d.area', lang)} v={num(p.area, 2)} />
            <Cell l={t('d.gfa', lang)} v={num(p.gfa, 1)} />
            <Cell l={t('d.floors', lang)} v={num(p.floors)} />
            <Cell l={t('d.height', lang)} v={num(p.height)} />
            <Cell l={t('d.coverage', lang)} v={num(p.coverage, 2)} />
            <Cell l={t('d.far', lang)} v={num(p.far, 2)} />
          </div>
        </Section>

        <div className="d-actions">
          {canAttr && <button className="btn primary" onClick={() => onEdit(p.code)}><IconEdit size={15} /> {t('d.editAttrs', lang)}</button>}
          {canGeom && <button className="btn" onClick={() => setEditGeom(p.code)}><IconShape size={15} /> {t('d.editShape', lang)}</button>}
          <button className="btn icon-only" onClick={() => requestZoom(p.code)} title={t('d.zoom', lang)}><IconZoom size={15} /></button>
        </div>
      </div>
    </div>
  );
}

function Timeline({ phases, lang }: { phases: import('../lib/domain').Phase[]; lang: 'ar' | 'en' }) {
  const dated = phases.filter((p) => p.start && p.end);
  const times = dated.flatMap((p) => [new Date(p.start!).getTime(), new Date(p.end!).getTime()]);
  const min = times.length ? Math.min(...times) : 0;
  const max = times.length ? Math.max(...times) : 1;
  const span = Math.max(1, max - min);
  return (
    <div className="tl">
      {phases.map((ph, i) => {
        const s = ph.start ? new Date(ph.start).getTime() : min;
        const e = ph.end ? new Date(ph.end).getTime() : s;
        const left = ((s - min) / span) * 100;
        const width = Math.max(3, ((e - s) / span) * 100);
        const st = STATUS_META[ph.status ?? 'Future'] ?? STATUS_META.Future;
        return (
          <div className="tl-row" key={i}>
            <div className="tl-head">
              <span className="tl-name"><IconCalendar size={12} /> {(lang === 'ar' ? ph.name_ar || ph.name_en : ph.name_en || ph.name_ar) || `${lang === 'ar' ? 'مرحلة' : 'Phase'} ${i + 1}`}</span>
              <span className="tl-dates mono">{ph.start ?? '—'} → {ph.end ?? '—'}</span>
            </div>
            <div className="tl-track"><span className="tl-bar" style={{ insetInlineStart: `${left}%`, width: `${width}%`, background: st.color }} /></div>
          </div>
        );
      })}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (<div className="d-section"><div className="d-sec-title">{title}</div>{children}</div>);
}
function Cell({ l, v, sm, chip }: { l: string; v: string; sm?: boolean; chip?: string }) {
  return (
    <div className="d-cell"><div className="l">{l}</div>
      <div className={`v ${sm ? 'sm' : ''}`}>{chip && <span className="cell-chip" style={{ background: chip }} />}{v}</div>
    </div>
  );
}
