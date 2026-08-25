import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { SECTORS, type PlotCollection } from '@kec/types';
import { resolveProject, STATUS_META, OWNERSHIP_META, INVESTOR_STATUSES, investorStatusMeta, t, type ProjectInfo } from '../lib/domain';
import { useApp } from '../store';
import { useOverrides } from '../lib/overrides';
import { useBackClose } from '../lib/backstack';
import { Chart } from '../admin/Chart';
import { IconClose, IconExport, IconPlots, IconInvest, IconBuilding } from './icons';
import type { EffLandUse } from '../lib/effective';

const nf = new Intl.NumberFormat('en-US');
const compact = (v: number) => (Math.abs(v) >= 1e9 ? (v / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B' : Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1).replace(/\.?0+$/, '') + 'M' : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(1).replace(/\.?0+$/, '') + 'K' : nf.format(Math.round(v)));

/** Leadership-facing, print-ready cockpit for the whole master plan. */
export function ExecDashboard({ data, projects, landUses, onClose }: {
  data: PlotCollection; projects: Record<string, ProjectInfo>; landUses: Record<string, EffLandUse>; onClose: () => void;
}) {
  const { lang } = useApp();
  const investors = useOverrides((s) => s.investors);
  useBackClose(true, onClose, 70);
  const rtl = lang === 'ar';
  const sar = lang === 'ar' ? 'ر.س' : 'SAR';

  const s = useMemo(() => {
    let gfa = 0, area = 0, farW = 0, developable = 0, developed = 0, underDev = 0, portfolio = 0, named = 0, permits = 0;
    const luArea: Record<string, number> = {}, st: Record<string, number> = {}, secGfa: Record<string, number> = {};
    const own: Record<string, number> = {}, secCount: Record<string, number> = {}, secArea: Record<string, number> = {}, secDev: Record<string, number> = {};
    for (const f of data.features) {
      const p = f.properties; const pr = resolveProject(p.code, p.land_use, projects); const o = projects[p.code] ?? {};
      area += p.area || 0; gfa += p.gfa || 0; farW += (p.far || 0) * (p.area || 0);
      if ((p.far || 0) > 0) developable += p.area || 0;
      if (pr.status.key === 'Completed') { developed += p.area || 0; secDev[p.sector] = (secDev[p.sector] || 0) + (p.area || 0); }
      if (pr.status.key === 'UnderConstruction') underDev += p.area || 0;
      if (pr.named) named++;
      if (o.license) permits++;
      luArea[p.land_use ?? ''] = (luArea[p.land_use ?? ''] || 0) + (p.area || 0);
      st[pr.status.key] = (st[pr.status.key] || 0) + 1;
      secGfa[p.sector] = (secGfa[p.sector] || 0) + (p.gfa || 0);
      secCount[p.sector] = (secCount[p.sector] || 0) + 1;
      secArea[p.sector] = (secArea[p.sector] || 0) + (p.area || 0);
      own[pr.ownership.key] = (own[pr.ownership.key] || 0) + 1;
      const iv = projects[p.code]?.investment?.totalValue; if (iv) portfolio += iv;
    }
    const pipe: Record<string, number> = {}; let leads = 0;
    for (const code in investors) for (const l of investors[code]) { pipe[l.status] = (pipe[l.status] || 0) + 1; leads++; }
    const n = data.features.length;
    return { area, gfa, developable, developed, underDev, avgFar: area ? farW / area : 0, luArea, st, secGfa, secCount, secArea, secDev, own, portfolio, pipe, leads, named, permits, avgSize: n ? area / n : 0, n };
  }, [data, projects, investors]);

  const devPct = s.area ? (s.developed / s.area) * 100 : 0;
  const underPct = s.area ? (s.underDev / s.area) * 100 : 0;
  const ref = `KEC-EXE-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const donut = (title: string, obj: Record<string, number>, colorOf: (k: string) => string, labelOf: (k: string) => string, valFmt?: (v: number) => string) => ({
    title: { text: title, left: 8, top: 6, textStyle: { fontSize: 13, color: '#1C6034', fontWeight: 700 as any } },
    tooltip: { trigger: 'item', valueFormatter: valFmt },
    legend: { type: 'scroll', bottom: 0, textStyle: { fontSize: 10 } },
    series: [{ type: 'pie', radius: ['42%', '68%'], center: ['50%', '52%'], avoidLabelOverlap: true, label: { show: false }, data: Object.keys(obj).filter((k) => obj[k] > 0).map((k) => ({ name: labelOf(k), value: Math.round(obj[k]), itemStyle: { color: colorOf(k) } })) }],
  });
  const bar = (title: string, keys: string[], vals: number[], color: string, labelOf: (k: string) => string, valFmt?: (v: number) => string) => ({
    title: { text: title, left: 8, top: 6, textStyle: { fontSize: 13, color: '#1C6034', fontWeight: 700 as any } },
    grid: { left: 44, right: 16, top: 44, bottom: 40 }, tooltip: { trigger: 'axis', valueFormatter: valFmt },
    xAxis: { type: 'category', data: keys.map(labelOf), axisLabel: { fontSize: 10, interval: 0, rotate: keys.length > 4 ? 20 : 0 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 10, formatter: (v: number) => compact(v) } },
    series: [{ type: 'bar', data: vals.map((v) => Math.round(v)), itemStyle: { color, borderRadius: [6, 6, 0, 0] } }],
  });

  const secKeys = Object.keys(SECTORS).filter((k) => s.secGfa[k]);
  const pipeKeys = INVESTOR_STATUSES.map((x) => x.key).filter((k) => s.pipe[k]);

  return createPortal(
    <div className="exec-overlay" dir={rtl ? 'rtl' : 'ltr'}>
      <div className="exec-sheet">
        <header className="exec-head">
          <div className="exec-title">
            <div className="exec-h1">{t('exec.title', lang)}</div>
            <div className="exec-sub">{t('brand.title', lang)} · <span className="mono">{ref}</span> · {new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-GB')}</div>
          </div>
          <img className="exec-logo" src={import.meta.env.BASE_URL + 'KEC.png'} alt="KEC" />
          <div className="exec-acts no-print">
            <button className="btn sm" onClick={() => { window.dispatchEvent(new Event('resize')); setTimeout(() => window.print(), 180); }}><IconExport size={14} /> {t('exec.print', lang)}</button>
            <button className="ic-btn" onClick={onClose}><IconClose size={18} /></button>
          </div>
        </header>

        <div className="exec-strip">
          <Kpi icon={<IconPlots size={16} />} v={nf.format(s.n)} l={t('exec.plots', lang)} />
          <Kpi icon={<IconBuilding size={16} />} v={compact(s.gfa)} l={`${t('kpi.gfa', lang)}`} />
          <Kpi icon={<IconBuilding size={16} />} v={compact(s.area)} l={`${t('kpi.area', lang)}`} />
          <Kpi icon={<IconBuilding size={16} />} v={compact(s.developable)} l={t('report.developable', lang)} />
          <Kpi icon={<IconInvest size={16} />} v={`${s.avgFar.toFixed(2)}`} l={t('exec.avgFar', lang)} />
          <Kpi icon={<IconInvest size={16} />} v={`${compact(s.portfolio)} ${sar}`} l={t('exec.portfolio', lang)} accent />
        </div>

        <div className="exec-sats">
          <Sat v={nf.format(s.named)} l={t('exec.named', lang)} />
          <Sat v={nf.format(s.own.available || 0)} l={lang === 'ar' ? OWNERSHIP_META.available.ar : OWNERSHIP_META.available.en} c={OWNERSHIP_META.available.color} />
          <Sat v={nf.format(s.own.reserved || 0)} l={lang === 'ar' ? OWNERSHIP_META.reserved.ar : OWNERSHIP_META.reserved.en} c={OWNERSHIP_META.reserved.color} />
          <Sat v={nf.format(s.own.owned || 0)} l={lang === 'ar' ? OWNERSHIP_META.owned.ar : OWNERSHIP_META.owned.en} c={OWNERSHIP_META.owned.color} />
          <Sat v={nf.format(s.permits)} l={t('exec.permits', lang)} />
          <Sat v={`${compact(s.avgSize)} m²`} l={t('exec.avgSize', lang)} />
          <Sat v={`${s.leads}`} l={t('exec.pipeline', lang)} />
        </div>

        <div className="exec-hero">
          <div className="exec-hero-fig">
            <div className="exec-hero-pct">{devPct.toFixed(1)}<span>%</span></div>
            <div className="exec-hero-l">{t('exec.developed', lang)} <em>{t('exec.ofTotal', lang)}</em></div>
          </div>
          <div className="exec-hero-bar">
            <div className="ehb-track">
              <span className="ehb-seg done" style={{ width: `${devPct}%` }} title={t('exec.developed', lang)} />
              <span className="ehb-seg dev" style={{ width: `${underPct}%` }} title={t('exec.underdev', lang)} />
            </div>
            <div className="ehb-legend">
              <span><i style={{ background: '#2F6B3E' }} />{t('exec.developed', lang)} · {compact(s.developed)} m²</span>
              <span><i style={{ background: '#9A8A1E' }} />{t('exec.underdev', lang)} · {compact(s.underDev)} m²</span>
              <span><i style={{ background: 'var(--kec-hairline)' }} />{compact(s.area - s.developed - s.underDev)} m²</span>
            </div>
          </div>
        </div>

        <div className="exec-charts">
          <div className="exec-chart"><Chart height={220} option={donut(t('report.luMix', lang), s.luArea, (k) => landUses[k]?.color ?? '#ccc', (k) => (lang === 'ar' ? landUses[k]?.labelAr ?? k : landUses[k]?.labelEn ?? k), (v: any) => compact(v) + ' m²')} /></div>
          <div className="exec-chart"><Chart height={220} option={donut(t('exec.byStatus', lang), s.st, (k) => STATUS_META[k]?.color ?? '#ccc', (k) => (lang === 'ar' ? STATUS_META[k]?.ar ?? k : STATUS_META[k]?.en ?? k))} /></div>
          <div className="exec-chart"><Chart height={220} option={donut(t('exec.byOwnership', lang), s.own, (k) => OWNERSHIP_META[k]?.color ?? '#ccc', (k) => (lang === 'ar' ? OWNERSHIP_META[k]?.ar ?? k : OWNERSHIP_META[k]?.en ?? k))} /></div>
          <div className="exec-chart"><Chart height={220} option={bar(t('dash.gfaSector', lang), secKeys, secKeys.map((k) => s.secGfa[k]), '#2F6B3E', (k) => (lang === 'ar' ? SECTORS[k as keyof typeof SECTORS]?.labelAr ?? k : k), (v: any) => compact(v) + ' m²')} /></div>
          <div className="exec-chart"><Chart height={220} option={bar(t('exec.plotsBySector', lang), secKeys, secKeys.map((k) => s.secCount[k]), '#9A8A1E', (k) => (lang === 'ar' ? SECTORS[k as keyof typeof SECTORS]?.labelAr ?? k : k))} /></div>
          <div className="exec-chart">
            <div className="exec-pipe">
              <div className="exec-pipe-h">{t('exec.pipeline', lang)} · {s.leads} {t('exec.leads', lang)}</div>
              {pipeKeys.length === 0 && <div className="exec-pipe-empty">—</div>}
              {pipeKeys.map((k) => {
                const m = investorStatusMeta(k); const max = Math.max(...pipeKeys.map((x) => s.pipe[x]));
                return (
                  <div className="exec-pipe-row" key={k}>
                    <span className="epr-l">{lang === 'ar' ? m.ar : m.en}</span>
                    <span className="epr-bar"><span style={{ width: `${(s.pipe[k] / max) * 100}%`, background: m.color }} /></span>
                    <span className="epr-v">{s.pipe[k]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="exec-table-card">
          <div className="exec-table-h">{t('exec.sectorTable', lang)}</div>
          <table className="exec-table">
            <thead><tr>
              <th>{t('exec.tSector', lang)}</th><th>{t('exec.tPlots', lang)}</th><th>{t('exec.tArea', lang)}</th><th>{t('exec.tGfa', lang)}</th><th>{t('exec.tDev', lang)}</th>
            </tr></thead>
            <tbody>
              {secKeys.map((k) => (
                <tr key={k}>
                  <td>{lang === 'ar' ? SECTORS[k as keyof typeof SECTORS]?.labelAr ?? k : k}</td>
                  <td className="mono">{nf.format(s.secCount[k] || 0)}</td>
                  <td className="mono">{nf.format(Math.round(s.secArea[k] || 0))}</td>
                  <td className="mono">{nf.format(Math.round(s.secGfa[k] || 0))}</td>
                  <td className="mono">{((s.secArea[k] ? (s.secDev[k] || 0) / s.secArea[k] : 0) * 100).toFixed(1)}%</td>
                </tr>
              ))}
              <tr className="exec-table-total">
                <td>{t('exec.total', lang)}</td>
                <td className="mono">{nf.format(s.n)}</td>
                <td className="mono">{nf.format(Math.round(s.area))}</td>
                <td className="mono">{nf.format(Math.round(s.gfa))}</td>
                <td className="mono">{devPct.toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer className="exec-foot">
          <div className="exec-foot-rule" />
          <div className="exec-foot-row"><span className="exec-foot-bar" /><span>{t('powered', lang)} · {t('credit', lang)}</span></div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function Kpi({ icon, v, l, accent }: { icon: React.ReactNode; v: string; l: string; accent?: boolean }) {
  return (
    <div className={`exec-kpi ${accent ? 'accent' : ''}`}>
      <div className="ek-top">{icon}<span className="ek-l">{l}</span></div>
      <div className="ek-v">{v}</div>
    </div>
  );
}
function Sat({ v, l, c }: { v: string; l: string; c?: string }) {
  return (
    <div className="exec-sat">
      {c && <span className="es-dot" style={{ background: c }} />}
      <span className="es-v">{v}</span>
      <span className="es-l">{l}</span>
    </div>
  );
}
