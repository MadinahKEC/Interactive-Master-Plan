import { useMemo, useState } from 'react';
import { LAND_USES, type PlotCollection } from '@kec/types';
import { useApp } from '../store';
import { useOverrides, type SubPlotRecord } from '../lib/overrides';
import { t } from '../lib/domain';
import { splitPolygon, multaqaSubdivision, geomArea } from '../lib/subdivide';
import { IconClose, IconPlus, IconTrash, IconMerge } from './icons';

interface Part { name_ar: string; name_en: string; land_use: string; area: number; floors: number; far: number; coverage: number; height: number }

// The Multaqa Park Side layout belongs to plot C36-1 only. Order matters — it maps
// 1:1 onto multaqaSubdivision's [west, centre, east, park, retail] output.
const MULTAQA_CODE = 'C36-1';
const MULTAQA_PRESET: Part[] = [
  { name_ar: 'ملتقى المدينة — غرب', name_en: 'Multaqa Park Side West', land_use: 'High Density Residential & Commercial', area: 16737, floors: 20, far: 3.48, coverage: 0.84, height: 70 },
  { name_ar: 'ملتقى المدينة — شرق 01', name_en: 'Multaqa Park Side East-01', land_use: 'High Density Residential & Commercial', area: 21133, floors: 20, far: 3.11, coverage: 0.84, height: 70 },
  { name_ar: 'ملتقى المدينة — شرق 02', name_en: 'Multaqa Park Side East-02', land_use: 'High Density Residential & Commercial', area: 21783, floors: 16, far: 3.04, coverage: 0.84, height: 56 },
  { name_ar: 'ملتقى المدينة — الحديقة المركزية', name_en: 'Multaqa Park Side Central Park', land_use: 'Open Space', area: 8423, floors: 0, far: 0, coverage: 0, height: 0 },
  { name_ar: 'ملتقى المدينة — مكاتب وتجزئة', name_en: 'Multaqa Park Side Offices & Retail', land_use: 'High Density Mixed-Use', area: 32390, floors: 4, far: 1.20, coverage: 0.80, height: 20 },
];

const blankPart = (): Part => ({ name_ar: '', name_en: '', land_use: 'High Density Residential & Commercial', area: 10000, floors: 1, far: 1, coverage: 0.5, height: 3 });

export function SubdivideModal({ parentCode, data, onClose }: { parentCode: string; data: PlotCollection | null; onClose: () => void }) {
  const { lang } = useApp();
  const splits = useOverrides((s) => s.splits);
  const subdividePlot = useOverrides((s) => s.subdividePlot);
  const unsubdivide = useOverrides((s) => s.unsubdivide);
  const alreadySplit = !!splits[parentCode];

  const parentFeat = useMemo(() => data?.features.find((f) => f.properties.code === parentCode), [data, parentCode]);
  const parentArea = parentFeat ? Math.round(geomArea(parentFeat.geometry)) : 0;

  const isMultaqa = parentCode === MULTAQA_CODE;
  const [parts, setParts] = useState<Part[]>(() => (isMultaqa ? MULTAQA_PRESET.map((p) => ({ ...p })) : [blankPart(), blankPart()]));
  const upPart = (i: number, patch: Partial<Part>) => setParts((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const num = new Intl.NumberFormat('en-US');

  const apply = () => {
    if (!parentFeat || parts.length < 2) return;
    const targets = parts.map((p) => Math.max(1, p.area));
    const useLayout = isMultaqa && parts.length === 5; // wrap-around layout for C36-1
    const geoms = useLayout
      ? multaqaSubdivision(parentFeat.geometry, targets)
      : splitPolygon(parentFeat.geometry, targets);
    const records: SubPlotRecord[] = parts.map((p, i) => {
      // For the Multaqa plan the plot figures come from the document (p.area/p.far),
      // not the drawn footprint; the generic splitter reports the true geometric area.
      const a = useLayout ? Math.max(1, p.area) : Math.round(geomArea(geoms[i]));
      return {
        code: `${parentCode}-${String(i + 1).padStart(2, '0')}`,
        name_ar: p.name_ar || undefined, name_en: p.name_en || undefined,
        land_use: p.land_use, area: a,
        gfa: p.far ? Math.round(p.far * a) : undefined,
        floors: p.floors || undefined, height: p.height || undefined,
        coverage: p.coverage || undefined, far: p.far || undefined,
        geometry: geoms[i],
      };
    });
    subdividePlot(parentCode, records);
    onClose();
  };

  return (
    <div className="modal-wrap" onClick={onClose}>
      <div className="modal sub-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div><b>{t('sub.title', lang)}</b> <span className="mono sub-code">{parentCode}</span> {parentArea > 0 && <span className="sub-area">· {num.format(parentArea)} m²</span>}</div>
          <button className="ic-btn" onClick={onClose}><IconClose size={17} /></button>
        </div>

        {alreadySplit ? (
          <div className="modal-body">
            <div className="sub-already">{t('sub.already', lang)} — {splits[parentCode].length} {t('sub.parts', lang)}</div>
            <p className="sub-hint" style={{ margin: '2px 0 10px' }}>{t('sub.mergeInfo', lang)}</p>
            <button className="btn danger" onClick={() => { unsubdivide(parentCode); onClose(); }}><IconMerge size={14} /> {t('sub.undo', lang)}</button>
          </div>
        ) : (
          <>
            <div className="modal-toolbar">
              {isMultaqa && <button className="btn sm" onClick={() => setParts(MULTAQA_PRESET.map((p) => ({ ...p })))}>{t('sub.preset', lang)}</button>}
              <button className="btn sm" onClick={() => setParts((ps) => [...ps, blankPart()])}><IconPlus size={13} /> {t('sub.addPart', lang)}</button>
              <span className="sub-hint">{isMultaqa ? t('sub.presetHint', lang) : t('sub.hint', lang)}</span>
            </div>
            <div className="modal-body sub-parts">
              {parts.map((p, i) => (
                <div className="sub-part" key={i}>
                  <div className="sub-part-idx">{i + 1}</div>
                  <div className="sub-part-fields">
                    <input className="sp-name" placeholder={t('a.name', lang)} value={lang === 'ar' ? p.name_ar : p.name_en} onChange={(e) => upPart(i, lang === 'ar' ? { name_ar: e.target.value } : { name_en: e.target.value })} />
                    <select value={p.land_use} onChange={(e) => upPart(i, { land_use: e.target.value })}>
                      {Object.keys(LAND_USES).map((k) => <option key={k} value={k}>{lang === 'ar' ? LAND_USES[k].labelAr : k}</option>)}
                    </select>
                    <label className="sp-num"><span>{t('sub.targetArea', lang)}</span><input type="number" value={p.area} onChange={(e) => upPart(i, { area: Number(e.target.value) })} /></label>
                    <label className="sp-num"><span>{t('d.floors', lang)}</span><input type="number" value={p.floors} onChange={(e) => upPart(i, { floors: Number(e.target.value) })} /></label>
                    <label className="sp-num"><span>FAR</span><input type="number" step="0.01" value={p.far} onChange={(e) => upPart(i, { far: Number(e.target.value) })} /></label>
                  </div>
                  <button className="mini-btn danger" onClick={() => setParts((ps) => ps.filter((_, j) => j !== i))}><IconTrash size={13} /></button>
                </div>
              ))}
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={onClose}>{t('a.cancel', lang)}</button>
              <button className="btn primary" disabled={parts.length < 2 || !parentFeat} onClick={apply}>{t('sub.apply', lang)}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
