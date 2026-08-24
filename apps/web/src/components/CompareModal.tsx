import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { PlotCollection } from '@kec/types';
import { SECTORS } from '@kec/types';
import { useApp } from '../store';
import { resolveProject, t, type ProjectInfo } from '../lib/domain';
import type { EffLandUse } from '../lib/effective';
import { IconClose, IconZoom } from './icons';
import { useBackClose } from '../lib/backstack';

const nf = (v: number | null | undefined, d = 0) => (v || v === 0 ? new Intl.NumberFormat('en-US', { maximumFractionDigits: d }).format(v) : '—');

/** Side-by-side comparison of up to several plots (from the shortlist). */
export function CompareModal({ codes, data, projects, landUses, onClose }: {
  codes: string[]; data: PlotCollection; projects: Record<string, ProjectInfo>; landUses: Record<string, EffLandUse>; onClose: () => void;
}) {
  const { lang, select, requestZoom } = useApp();
  useBackClose(true, onClose, 100);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const items = codes.map((c) => data.features.find((f) => f.properties.code === c)?.properties).filter(Boolean) as any[];
  if (!items.length) return null;

  const rows: { label: string; get: (p: any, pr: ReturnType<typeof resolveProject>) => string }[] = [
    { label: t('d.landuse', lang), get: (p) => { const lu = landUses[p.land_use]; return lu ? (lang === 'ar' ? lu.labelAr : lu.labelEn) : (p.land_use ?? '—'); } },
    { label: t('d.sector', lang), get: (p) => (lang === 'ar' ? SECTORS[p.sector as keyof typeof SECTORS]?.labelAr ?? p.sector : p.sector) },
    { label: t('d.status', lang), get: (_p, pr) => (lang === 'ar' ? pr.status.ar : pr.status.en) },
    { label: `${t('d.area', lang)} (m²)`, get: (p) => nf(p.area, 0) },
    { label: 'GFA', get: (p) => nf(p.gfa, 0) },
    { label: t('d.floors', lang), get: (p) => nf(p.floors) },
    { label: t('d.height', lang), get: (p) => nf(p.height) },
    { label: t('d.coverage', lang), get: (p) => nf(p.coverage, 2) },
    { label: t('d.far', lang), get: (p) => nf(p.far, 2) },
    { label: t('sec.ownership', lang), get: (_p, pr) => pr.owner || '—' },
  ];

  return createPortal(
    <div className="modal-wrap dlg-wrap" onClick={onClose}>
      <div className="modal cmp-modal" dir={lang === 'ar' ? 'rtl' : 'ltr'} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><b>{t('cmp.title', lang)} · {items.length}</b><button className="ic-btn" onClick={onClose}><IconClose size={17} /></button></div>
        <div className="modal-body cmp-body">
          <table className="cmp-table">
            <thead>
              <tr>
                <th className="cmp-attr" />
                {items.map((p) => {
                  const pr = resolveProject(p.code, p.land_use, projects);
                  const name = pr.named ? (lang === 'ar' ? pr.overlay.name_ar || pr.overlay.name_en : pr.overlay.name_en || pr.overlay.name_ar) : p.code;
                  return (
                    <th key={p.code} className="cmp-h">
                      <div className="cmp-name">{name}</div>
                      <div className="cmp-code mono">{p.code}</div>
                      <div className="cmp-acts">
                        <button className="mini-btn" title={t('d.zoom', lang)} onClick={() => { select(p); requestZoom(p.code); onClose(); }}><IconZoom size={12} /></button>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                // highlight the max numeric value in the row
                const vals = items.map((p) => r.get(p, resolveProject(p.code, p.land_use, projects)));
                const nums = vals.map((v) => Number(String(v).replace(/,/g, '')));
                const max = Math.max(...nums.filter((n) => !isNaN(n)));
                return (
                  <tr key={r.label}>
                    <td className="cmp-attr">{r.label}</td>
                    {vals.map((v, i) => (
                      <td key={i} className={`mono ${!isNaN(nums[i]) && nums[i] === max && max > 0 ? 'cmp-best' : ''}`}>{v}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    document.body,
  );
}
