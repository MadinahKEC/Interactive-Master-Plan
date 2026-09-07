import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { SECTORS, type PlotProps } from '@kec/types';
import { resolveProject, LICENSE_STAGES, PROGRESS_STAGES, INVEST_FIELDS, fmtInvest, investLabel, estimatedElecLoadKva, t, type ProjectInfo } from '../lib/domain';
import { computeInvestmentScore, scoreColor, gradeLabel } from '../lib/investment';
import { StageBar } from './StageBar';
import type { EffLandUse } from '../lib/effective';
import { IconClose, IconOwner, IconMerge } from './icons';
import { useBackClose } from '../lib/backstack';
import { useOverrides } from '../lib/overrides';
import { printWithPage } from '../lib/print';

const nf = (v: number | null | undefined, d = 0) => (v || v === 0 ? new Intl.NumberFormat('en-US', { maximumFractionDigits: d }).format(v) : '—');

/** Premium one-page (A4) print-ready factsheet for a single plot — imagery + full data. */
export function PlotFactsheet({ plot, projects, landUses, haramKm = 0, onClose }: {
  plot: PlotProps; projects: Record<string, ProjectInfo>; landUses: Record<string, EffLandUse>; haramKm?: number; onClose: () => void;
}) {
  const lang = (document.documentElement.lang === 'ar' ? 'ar' : 'en') as 'ar' | 'en';
  useBackClose(true, onClose, 100);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const p = plot;
  const pr = resolveProject(p.code, p.land_use, projects);
  const o = pr.overlay;
  const merges = useOverrides((s) => s.merges);
  const splits = useOverrides((s) => s.splits);
  const mergeRec = merges.find((m) => m.id === p.code);
  const lu = landUses[p.land_use as string];
  const luLabel = lu ? (lang === 'ar' ? lu.labelAr : lu.labelEn) : (p.land_use ?? '—');
  const displayCode = o.plotNo || p.code;
  const title = pr.named ? (lang === 'ar' ? o.name_ar || o.name_en : o.name_en || o.name_ar) : displayCode;
  const now = new Date();
  const ref = `KEC-PLOT-${displayCode}`;
  const stg = PROGRESS_STAGES.find((x) => x.key === o.stage);
  const lic = LICENSE_STAGES.find((x) => x.key === o.license);
  const summary = lang === 'ar' ? o.summary_ar : o.summary_en;
  const analysis = computeInvestmentScore(p, o, haramKm);
  const gallery = o.gallery ?? [];
  const company = lang === 'ar' ? 'مدينة المعرفة الاقتصادية' : 'Knowledge Economic City';
  const elecManual = p.elecLoad != null && !Number.isNaN(p.elecLoad as number);
  const elecLoad = elecManual ? (p.elecLoad as number) : estimatedElecLoadKva(p.gfa, p.land_use);
  const dl = () => printWithPage('size:A4 portrait;margin:0', `${title} — ${company}`);

  // The sheet is a real A4-portrait canvas (fixed mm) → prints at exactly 100% on one
  // page; on screen it scales down to fit the viewport like a print preview.
  const PAGE_W = (210 * 96) / 25.4, PAGE_H = (297 * 96) / 25.4;
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min((window.innerWidth - 36) / PAGE_W, (window.innerHeight - 96) / PAGE_H, 1));
    fit(); window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [PAGE_W, PAGE_H]);

  const Cell = ({ l, v }: { l: string; v: string }) => (<div className="pf-cell"><span className="pf-l">{l}</span><span className="pf-v">{v}</span></div>);

  return createPortal(
    <div className="report-overlay pf-overlay" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="report-toolbar">
        <button className="btn" onClick={onClose}><IconClose size={15} /> {t('report.close', lang)}</button>
        <button className="btn primary" onClick={dl}>🖨 {t('report.print', lang)}</button>
      </div>

      <div className="pf-fit" style={{ width: PAGE_W * scale, height: PAGE_H * scale }}>
      <div className="pf-sheet" style={{ ['--pf-scale' as string]: String(scale) }}>
        <header className="pf-header">
          <img className="pf-logo" src={import.meta.env.BASE_URL + 'KEC.png'} alt="KEC" />
          <div className="pf-htitle">
            <span className="pf-kicker">{t('pf.title', lang)}</span>
            <h1>{title}</h1>
          </div>
          <div className="pf-ref">
            <span className="pf-refno mono">{ref}</span>
            <span>{now.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-GB')}</span>
          </div>
        </header>

        <div className="pf-hero">
          <div className="pf-media">
            {gallery.length > 0 ? (
              /* Reports use a single image — the first one uploaded on the card. */
              <img className="pf-photo-main" src={gallery[0]} alt="" />
            ) : (
              <div className="pf-noimg" style={{ background: `linear-gradient(135deg, ${lu?.color ?? '#2F6B3E'}, #143D1E)` }}>
                <span className="mono">{p.code}</span>
              </div>
            )}
          </div>

          <div className="pf-side">
            <div className="pf-chips">
              <span className="pf-code mono">{displayCode}</span>
              <span className="pf-lu"><span className="pf-sw" style={{ background: lu?.color ?? '#ccc' }} />{luLabel}</span>
              <span className="pf-status" style={{ background: pr.status.color }}>{lang === 'ar' ? pr.status.ar : pr.status.en}</span>
            </div>
            <div className="pf-owner"><IconOwner size={14} /> {pr.owner || (lang === 'ar' ? 'لا يوجد مالك' : 'No owner')} <span className="pf-own-badge" style={{ background: pr.ownership.color }}>{lang === 'ar' ? pr.ownership.ar : pr.ownership.en}</span></div>
            <div className="pf-score" style={{ borderColor: scoreColor(analysis.score) }}>
              <span className="pf-score-n" style={{ color: scoreColor(analysis.score) }}>{analysis.score}</span>
              <span className="pf-score-t"><b>{analysis.grade} · {gradeLabel(analysis.grade, lang)}</b>{t('ia.score', lang)}</span>
              <span className="pf-score-h">{t('ia.haram', lang)}: {haramKm.toFixed(1)} {lang === 'ar' ? 'كم' : 'km'}</span>
            </div>
            <div className="pf-stats">
              <Stat v={nf(p.area, 0)} l={`${t('d.area', lang)} · m²`} big />
              <Stat v={nf(p.gfa, 0)} l="GFA · m²" big />
              <Stat v={nf(p.floors)} l={t('d.floors', lang)} />
              <Stat v={nf(p.height)} l={`${t('d.height', lang)} · m`} />
              <Stat v={nf(p.coverage, 2)} l={t('d.coverage', lang)} />
              <Stat v={nf(p.far, 2)} l={t('d.far', lang)} />
              <Stat v={elecLoad != null ? nf(elecLoad, 1) : '—'} l={`${t('d.elecLoad', lang)}${elecManual ? ' ·' + t('d.manual', lang) : ''}`} />
            </div>
          </div>
        </div>

        {summary && (
          <div className="pf-brief">
            <span className="pf-cap">{lang === 'ar' ? 'نبذة عن المشروع' : 'Project Brief'}</span>
            <p>{summary}</p>
          </div>
        )}

        {mergeRec && (() => {
          const parts = mergeRec.parts?.length ? mergeRec.parts : mergeRec.codes.map((c) => ({ code: c, land_use: null as string | null, area: 0 }));
          const total = parts.reduce((sum, pt) => sum + (pt.area || 0), 0);
          return (
            <div className="pf-merge">
              <span className="pf-cap"><IconMerge size={12} /> {t('merged.breakdown', lang)} · {mergeRec.codes.length}</span>
              <div className="pf-merge-row">
                {parts.map((pt) => {
                  const plu = pt.land_use ? landUses[pt.land_use] : undefined;
                  const plabel = plu ? (lang === 'ar' ? plu.labelAr : plu.labelEn) : (pt.land_use ?? '—');
                  return (
                    <div className="pf-mchip" key={pt.code}>
                      <span className="pf-mchip-sw" style={{ background: plu?.color ?? '#C9C9C9' }} />
                      <div className="pf-mchip-txt">
                        <span className="pf-mchip-nm">{nameOfPart(pt.code, projects, splits, lang)}</span>
                        <span className="pf-mchip-lu">{plabel}</span>
                      </div>
                      <div className="pf-mchip-nums">
                        {pt.area > 0 && <span className="pf-mchip-area mono">{nf(pt.area, 0)} m²</span>}
                        <span className="pf-mchip-code mono">{pt.code}</span>
                      </div>
                    </div>
                  );
                })}
                {total > 0 && <div className="pf-mchip pf-mtotal"><span>{t('merged.total', lang)}</span><b className="mono">{nf(total, 0)} m²</b></div>}
              </div>
            </div>
          );
        })()}

        <div className="pf-body">
          <div className="pf-brow">
            <div className="pf-bcol">
              <div className="pf-colbox">
                <div className="pf-cap">{t('sec.ownership', lang)}</div>
                <Cell l={t('d.ownership', lang)} v={lang === 'ar' ? pr.ownership.ar : pr.ownership.en} />
                <Cell l={t('a.owner', lang)} v={pr.owner || '—'} />
                <Cell l={t('d.purchase', lang)} v={o.purchase_date || '—'} />
                <Cell l={t('d.sector', lang)} v={lang === 'ar' ? SECTORS[p.sector]?.labelAr ?? p.sector : p.sector} />
              </div>
              <div className="pf-colbox">
                <div className="pf-cap">{t('sec.project', lang)}</div>
                <Cell l={t('a.type', lang)} v={lang === 'ar' ? pr.type.ar : pr.type.en} />
                <Cell l={t('sec.stage', lang)} v={stg ? (lang === 'ar' ? stg.ar : stg.en) : '—'} />
                <Cell l={t('sec.license', lang)} v={lic ? (lang === 'ar' ? lic.ar : lic.en) : '—'} />
                <Cell l={t('d.landuse', lang)} v={luLabel} />
              </div>
            </div>

            <div className="pf-bcol">
              <div className="pf-barbox">
                <div className="pf-cap">{t('sec.stage', lang)}</div>
                <StageBar lang={lang} stageKey={o.stage} />
              </div>
              <div className="pf-barbox">
                <div className="pf-cap">{t('sec.license', lang)}</div>
                <StageBar lang={lang} stageKey={o.license} stages={LICENSE_STAGES} variant="license" />
              </div>
            </div>
          </div>

          {o.investment && INVEST_FIELDS.some((f) => o.investment![f.key] != null && !Number.isNaN(o.investment![f.key])) && (
            <div className="pf-invest-box">
              <div className="pf-cap">{t('sec.invest', lang)}</div>
              <div className="pf-invest-grid">
                {INVEST_FIELDS.filter((f) => o.investment![f.key] != null && !Number.isNaN(o.investment![f.key])).map((f) => (
                  <div className="pf-inv" key={f.key}>
                    <div className="pf-inv-v">{fmtInvest(o.investment![f.key]!, f.unit)}</div>
                    <div className="pf-inv-l">{investLabel(f, lang)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="pf-footer">
          <span>© {lang === 'ar' ? 'مدينة المعرفة الاقتصادية — المخطط العام التفاعلي' : 'Knowledge Economic City — Interactive Master Plan'}</span>
          <span className="mono">{ref}</span>
        </footer>
      </div>
      </div>
    </div>,
    document.body,
  );
}

function Stat({ v, l, big }: { v: string; l: string; big?: boolean }) {
  return (<div className={`pf-stat ${big ? 'big' : ''}`}><div className="pf-stat-v">{v}</div><div className="pf-stat-l">{l}</div></div>);
}

/** Friendly name of a merged constituent (named project or sub-plot), else its code. */
function nameOfPart(code: string, projects: Record<string, ProjectInfo>, splits: Record<string, { code: string; name_ar?: string; name_en?: string }[]>, lang: 'ar' | 'en'): string {
  const pj = projects[code];
  if (pj?.name_ar || pj?.name_en) return (lang === 'ar' ? pj.name_ar || pj.name_en : pj.name_en || pj.name_ar) as string;
  for (const parent of Object.keys(splits)) {
    const rec = splits[parent].find((r) => r.code === code);
    if (rec && (rec.name_ar || rec.name_en)) return (lang === 'ar' ? rec.name_ar || rec.name_en : rec.name_en || rec.name_ar) as string;
  }
  return code;
}
