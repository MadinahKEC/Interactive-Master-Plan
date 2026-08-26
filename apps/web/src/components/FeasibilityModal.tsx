import { useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
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

/** Add thousands separators to a raw numeric string while it is being typed. */
function fmtNum(raw: string): string {
  if (raw === '' || raw === '.') return raw;
  const dot = raw.indexOf('.');
  const intPart = dot >= 0 ? raw.slice(0, dot) : raw;
  const decPart = dot >= 0 ? raw.slice(dot + 1) : null;
  const intF = intPart === '' ? '' : Number(intPart).toLocaleString('en-US');
  return decPart !== null ? `${intF === '' ? '0' : intF}.${decPart}` : intF;
}
/** Number input that shows 1,000 separators as you type without ever yanking the caret. */
function NumInput({ value, onChange }: { value: string; onChange: (raw: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (caret.current != null && ref.current) { ref.current.setSelectionRange(caret.current, caret.current); caret.current = null; }
  });
  const onIn = (e: ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const digitsBefore = (el.value.slice(0, el.selectionStart ?? el.value.length).match(/[0-9]/g) || []).length;
    let raw = el.value.replace(/[^0-9.]/g, '');
    const i = raw.indexOf('.');
    if (i >= 0) raw = raw.slice(0, i + 1) + raw.slice(i + 1).replace(/\./g, ''); // keep a single dot
    const formatted = fmtNum(raw);
    let pos = 0, seen = 0;
    while (pos < formatted.length && seen < digitsBefore) { if (/[0-9]/.test(formatted[pos])) seen++; pos++; }
    caret.current = pos;
    onChange(raw);
  };
  return <input ref={ref} inputMode="decimal" value={fmtNum(value)} onChange={onIn} />;
}

type FStr = Record<keyof FeasInputs, string>;
const toStr = (o: FeasInputs): FStr => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v ? String(v) : ''])) as FStr;
const toNum = (s: FStr): FeasInputs => ({
  gsa: +s.gsa || 0, salePrice: +s.salePrice || 0, buildCost: +s.buildCost || 0, landCost: +s.landCost || 0,
  softPct: +s.softPct || 0, devMonths: +s.devMonths || 0, salesMonths: +s.salesMonths || 0, discount: +s.discount || 0,
});

/** Interactive feasibility (DCF): investor assumptions → IRR / NPV / ROI / MOIC / payback + sensitivity. */
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
  // raw string state so re-formatting never yanks the caret out of the field
  const [fs, setFs] = useState<FStr>(() => toStr({ ...DEFAULT_FEAS, gsa: Math.round(inv.gsa || plot.gfa || plot.area || 0) }));
  const up = (k: keyof FeasInputs, v: string) => setFs((s) => ({ ...s, [k]: v.replace(/[^0-9.]/g, '') }));
  const f = useMemo(() => toNum(fs), [fs]);
  const r = useMemo(() => computeFeasibility(f), [f]);
  const rtl = lang === 'ar';

  // sensitivity: project IRR as sale price / build cost shift ±20%
  const steps = [-0.2, -0.1, 0, 0.1, 0.2];
  const priceSens = useMemo(() => steps.map((d) => computeFeasibility({ ...f, salePrice: f.salePrice * (1 + d) }).irrAnnual), [f]);
  const costSens = useMemo(() => steps.map((d) => computeFeasibility({ ...f, buildCost: f.buildCost * (1 + d) }).irrAnnual), [f]);

  const save = () => {
    setProject(plot.code, {
      investment: {
        ...inv, gsa: Math.round(f.gsa), totalValue: Math.round(r.revenue), devCost: Math.round(r.cost),
        npv: Math.round(r.npv), roi: +r.roi.toFixed(1), moic: +r.moic.toFixed(2),
        projectIRR: r.irrAnnual == null ? inv.projectIRR : +r.irrAnnual.toFixed(1),
        payback: r.paybackMonths == null ? inv.payback : +(r.paybackMonths / 12).toFixed(1),
      },
    });
    onClose();
  };

  const FIELDS: { k: keyof FeasInputs; label: string }[] = [
    { k: 'gsa', label: t('fe.gsa', lang) }, { k: 'salePrice', label: t('fe.salePrice', lang) },
    { k: 'buildCost', label: t('fe.buildCost', lang) }, { k: 'landCost', label: t('fe.landCost', lang) },
    { k: 'softPct', label: t('fe.softPct', lang) }, { k: 'discount', label: t('fe.discount', lang) },
    { k: 'devMonths', label: t('fe.devMonths', lang) }, { k: 'salesMonths', label: t('fe.salesMonths', lang) },
  ];

  return createPortal(
    <div className="modal-wrap" onClick={onClose}>
      <div className="modal fe-modal" dir={rtl ? 'rtl' : 'ltr'} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><b>{t('fe.title', lang)} · <span className="mono">{plot.code}</span></b><button className="ic-btn" onClick={onClose}><IconClose size={17} /></button></div>
        <div className="modal-body fe-body">
          <div className="fe-sec">{t('fe.inputs', lang)}</div>
          <div className="fe-grid">
            {FIELDS.map(({ k, label }) => (
              <label className="fe-field" key={k}><span>{label}</span>
                <NumInput value={fs[k]} onChange={(raw) => up(k, raw)} />
              </label>
            ))}
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

          <div className="fe-sec">{t('fe.sensitivity', lang)} <span className="fe-sec-hint">{t('fe.sensHint', lang)}</span></div>
          <SensRow label={t('fe.priceSens', lang)} steps={steps} vals={priceSens} />
          <SensRow label={t('fe.costSens', lang)} steps={steps} vals={costSens} />

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

function SensRow({ label, steps, vals }: { label: string; steps: number[]; vals: (number | null)[] }) {
  const nums = vals.map((v) => (v == null ? 0 : v));
  const max = Math.max(1, ...nums.map((v) => Math.abs(v)));
  return (
    <div className="fe-sens">
      <div className="fe-sens-l">{label}</div>
      <div className="fe-sens-bars">
        {steps.map((d, i) => {
          const v = vals[i];
          const h = v == null ? 0 : Math.max(4, (Math.abs(v) / max) * 46);
          const col = v == null ? 'var(--kec-hairline)' : v >= 0 ? '#2F6B3E' : '#B5462F';
          return (
            <div className="fe-sens-col" key={i}>
              <span className="fe-sens-v">{v == null ? '—' : `${v.toFixed(0)}%`}</span>
              <span className="fe-sens-bar" style={{ height: `${h}px`, background: col }} />
              <span className="fe-sens-x">{d === 0 ? '0' : `${d > 0 ? '+' : ''}${d * 100}%`}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
