import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { SECTORS, type PlotCollection } from '@kec/types';
import { resolveProject, STATUS_META, OWNERSHIP_META, INVESTOR_STATUSES, investorStatusMeta, t, type ProjectInfo } from '../lib/domain';
import { useApp } from '../store';
import { useOverrides } from '../lib/overrides';
import { useBackClose } from '../lib/backstack';
import { Chart } from '../admin/Chart';
import { IconClose, IconPlots, IconInvest, IconBuilding } from './icons';
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
  const ref = `KEC-EXE-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const titleOf = (text: string) => ({ text, left: 10, top: 7, textStyle: { fontSize: 13, color: '#1C6034', fontWeight: 700 as any } });
  // donut with the value printed inside each slice + a legend of names
  const donut = (title: string, obj: Record<string, number>, colorOf: (k: string) => string, labelOf: (k: string) => string, unit?: string) => ({
    title: titleOf(title),
    tooltip: { trigger: 'item', valueFormatter: (v: any) => nf.format(v) + (unit ? ' ' + unit : '') },
    legend: { type: 'scroll', bottom: 0, textStyle: { fontSize: 10 }, itemWidth: 11, itemHeight: 11 },
    series: [{ type: 'pie', radius: ['40%', '66%'], center: ['50%', '50%'], avoidLabelOverlap: true,
      label: { show: true, position: 'inside', formatter: (p: any) => (p.percent >= 6 ? compact(p.value) : ''), fontSize: 10, color: '#fff', fontWeight: 700 },
      labelLayout: { hideOverlap: true },
      data: Object.keys(obj).filter((k) => obj[k] > 0).map((k) => ({ name: labelOf(k), value: Math.round(obj[k]), itemStyle: { color: colorOf(k) } })) }],
  });
  // vertical bar with the value printed on top of each column
  const bar = (title: string, keys: string[], vals: number[], color: string, labelOf: (k: string) => string, valFmt?: (v: number) => string, labelFmt?: (v: number) => string) => ({
    title: titleOf(title),
    grid: { left: 46, right: 18, top: 46, bottom: 34 }, tooltip: { trigger: 'axis', valueFormatter: valFmt },
    xAxis: { type: 'category', data: keys.map(labelOf), axisLabel: { fontSize: 10, interval: 0, rotate: keys.length > 4 ? 18 : 0 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 9, formatter: (v: number) => (labelFmt ? labelFmt(v) : compact(v)) } },
    series: [{ type: 'bar', data: vals, itemStyle: { color, borderRadius: [5, 5, 0, 0] },
      label: { show: true, position: 'top', fontSize: 10, fontWeight: 600, color: '#16221B', formatter: (p: any) => (labelFmt ? labelFmt(p.value) : compact(p.value)) } }],
  });
  // horizontal bar (good for many categories) with the value at the end
  const hbar = (title: string, rows: { name: string; value: number; color: string }[], unit?: string) => ({
    title: titleOf(title),
    grid: { left: 8, right: 60, top: 40, bottom: 10, containLabel: true }, tooltip: { trigger: 'item', valueFormatter: (v: any) => nf.format(v) + (unit ? ' ' + unit : '') },
    xAxis: { type: 'value', show: false }, yAxis: { type: 'category', inverse: true, data: rows.map((r) => r.name), axisLabel: { fontSize: 9.5 }, axisTick: { show: false }, axisLine: { show: false } },
    series: [{ type: 'bar', data: rows.map((r) => ({ value: Math.round(r.value), itemStyle: { color: r.color, borderRadius: [0, 5, 5, 0] } })), barWidth: '62%',
      label: { show: true, position: 'right', fontSize: 9.5, fontWeight: 600, color: '#16221B', formatter: (p: any) => compact(p.value) } }],
  });
  // semicircle gauge for the developed-land share
  const gauge = (title: string, pct: number) => ({
    title: titleOf(title),
    series: [{ type: 'gauge', startAngle: 200, endAngle: -20, min: 0, max: 100, radius: '92%', center: ['50%', '74%'],
      progress: { show: true, width: 16, itemStyle: { color: '#2F6B3E' } }, axisLine: { lineStyle: { width: 16, color: [[1, '#EAF3E4']] } },
      pointer: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
      anchor: { show: false }, title: { show: false },
      detail: { valueAnimation: true, offsetCenter: [0, '-8%'], fontSize: 30, fontWeight: 700, color: '#143D1E', formatter: (v: number) => v.toFixed(1) + '%' },
      data: [{ value: +pct.toFixed(1) }] }],
  });

  const secKeys = Object.keys(SECTORS).filter((k) => s.secGfa[k]);
  const pipeKeys = INVESTOR_STATUSES.map((x) => x.key).filter((k) => s.pipe[k]);
  const luTop = Object.keys(s.luArea).filter((k) => s.luArea[k] > 0).sort((a, b) => s.luArea[b] - s.luArea[a]).slice(0, 8)
    .map((k) => ({ name: (lang === 'ar' ? landUses[k]?.labelAr : landUses[k]?.labelEn) ?? k, value: s.luArea[k], color: landUses[k]?.color ?? '#ccc' }));

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

        <div className="exec-charts">
          <div className="exec-chart">
            <Chart height={200} option={gauge(t('exec.developed', lang), devPct)} />
            <div className="exec-gauge-cap">
              <span><i style={{ background: '#2F6B3E' }} />{t('exec.developed', lang)} · {compact(s.developed)} m²</span>
              <span><i style={{ background: '#9A8A1E' }} />{t('exec.underdev', lang)} · {compact(s.underDev)} m²</span>
            </div>
          </div>
          <div className="exec-chart"><Chart height={230} option={donut(t('exec.byStatus', lang), s.st, (k) => STATUS_META[k]?.color ?? '#ccc', (k) => (lang === 'ar' ? STATUS_META[k]?.ar ?? k : STATUS_META[k]?.en ?? k))} /></div>
          <div className="exec-chart"><Chart height={230} option={donut(t('exec.byOwnership', lang), s.own, (k) => OWNERSHIP_META[k]?.color ?? '#ccc', (k) => (lang === 'ar' ? OWNERSHIP_META[k]?.ar ?? k : OWNERSHIP_META[k]?.en ?? k))} /></div>
          <div className="exec-chart"><Chart height={230} option={hbar(t('report.luMix', lang), luTop, 'm²')} /></div>
          <div className="exec-chart"><Chart height={230} option={bar(t('dash.gfaSector', lang), secKeys, secKeys.map((k) => s.secGfa[k]), '#2F6B3E', (k) => (lang === 'ar' ? SECTORS[k as keyof typeof SECTORS]?.labelAr ?? k : k), (v: any) => compact(v) + ' m²')} /></div>
          <div className="exec-chart"><Chart height={230} option={bar(t('exec.plotsBySector', lang), secKeys, secKeys.map((k) => s.secCount[k]), '#9A8A1E', (k) => (lang === 'ar' ? SECTORS[k as keyof typeof SECTORS]?.labelAr ?? k : k))} /></div>
          <div className="exec-chart"><Chart height={230} option={bar(t('exec.areaBySector', lang), secKeys, secKeys.map((k) => Math.round(s.secArea[k] || 0)), '#2E7D6B', (k) => (lang === 'ar' ? SECTORS[k as keyof typeof SECTORS]?.labelAr ?? k : k), (v: any) => compact(v) + ' m²')} /></div>
          <div className="exec-chart"><Chart height={230} option={bar(t('exec.devBySector', lang), secKeys, secKeys.map((k) => (s.secArea[k] ? +(((s.secDev[k] || 0) / s.secArea[k]) * 100).toFixed(1) : 0)), '#5E8C3A', (k) => (lang === 'ar' ? SECTORS[k as keyof typeof SECTORS]?.labelAr ?? k : k), (v: any) => v + '%', (v: number) => v + '%')} /></div>
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
