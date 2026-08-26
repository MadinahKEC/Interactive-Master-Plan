import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { SECTORS, can, type PlotCollection } from '@kec/types';
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
import { FeasibilityModal } from './FeasibilityModal';
import { computeInvestmentScore, centroidOf, haversineKm, HARAM, scoreColor, gradeLabel } from '../lib/investment';
import { useInterestedInvestors, INVESTOR_LOG_ENABLED } from '../lib/investorLog';
import { IconClose, IconEdit, IconShape, IconZoom, IconOwner, IconMerge, IconCalendar, IconPlus, IconTrash, IconSplit, IconShare, IconStar, IconDownload, IconChevron, IconBuilding, IconRuler, IconLayers, IconInvest, IconClock, IconPalette, IconGlobe, IconRect, IconCube, TypeIcon } from './icons';
import type { ReactNode as RN } from 'react';
import type { EffLandUse } from '../lib/effective';

// Sections/fields the admin removed (via the plot editor) are simply omitted here.
// The card itself is view-only — hiding is managed inside "Edit attributes".
const CardCtx = createContext<string[]>([]);

export function DetailPanel({
  data, projects, landUses, onEdit, onSubdivide,
}: {
  data: PlotCollection | null; projects: Record<string, ProjectInfo>; landUses: Record<string, EffLandUse>; onEdit: (code: string) => void; onSubdivide: (code: string) => void;
}) {
  const { selected, lang, fitAll, setEditGeom, requestZoom } = useApp();
  const role = useAuth((s) => s.user?.role);
  const merges = useOverrides((s) => s.merges);
  const unmerge = useOverrides((s) => s.unmerge);
  const setProject = useOverrides((s) => s.setProject);
  const splits = useOverrides((s) => s.splits);
  const createdPlots = useOverrides((s) => s.createdPlots);
  const removeCreatedPlot = useOverrides((s) => s.removeCreatedPlot);
  const hiddenCards = useOverrides((s) => s.hiddenCards);
  const canAttr = can(role as any, 'plot:attr:update');
  const canGeom = can(role as any, 'plot:geometry:update');
  const shortlist = useShortlist();
  const [shareOpen, setShareOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [feasOpen, setFeasOpen] = useState(false);
  // reset any open sub-modal when the selection changes (or clears) so e.g. the QR
  // never re-opens by itself on the next plot.
  useEffect(() => { setShareOpen(false); setPdfOpen(false); setFeasOpen(false); }, [selected?.code]);
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
  const inPlan = phases.length > 0;
  const inv = pr.overlay.investment;
  const feat = data?.features.find((ft) => ft.properties.code === p.code);
  const centroid = feat ? centroidOf(feat.geometry) : HARAM;
  const haramKm = haversineKm(centroid, HARAM);
  const analysis = computeInvestmentScore(p, pr.overlay, haramKm);
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
        <CardCtx.Provider value={hiddenCards}>
        <Section k="s:ownership" title={t('sec.ownership', lang)}>
          <div className="own-row">
            <span className="own-badge" style={{ background: pr.ownership.color }}>{ownLabel}</span>
            <span className="own-name"><IconOwner size={14} />{pr.owner || (lang === 'ar' ? 'لا يوجد مالك' : 'No owner')}</span>
          </div>
          <div className="own-date">{t('d.purchase', lang)}: <b className="mono">{pr.overlay.purchase_date || '—'}</b></div>
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

        <Section k="s:summary" title={t('sec.summary', lang)}>
          {summary ? <p className="d-summary">{summary}</p> : <p className="d-summary muted">{lang === 'ar' ? 'لا يوجد وصف بعد.' : 'No overview yet.'}</p>}
        </Section>

        {pr.overlay.gallery && pr.overlay.gallery.length > 0 && (
          <Section k="s:gallery" title={t('sec.gallery', lang)}>
            <Carousel images={pr.overlay.gallery} />
          </Section>
        )}

        <Section k="s:land" title={t('sec.land', lang)}>
          <div className="d-tiles">
            <Tile k="f:landuse" icon={<IconPalette size={13} />} l={t('d.landuse', lang)} v={luLabel} chip={lu.color} text />
            <Tile k="f:sector" icon={<IconGlobe size={13} />} l={t('d.sector', lang)} v={lang === 'ar' ? SECTORS[p.sector]?.labelAr ?? p.sector : p.sector} text />
            <Tile k="f:area" icon={<IconRuler size={13} />} l={t('d.area', lang)} v={num(p.area, 2)} />
            <Tile k="f:gfa" icon={<IconBuilding size={13} />} l={t('d.gfa', lang)} v={num(p.gfa, 1)} />
            <Tile k="f:floors" icon={<IconLayers size={13} />} l={t('d.floors', lang)} v={num(p.floors)} />
            <Tile k="f:height" icon={<IconRuler size={13} />} l={t('d.height', lang)} v={num(p.height)} />
            <Tile k="f:coverage" icon={<IconRect size={13} />} l={t('d.coverage', lang)} v={num(p.coverage, 2)} />
            <Tile k="f:far" icon={<IconCube size={13} />} l={t('d.far', lang)} v={num(p.far, 2)} />
          </div>
        </Section>

        <Section k="s:analysis" title={t('sec.analysis', lang)}>
          <div className="ia-top">
            <ScoreRing score={analysis.score} />
            <div className="ia-meta">
              <div className="ia-grade" style={{ color: scoreColor(analysis.score) }}>{analysis.grade} · {gradeLabel(analysis.grade, lang)}</div>
              <div className="ia-label">{t('ia.score', lang)}</div>
              <div className="ia-haram">{t('ia.haram', lang)}: <b>{haramKm.toFixed(1)} {lang === 'ar' ? 'كم' : 'km'}</b></div>
            </div>
          </div>
          <div className="ia-factors">
            {analysis.factors.map((fac) => (
              <div className="ia-fac" key={fac.key}>
                <span className="ia-fac-l">{lang === 'ar' ? fac.ar : fac.en}<em>{Math.round(fac.weight * 100)}%</em></span>
                <span className="ia-fac-bar"><span className="ia-fac-fill" style={{ width: `${fac.value}%`, background: scoreColor(fac.value) }} /></span>
                <span className="ia-fac-v">{fac.value}</span>
              </div>
            ))}
          </div>
          <button className="btn sm primary ia-feas" onClick={() => setFeasOpen(true)}>{t('ia.feasibility', lang)}</button>
        </Section>

        {INVESTOR_LOG_ENABLED && <InvestorInterest code={p.code} lang={lang} />}

        {/* development plan is the gate: joining it unlocks the development + investment sections */}
        {!inPlan && canAttr && (
          <div className="dp-gate">
            <button className="btn primary dp-gate-btn" onClick={addToPlan}><IconPlus size={15} /> {t('d.addToPlan', lang)}</button>
            <p className="dp-gate-hint">{t('d.planUnlock', lang)}</p>
          </div>
        )}

        {inPlan && (
          <>
            <Section k="s:devplan" title={t('sec.devplan', lang)}>
              {canAttr && (
                <div className="dp-remove-wrap">
                  <button className="btn danger dp-remove-btn" onClick={removeFromPlan}><IconTrash size={14} /> {t('d.removeFromPlan', lang)}</button>
                </div>
              )}
              {hasDevDesc && <p className="dp-desc">{devDesc}</p>}
              <Timeline phases={phases} lang={lang} />
            </Section>

            <Section k="s:invest" title={t('sec.invest', lang)}>
              <div className="d-tiles">
                {INVEST_FIELDS.map((fld) => {
                  const v = inv?.[fld.key];
                  const has = v != null && !Number.isNaN(v);
                  return <Tile k={`f:inv:${fld.key}`} key={fld.key} icon={investIcon(fld.unit)} l={lang === 'ar' ? fld.ar : fld.en} v={has ? fmtInvest(v!, fld.unit, lang) : '—'} />;
                })}
              </div>
            </Section>

            <Section k="s:project" title={t('sec.project', lang)}>
              <div className="sb-caption">{t('sec.stage', lang)}</div>
              <StageBar lang={lang} stageKey={pr.overlay.stage} />
              <div className="sb-caption">{t('sec.license', lang)}</div>
              <StageBar lang={lang} stageKey={pr.overlay.license} stages={LICENSE_STAGES} variant="license" />
            </Section>

            <Section k="s:comments" title={t('sec.comments', lang)}>
              <Comments code={p.code} lang={lang} />
            </Section>
          </>
        )}

        <div className="d-actions">
          {canAttr && <button className="btn primary" onClick={() => onEdit(p.code)}><IconEdit size={15} /> {t('d.editAttrs', lang)}</button>}
          {canGeom && <button className="btn icon-only" onClick={() => setEditGeom(p.code)} title={t('d.editShape', lang)}><IconShape size={15} /></button>}
          {canAttr && <button className="btn icon-only" onClick={() => onSubdivide(Object.keys(splits).find((par) => splits[par].some((pt) => pt.code === p.code)) ?? p.code)} title={t('d.subdivide', lang)}><IconSplit size={15} /></button>}
          {canAttr && createdPlots[p.code] && <button className="btn icon-only danger" title={t('d.deletePlot', lang)} onClick={async () => { if (await confirmDialog({ title: t('d.deletePlot', lang), body: `${p.code}`, confirmLabel: t('d.deletePlot', lang), cancelLabel: t('a.cancel', lang), danger: true, dir: lang === 'ar' ? 'rtl' : 'ltr' })) { removeCreatedPlot(p.code); fitAll(); } }}><IconTrash size={15} /></button>}
          <button className="btn icon-only" onClick={() => requestZoom(p.code)} title={t('d.zoom', lang)}><IconZoom size={15} /></button>
        </div>
        </CardCtx.Provider>
      </div>
      {shareOpen && <ShareModal url={shareUrl()} title={title} onClose={() => setShareOpen(false)} />}
      {pdfOpen && <PlotFactsheet plot={p} projects={projects} landUses={landUses} haramKm={haramKm} onClose={() => setPdfOpen(false)} />}
      {feasOpen && <FeasibilityModal plot={p} projects={projects} onClose={() => setFeasOpen(false)} />}
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

// NOTE: the investor-interest pipeline (Investors UI) is hidden from the card for
// now per request; the data model + store actions remain in overrides for later.

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

// Investors who registered interest in this plot, pulled live from the separate
// kec-investor-log Firebase project. Renders only when there is interest to show.
function InvestorInterest({ code, lang }: { code: string; lang: 'ar' | 'en' }) {
  const { rows, loading, error } = useInterestedInvestors(code);
  if (!loading && !error && rows.length === 0) return null;
  const money = (v: number | null) => (v == null ? '—' : `${new Intl.NumberFormat('en-US').format(Math.round(v))} ${lang === 'ar' ? 'ر.س' : 'SAR'}`);
  return (
    <Section k="s:investors" title={t('sec.investors', lang)}>
      {loading && <div className="iv2-note">{t('iv2.loading', lang)}</div>}
      {error && <div className="iv2-note err">{t('iv2.error', lang)}</div>}
      {!loading && !error && rows.map((r) => (
        <div className="iv2-card" key={r.id}>
          <div className="iv2-top">
            <span className="iv2-co"><IconOwner size={13} /> {r.company}</span>
            {r.date && <span className="iv2-date">{r.date}</span>}
          </div>
          <div className="iv2-grid">
            <div className="iv2-cell"><span className="iv2-l">{t('iv2.type', lang)}</span><span className="iv2-v">{r.investType}</span></div>
            <div className="iv2-cell"><span className="iv2-l">{t('iv2.dealValue', lang)}</span><span className="iv2-v">{money(r.dealValue)}</span></div>
          </div>
        </div>
      ))}
    </Section>
  );
}

function Section({ title, children, k, defaultOpen = true }: { title: string; children: ReactNode; k?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const hidden = useContext(CardCtx);
  if (k && hidden.includes(k)) return null;
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
function ScoreRing({ score }: { score: number }) {
  const R = 26, C = 2 * Math.PI * R;
  const col = scoreColor(score);
  return (
    <div className="ia-ring">
      <svg viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={R} fill="none" stroke="var(--kec-hairline)" strokeWidth="7" />
        <circle cx="32" cy="32" r={R} fill="none" stroke={col} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - score / 100)} transform="rotate(-90 32 32)" />
      </svg>
      <span className="ia-ring-n" style={{ color: col }}>{score}</span>
    </div>
  );
}
function investIcon(unit: string): RN {
  if (unit === 'sqm') return <IconRuler size={13} />;
  if (unit === 'num') return <IconBuilding size={13} />;
  if (unit === 'yr') return <IconClock size={13} />;
  return <IconInvest size={13} />;
}
/** Premium stat tile — icon badge, label, value — two per row. */
function Tile({ icon, l, v, chip, k, text }: { icon: RN; l: string; v: string; chip?: string; k?: string; text?: boolean }) {
  const hidden = useContext(CardCtx);
  if (k && hidden.includes(k)) return null;
  return (
    <div className="d-tile">
      <span className="d-tile-ic">{icon}</span>
      <div className="d-tile-body">
        <div className="d-tile-l">{l}</div>
        <div className="d-tile-vrow">
          {chip && <span className="cell-chip" style={{ background: chip }} />}
          <span className={`d-tile-v ${text ? 'text' : ''}`}>{v}</span>
        </div>
      </div>
    </div>
  );
}
