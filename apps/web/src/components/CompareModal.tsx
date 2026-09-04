import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { PlotCollection } from '@kec/types';
import { SECTORS } from '@kec/types';
import { useApp } from '../store';
import { useShortlist } from '../lib/shortlist';
import { resolveProject, t, type ProjectInfo } from '../lib/domain';
import type { EffLandUse } from '../lib/effective';
import { IconClose, IconZoom, IconTrash, IconCompare, TypeIcon } from './icons';
import { useBackClose } from '../lib/backstack';

const nf = (v: number | null | undefined, d = 0) => (v || v === 0 ? new Intl.NumberFormat('en-US', { maximumFractionDigits: d }).format(v) : '—');

/** Side-by-side comparison of the shortlisted plots — the comparison hub (opened from the rail). */
export function CompareModal({ data, projects, landUses, onClose }: {
  data: PlotCollection; projects: Record<string, ProjectInfo>; landUses: Record<string, EffLandUse>; onClose: () => void;
}) {
  const { lang, select, requestZoom } = useApp();
  const codes = useShortlist((s) => s.codes);
  const toggle = useShortlist((s) => s.toggle);
  const clear = useShortlist((s) => s.clear);
  useBackClose(true, onClose, 100);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const items = codes.map((c) => data.features.find((f) => f.properties.code === c)?.properties).filter(Boolean) as any[];

  const rows: { label: string; get: (p: any, pr: ReturnType<typeof resolveProject>) => string; higher?: boolean }[] = [
    { label: t('d.landuse', lang), get: (p) => { const lu = landUses[p.land_use]; return lu ? (lang === 'ar' ? lu.labelAr : lu.labelEn) : (p.land_use ?? '—'); } },
    { label: t('d.sector', lang), get: (p) => (lang === 'ar' ? SECTORS[p.sector as keyof typeof SECTORS]?.labelAr ?? p.sector : p.sector) },
    { label: `${t('d.area', lang)} (m²)`, get: (p) => nf(p.area, 0), higher: true },
    { label: 'GFA (m²)', get: (p) => nf(p.gfa, 0), higher: true },
    { label: t('d.floors', lang), get: (p) => nf(p.floors), higher: true },
    { label: t('d.height', lang), get: (p) => nf(p.height), higher: true },
    { label: t('d.coverage', lang), get: (p) => nf(p.coverage, 2), higher: true },
    { label: t('d.far', lang), get: (p) => nf(p.far, 2), higher: true },
    { label: t('sec.ownership', lang), get: (_p, pr) => pr.owner || '—' },
  ];

  return createPortal(
    <div className="cmp-wrap" onClick={onClose}>
      <div className="cmp-modal" style={{ ['--mod' as string]: '#2F6B3E' }} dir={lang === 'ar' ? 'rtl' : 'ltr'} onClick={(e) => e.stopPropagation()}>
        <header className="cmp-head">
          <span className="cmp-hicon"><IconCompare size={18} /></span>
          <div className="cmp-htitle">
            <span className="cmp-kicker">{t('brand.title', lang)}</span>
            <b>{t('cmp.title', lang)}</b>
          </div>
          {items.length > 0 && <span className="cmp-count">{items.length}</span>}
          <div className="cmp-head-acts">
            {codes.length > 0 && <button className="btn sm" onClick={clear}><IconTrash size={13} /> {t('sl.clear', lang)}</button>}
            <button className="ic-btn" onClick={onClose}><IconClose size={18} /></button>
          </div>
        </header>

        <div className="cmp-body">
          {items.length === 0 ? (
            <div className="cmp-empty">
              <span className="cmp-empty-ic"><IconCompare size={34} /></span>
              <b>{t('cmp.empty', lang)}</b>
              <span>{t('cmp.emptyHint', lang)}</span>
            </div>
          ) : (
            <>
              {items.length === 1 && <div className="cmp-note">{t('cmp.needMore', lang)}</div>}
              <div className="cmp-scroll">
                <table className="cmp-table">
                  <thead>
                    <tr>
                      <th className="cmp-attr" />
                      {items.map((p) => {
                        const pr = resolveProject(p.code, p.land_use, projects);
                        const name = pr.named ? (lang === 'ar' ? pr.overlay.name_ar || pr.overlay.name_en : pr.overlay.name_en || pr.overlay.name_ar) : (lang === 'ar' ? 'بدون اسم' : 'Unnamed');
                        return (
                          <th key={p.code} className="cmp-h">
                            <div className="cmp-h-top">
                              <span className="cmp-h-ic"><TypeIcon typeKey={pr.type.key} size={15} /></span>
                              <button className="cmp-x" title={t('sl.remove', lang)} onClick={() => toggle(p.code)}><IconClose size={13} /></button>
                            </div>
                            <div className="cmp-name" title={name}>{name}</div>
                            <div className="cmp-code mono">{p.code}</div>
                            <span className="cmp-status" style={{ background: pr.status.color }}>{lang === 'ar' ? pr.status.ar : pr.status.en}</span>
                            <button className="cmp-view" onClick={() => { select(p); requestZoom(p.code); onClose(); }}><IconZoom size={12} /> {t('d.zoom', lang)}</button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const vals = items.map((p) => r.get(p, resolveProject(p.code, p.land_use, projects)));
                      const nums = vals.map((v) => Number(String(v).replace(/,/g, '')));
                      const valid = nums.filter((n) => !isNaN(n));
                      const best = r.higher && valid.length > 1 ? Math.max(...valid) : NaN;
                      return (
                        <tr key={r.label}>
                          <td className="cmp-attr">{r.label}</td>
                          {vals.map((v, i) => (
                            <td key={i} className={`mono ${!isNaN(best) && nums[i] === best && best > 0 ? 'cmp-best' : ''}`}>{v}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
