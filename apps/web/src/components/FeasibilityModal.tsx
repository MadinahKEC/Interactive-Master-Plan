import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { can, type PlotProps } from '@kec/types';
import { t, type ProjectInfo } from '../lib/domain';
import { computeFeasibility, DEFAULT_FEAS, type FeasInputs } from '../lib/investment';
import { useApp } from '../store';
import { useAuth } from '../lib/auth';
import { useOverrides } from '../lib/overrides';
import { useBackClose } from '../lib/backstack';
import { IconClose } from './icons';

const nf = new Intl.NumberFormat('en-US');
const fmtSar = (v: number, lang: 'ar' | 'en') => `${nf.format(Math.round(v))} ${lang === 'ar' ? 'ر.س' : 'SAR'}`;

/** Interactive feasibility (DCF): investor assumptions → IRR / NPV / ROI / MOIC / payback. */
export function FeasibilityModal({ plot, projects, onClose }: {
  plot: PlotProps; projects: Record<string, ProjectInfo>; onClose: () => void;
}) {
  const { lang } = useApp();
  const role = useAuth((s) => s.user?.role);
  const canAttr = can(role as any, 'plot:attr:update');
  const setProject = useOverrides((s) => s.setProject);
  useBackClose(true, onClose, 100);
  const o = projects[plot.code] ?? {};
  const inv = o.investment ?? {};
  const [f, setF] = useState<FeasInputs>({ ...DEFAULT_FEAS, gsa: Math.round(inv.gsa || plot.gfa || plot.area || 0) });
  const up = (k: keyof FeasInputs, v: string) => setF((s) => ({ ...s, [k]: v === '' ? 0 : Number(v.replace(/,/g, '')) }));
  const r = useMemo(() => computeFeasibility(f), [f]);
  const rtl = lang === 'ar';

  const save = () => {
    setProject(plot.code, {
      investment: {
        ...inv,
        gsa: Math.round(f.gsa),
        totalValue: Math.round(r.revenue),
        devCost: Math.round(r.cost),
        npv: Math.round(r.npv),
        roi: +r.roi.toFixed(1),
        moic: +r.moic.toFixed(2),
        projectIRR: r.irrAnnual == null ? inv.projectIRR : +r.irrAnnual.toFixed(1),
        payback: r.paybackMonths == null ? inv.payback : +(r.paybackMonths / 12).toFixed(1),
      },
    });
    onClose();
  };

  const F = ({ k, label }: { k: keyof FeasInputs; label: string }) => (
    <label className="fe-field"><span>{label}</span>
      <input inputMode="decimal" value={f[k] === 0 ? '' : nf.format(f[k])} onChange={(e) => up(k, e.target.value)} />
    </label>
  );

  return createPortal(
    <div className="modal-wrap" onClick={onClose}>
      <div className="modal fe-modal" dir={rtl ? 'rtl' : 'ltr'} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><b>{t('fe.title', lang)} · <span className="mono">{plot.code}</span></b><button className="ic-btn" onClick={onClose}><IconClose size={17} /></button></div>
        <div className="modal-body fe-body">
          <div className="fe-sec">{t('fe.inputs', lang)}</div>
          <div className="fe-grid">
            <F k="gsa" label={t('fe.gsa', lang)} />
            <F k="salePrice" label={t('fe.salePrice', lang)} />
            <F k="buildCost" label={t('fe.buildCost', lang)} />
            <F k="landCost" label={t('fe.landCost', lang)} />
            <F k="softPct" label={t('fe.softPct', lang)} />
            <F k="discount" label={t('fe.discount', lang)} />
            <F k="devMonths" label={t('fe.devMonths', lang)} />
            <F k="salesMonths" label={t('fe.salesMonths', lang)} />
          </div>

          <div className="fe-sec">{t('fe.results', lang)}</div>
          <div className="fe-results">
            <Res l={t('fe.revenue', lang)} v={fmtSar(r.revenue, lang)} />
            <Res l={t('fe.cost', lang)} v={fmtSar(r.cost, lang)} />
            <Res l={t('fe.profit', lang)} v={fmtSar(r.profit, lang)} good={r.profit >= 0} bad={r.profit < 0} />
            <Res l={t('fe.roi', lang)} v={`${r.roi.toFixed(1)}%`} good={r.roi >= 0} bad={r.roi < 0} />
            <Res l={t('fe.irr', lang)} v={r.irrAnnual == null ? '—' : `${r.irrAnnual.toFixed(1)}%`} />
            <Res l={t('fe.npv', lang)} v={fmtSar(r.npv, lang)} good={r.npv >= 0} bad={r.npv < 0} />
            <Res l={t('fe.moic', lang)} v={`${r.moic.toFixed(2)}×`} />
            <Res l={t('fe.payback', lang)} v={r.paybackMonths == null ? '—' : `${r.paybackMonths} ${t('fe.months', lang)}`} />
          </div>
          <p className="fe-note">{t('ia.disclaimer', lang)}</p>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>{t('report.close', lang)}</button>
          {canAttr && <button className="btn primary" onClick={save}>{t('fe.saveToPlot', lang)}</button>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Res({ l, v, good, bad }: { l: string; v: string; good?: boolean; bad?: boolean }) {
  return (
    <div className={`fe-res ${good ? 'good' : ''} ${bad ? 'bad' : ''}`}>
      <div className="fe-res-v">{v}</div>
      <div className="fe-res-l">{l}</div>
    </div>
  );
}
