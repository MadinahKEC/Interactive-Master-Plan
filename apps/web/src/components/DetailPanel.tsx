import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SECTORS, can } from '@kec/types';
import { useApp } from '../store';
import { useAuth } from '../lib/auth';
import { useOverrides } from '../lib/overrides';
import { resolveProject, STATUS_META, STANDARD_PHASES, LICENSE_STAGES, INVEST_FIELDS, fmtInvest, t, type ProjectInfo } from '../lib/domain';
import { useShortlist } from '../lib/shortlist';
import { shareUrl } from '../lib/urlState';
import { confirmDialog } from '../lib/dialog';
import { StageBar } from './StageBar';
import { ShareModal } from './ShareModal';
import { PlotFactsheet } from './PlotFactsheet';
import { IconClose, IconEdit, IconShape, IconZoom, IconOwner, IconMerge, IconCalendar, IconPlus, IconTrash, IconSplit, IconShare, IconStar, IconDownload, IconChevron, TypeIcon } from './icons';
import type { EffLandUse } from '../lib/effective';

export function DetailPanel({
  projects, landUses, onEdit, onSubdivide,
}: {
  projects: Record<string, ProjectInfo>; landUses: Record<string, EffLandUse>; onEdit: (code: string) => void; onSubdivide: (code: string) => void;
}) {
  const { selected, lang, fitAll, setEditGeom, requestZoom } = useApp();
  const role = useAuth((s) => s.user?.role);
  const merges = useOverrides((s) => s.merges);
  const unmerge = useOverrides((s) => s.unmerge);
  const setProject = useOverrides((s) => s.setProject);
  const splits = useOverrides((s) => s.splits);
  const createdPlots = useOverrides((s) => s.createdPlots);
  const removeCreatedPlot = useOverrides((s) => s.removeCreatedPlot);
  const canAttr = can(role as any, 'plot:attr:update');
  const canGeom = can(role as any, 'plot:geometry:update');
  const shortlist = useShortlist();
  const [shareOpen, setShareOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
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
  const devDesc = (lang === 'ar' ? pr.overlay.devplan_ar : pr.overlay.devplan_en)?.trim();
  const hasDevDesc = Boolean(devDesc);
  const inv = pr.overlay.investment;
  const invEntries = inv ? INVEST_FIELDS.filter((fld) => { const v = inv[fld.key]; return v != null && !Number.isNaN(v); }) : [];
  const num = (v: number | null | undefined, d = 0) => (v || v === 0 ? new Intl.NumberFormat('en-US', { maximumFractionDigits: d }).format(v) : '—');

  const addToPlan = () => {
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + 180 * 864e5).toISOString().slice(0, 10);
    setProject(p.code, { phases: [{ name_ar: STANDARD_PHASES[2].ar, name_en: STANDARD_PHASES[2].en, start: today, end, status: 'Future' }] });
    onEdit(p.code);
  };
  const removeFromPlan = () => setProject(p.code, { phases: [] });

  return (
    <div className="panel" id="detail">
      <div className="d-head">
        <button className="d-close" onClick={fitAll} title={t('d.fullPlan', lang)}><IconClose size={17} /></button>
        <div className="d-quick">
          <button className={`dq-btn ${shortlist.codes.includes(p.code) ? 'on' : ''}`} onClick={() => shortlist.toggle(p.code)} title={t(shortlist.codes.includes(p.code) ? 'd.unfavorite' : 'd.favorite', lang)}><IconStar size={15} /></button>
          <button className="dq-btn" onClick={() => setPdfOpen(true)} title={t('d.pdf', lang)}><IconDownload size={15} /></button>
          <button className="dq-btn" onClick={() => setShareOpen(true)} title={t('d.share', lang)}><IconShare size={15} /></button>
        </div>
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
              <div className="merge-contains">
                <div className="mc-title"><IconMerge size={13} /> {t('merged.contains', lang)} <span className="mc-count">{mergeRec.codes.length}</span></div>
                <ul className="mc-list">
                  {mergeRec.codes.map((c) => (
                    <li key={c}><span className="mc-name">{nameOfConstituent(c, projects, splits, lang)}</span><span className="mc-code mono">{c}</span></li>
                  ))}
                </ul>
              </div>
              {canAttr && <button className="btn sm danger" onClick={() => { unmerge(mergeRec.id); fitAll(); }}><IconMerge size={14} /> {t('d.unmerge', lang)}</button>}
            </div>
          )}
        </Section>

        {(phases.length > 0 || hasDevDesc || canAttr) && (
          <Section title={t('sec.devplan', lang)}>
            {hasDevDesc && <p className="dp-desc">{devDesc}</p>}
            {phases.length > 0 && <Timeline phases={phases} lang={lang} />}
            {phases.length === 0 && !hasDevDesc && canAttr && (
              <div className="dp-add-card"><button className="btn sm" onClick={addToPlan}><IconPlus size={14} /> {t('d.addToPlan', lang)}</button></div>
            )}
            {canAttr && phases.length > 0 && (
              <div className="dp-manage">
                <button className="btn sm danger" onClick={removeFromPlan}><IconTrash size={13} /> {t('d.removeFromPlan', lang)}</button>
              </div>
            )}
          </Section>
        )}

        {invEntries.length > 0 && (
          <Section title={t('sec.invest', lang)}>
            <div className="inv-grid">
              {invEntries.map((fld) => (
                <div className="inv-cell" key={fld.key}>
                  <div className="inv-v">{fmtInvest(inv![fld.key]!, fld.unit, lang)}</div>
                  <div className="inv-l">{lang === 'ar' ? fld.ar : fld.en}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section title={t('sec.project', lang)}>
          <div className="sb-caption">{t('sec.stage', lang)}</div>
          <StageBar lang={lang} stageKey={pr.overlay.stage} />
          <div className="sb-caption">{t('sec.license', lang)}</div>
          <StageBar lang={lang} stageKey={pr.overlay.license} stages={LICENSE_STAGES} variant="license" />
          {summary && <p className="d-summary">{summary}</p>}
          {pr.overlay.gallery && pr.overlay.gallery.length > 0 && (
            <Carousel images={pr.overlay.gallery} />
          )}
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

        <Section title={t('sec.comments', lang)}>
          <Comments code={p.code} lang={lang} />
        </Section>

        <div className="d-actions">
          {canAttr && <button className="btn primary" onClick={() => onEdit(p.code)}><IconEdit size={15} /> {t('d.editAttrs', lang)}</button>}
          {canGeom && <button className="btn icon-only" onClick={() => setEditGeom(p.code)} title={t('d.editShape', lang)}><IconShape size={15} /></button>}
          {canAttr && <button className="btn icon-only" onClick={() => onSubdivide(Object.keys(splits).find((par) => splits[par].some((pt) => pt.code === p.code)) ?? p.code)} title={t('d.subdivide', lang)}><IconSplit size={15} /></button>}
          {canAttr && createdPlots[p.code] && <button className="btn icon-only danger" title={t('d.deletePlot', lang)} onClick={async () => { if (await confirmDialog({ title: t('d.deletePlot', lang), body: `${p.code}`, confirmLabel: t('d.deletePlot', lang), cancelLabel: t('a.cancel', lang), danger: true, dir: lang === 'ar' ? 'rtl' : 'ltr' })) { removeCreatedPlot(p.code); fitAll(); } }}><IconTrash size={15} /></button>}
          <button className="btn icon-only" onClick={() => requestZoom(p.code)} title={t('d.zoom', lang)}><IconZoom size={15} /></button>
        </div>
      </div>
      {shareOpen && <ShareModal url={shareUrl()} title={title} onClose={() => setShareOpen(false)} />}
      {pdfOpen && <PlotFactsheet plot={p} projects={projects} landUses={landUses} onClose={() => setPdfOpen(false)} />}
    </div>
  );
}

// Auto-rotating image carousel. Cross-fades between images every few seconds;
// hovering the stage pauses rotation and reveals the current image in full.
function Carousel({ images }: { images: string[] }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const single = images.length <= 1;

  useEffect(() => {
    if (single || paused) return;
    timer.current = setInterval(() => setIdx((i) => (i + 1) % images.length), 3400);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [single, paused, images.length]);

  useEffect(() => { if (idx >= images.length) setIdx(0); }, [images.length, idx]);

  return (
    <div className="d-carousel">
      <div
        className="dc-stage"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onClick={() => !single && setIdx((i) => (i + 1) % images.length)}
      >
        {images.map((src, i) => (
          <img key={i} className={`dc-slide ${i === idx ? 'active' : ''}`} src={src} alt="" loading="lazy" draggable={false} />
        ))}
        {!single && <span className="dc-count">{idx + 1}/{images.length}</span>}
      </div>
      {!single && (
        <>
          <div className="dc-dots">
            {images.map((_, i) => (
              <button key={i} className={`dc-dot ${i === idx ? 'on' : ''}`} aria-label={`${i + 1}`} onClick={() => setIdx(i)} />
            ))}
          </div>
          <div className="dc-thumbs">
            {images.map((src, i) => (
              <img
                key={i}
                className={`dc-thumb ${i === idx ? 'on' : ''}`}
                src={src}
                alt=""
                loading="lazy"
                onMouseEnter={() => setIdx(i)}
                onClick={() => setIdx(i)}
              />
            ))}
          </div>
        </>
      )}
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

/** Friendly name of a merged constituent (base plot or sub-plot). */
function nameOfConstituent(code: string, projects: Record<string, ProjectInfo>, splits: Record<string, { code: string; name_ar?: string; name_en?: string }[]>, lang: 'ar' | 'en'): string {
  const pj = projects[code];
  if (pj?.name_ar || pj?.name_en) return (lang === 'ar' ? pj.name_ar || pj.name_en : pj.name_en || pj.name_ar) as string;
  for (const parent of Object.keys(splits)) {
    const rec = splits[parent].find((r) => r.code === code);
    if (rec && (rec.name_ar || rec.name_en)) return (lang === 'ar' ? rec.name_ar || rec.name_en : rec.name_en || rec.name_ar) as string;
  }
  return code;
}

function Comments({ code, lang }: { code: string; lang: 'ar' | 'en' }) {
  const comments = useOverrides((s) => s.comments[code]) ?? [];
  const addComment = useOverrides((s) => s.addComment);
  const removeComment = useOverrides((s) => s.removeComment);
  const user = useAuth((s) => s.user);
  const isAdmin = can(user?.role as any, 'plot:attr:update');
  const [text, setText] = useState('');
  const author = user?.name || user?.email || 'User';
  const submit = () => { const v = text.trim(); if (!v) return; addComment(code, v, author); setText(''); };
  const rel = (at: number) => {
    const d = (Date.now() - at) / 1000;
    if (d < 60) return lang === 'ar' ? 'الآن' : 'now';
    if (d < 3600) return Math.floor(d / 60) + (lang === 'ar' ? ' د' : 'm');
    if (d < 86400) return Math.floor(d / 3600) + (lang === 'ar' ? ' س' : 'h');
    return new Date(at).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-GB');
  };
  return (
    <div className="cm">
      {comments.length === 0 && <div className="cm-empty">{t('cm.empty', lang)}</div>}
      {comments.length > 0 && (
        <div className="cm-list">
          {comments.slice().sort((a, b) => a.at - b.at).map((c) => (
            <div className="cm-item" key={c.id}>
              <div className="cm-head">
                <span className="cm-avatar">{(c.author || '?').trim().charAt(0).toUpperCase()}</span>
                <span className="cm-author">{c.author}</span>
                <span className="cm-time">{rel(c.at)}</span>
                {(isAdmin || c.author === author) && <button className="cm-del" title="×" onClick={() => removeComment(code, c.id)}>×</button>}
              </div>
              <div className="cm-text">{c.text}</div>
            </div>
          ))}
        </div>
      )}
      {user && (
        <div className="cm-add">
          <input value={text} placeholder={t('cm.placeholder', lang)} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
          <button className="btn sm primary" disabled={!text.trim()} onClick={submit}>{t('cm.add', lang)}</button>
        </div>
      )}
    </div>
  );
}

function Section({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`d-section ${open ? '' : 'collapsed'}`}>
      <button type="button" className="d-sec-title" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>{title}</span>
        <IconChevron size={16} />
      </button>
      {open && <div className="d-sec-body">{children}</div>}
    </div>
  );
}
function Cell({ l, v, sm, chip }: { l: string; v: string; sm?: boolean; chip?: string }) {
  return (
    <div className="d-cell"><div className="l">{l}</div>
      <div className={`v ${sm ? 'sm' : ''}`}>{chip && <span className="cell-chip" style={{ background: chip }} />}{v}</div>
    </div>
  );
}
