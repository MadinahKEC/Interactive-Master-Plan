import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { printWithPage } from '../lib/print';
import { type PlotCollection } from '@kec/types';
import { useApp, matchPlot } from '../store';
import { resolveProject, STATUS_META, t, type ProjectInfo } from '../lib/domain';
import type { EffLandUse } from '../lib/effective';
import { IconClose } from './icons';

const nf = new Intl.NumberFormat('en-US');
const fmt = (x: number) => (x >= 1e6 ? (x / 1e6).toFixed(2) + 'M' : nf.format(Math.round(x)));

export function ReportView({ data, landUses, projects }: {
  data: PlotCollection | null; landUses: Record<string, EffLandUse>; projects: Record<string, ProjectInfo>;
}) {
  const state = useApp();
  const { lang, reportImage, setReportImage } = state;

  const stats = useMemo(() => {
    const lu: Record<string, number> = {}; const luArea: Record<string, number> = {};
    let n = 0, gfa = 0, area = 0, farW = 0, developable = 0;
    const planStatus: Record<string, number> = {};
    let planArea = 0, planGfa = 0;
    const planList: { code: string; name: string; status: string; color: string; area: number; gfa: number }[] = [];
    if (data) for (const f of data.features) {
      if (!matchPlot(f.properties, state)) continue;
      const p = f.properties;
      n++; gfa += p.gfa || 0; area += p.area || 0;
      if (p.far) farW += (p.far || 0) * (p.area || 0);
      if ((p.far || 0) > 0) developable += p.area || 0;
      const k = p.land_use ?? '—'; lu[k] = (lu[k] || 0) + 1; luArea[k] = (luArea[k] || 0) + (p.area || 0);
      if (p.planStatus) {
        const pr = resolveProject(p.code, p.land_use, projects);
        planArea += p.area || 0; planGfa += p.gfa || 0;
        planStatus[pr.status.key] = (planStatus[pr.status.key] || 0) + 1;
        const name = pr.named ? (lang === 'ar' ? pr.overlay.name_ar || pr.overlay.name_en : pr.overlay.name_en || pr.overlay.name_ar) : '—';
        planList.push({ code: p.code, name: name || '—', status: lang === 'ar' ? pr.status.ar : pr.status.en, color: pr.status.color, area: p.area || 0, gfa: p.gfa || 0 });
      }
    }
    planList.sort((a, b) => b.area - a.area);
    const avgFar = area > 0 ? farW / area : 0;
    return { lu, luArea, n, gfa, area, avgFar, developable, planStatus, planArea, planGfa, planList };
  }, [data, state, projects, lang]);

  if (reportImage === null) return null;
  const projectsNamed = Object.values(projects).filter((p) => p.name_ar || p.name_en).length;
  const now = new Date();
  const date = now.toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-GB');
  const pad = (x: number) => String(x).padStart(2, '0');
  const ref = `KEC-MP-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  const dl = () => { const a = document.createElement('a'); a.href = reportImage; a.download = `${ref}.png`; a.click(); };
  const company = lang === 'ar' ? 'مدينة المعرفة الاقتصادية' : 'Knowledge Economic City';
  const printPdf = () => printWithPage('size:A4 portrait;margin:9mm', `${company} — ${t('report.title', lang)} — ${ref}`);
  // report scope line (which filters produced this view)
  const scopeBits: string[] = [];
  if (state.sector !== 'all') scopeBits.push(lang === 'ar' ? `قطاع ${state.sector}` : `${state.sector} sector`);
  if (state.planOnly) scopeBits.push(lang === 'ar' ? 'خطة التطوير فقط' : 'development plan only');
  const scope = scopeBits.length ? scopeBits.join(' · ') : (lang === 'ar' ? 'المخطط العام الكامل' : 'Full master plan');
  const luRows = Object.keys(stats.luArea).sort((a, b) => stats.luArea[b] - stats.luArea[a]).slice(0, 6);
  const luMax = Math.max(1, ...luRows.map((k) => stats.luArea[k]));
  const planTotal = Object.values(stats.planStatus).reduce((a, b) => a + b, 0);

  return createPortal(
    <div className="report-overlay">
      <div className="report-toolbar">
        <button className="btn" onClick={() => setReportImage(null)}><IconClose size={15} /> {t('report.close', lang)}</button>
        <button className="btn" onClick={dl}>⬇ {t('report.dl', lang)}</button>
        <button className="btn primary" onClick={printPdf}>🖨 {t('report.print', lang)}</button>
      </div>

      <div className="report-sheet report-print">
        <header className="rp-head">
          <img src={import.meta.env.BASE_URL + 'KEC.png'} alt="KEC" />
          <div className="rp-title">
            <h1>{t('report.title', lang)}</h1>
            <p>{lang === 'ar' ? 'مدينة المعرفة الاقتصادية' : 'Knowledge Economic City'}</p>
          </div>
          <div className="rp-ref">
            <span className="rp-ref-no mono">{ref}</span>
            <span>{t('report.generated', lang)}: {date}</span>
          </div>
        </header>

        <div className="rp-scope"><span>{t('report.scope', lang)}</span><b>{scope}</b></div>

        {reportImage ? <img className="rp-map" src={reportImage} alt="map" /> : <div className="rp-map rp-noimg">—</div>}

        <div className="rp-sub">{t('report.overview', lang)}</div>
        <div className="rp-kpis">
          <Kpi v={nf.format(stats.n)} l={t('kpi.count', lang)} />
          <Kpi v={fmt(stats.gfa)} l={t('kpi.gfa', lang)} />
          <Kpi v={fmt(stats.area)} l={t('kpi.area', lang)} />
          <Kpi v={fmt(stats.developable)} l={t('report.developable', lang)} />
          <Kpi v={stats.avgFar.toFixed(2)} l={t('report.avgFar', lang)} />
          <Kpi v={String(projectsNamed)} l={t('a.named', lang)} />
        </div>

        <div className="rp-cols">
          <div className="rp-col">
            <div className="rp-sub">{t('report.luMix', lang)}</div>
            <div className="rp-bars">
              {luRows.map((k) => (
                <div className="rp-bar-row" key={k}>
                  <span className="rp-bar-nm">{lang === 'ar' ? landUses[k]?.labelAr ?? k : landUses[k]?.labelEn ?? k}</span>
                  <span className="rp-bar-track"><span className="rp-bar-fill" style={{ width: `${(stats.luArea[k] / luMax) * 100}%`, background: landUses[k]?.color ?? '#ccc' }} /></span>
                  <span className="rp-bar-v mono">{fmt(stats.luArea[k])}</span>
                </div>
              ))}
            </div>
          </div>
          {stats.planList.length > 0 && (
            <div className="rp-col">
              <div className="rp-sub">{t('cp.planTitle', lang)}</div>
              <div className="rp-kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
                <Kpi v={String(stats.planList.length)} l={t('cp.planned', lang)} />
                <Kpi v={fmt(stats.planArea)} l={t('kpi.area', lang)} />
                <Kpi v={fmt(stats.planGfa)} l={t('kpi.gfa', lang)} />
              </div>
              <div className="rp-statusbar">
                {['Completed', 'UnderConstruction', 'Future', 'Partner'].filter((k) => stats.planStatus[k]).map((k) => (
                  <span key={k} className="rp-sb-seg" style={{ width: `${(stats.planStatus[k] / Math.max(1, planTotal)) * 100}%`, background: STATUS_META[k].color }} title={`${STATUS_META[k].en}: ${stats.planStatus[k]}`} />
                ))}
              </div>
              <div className="rp-status">
                {['Completed', 'UnderConstruction', 'Future', 'Partner'].filter((k) => stats.planStatus[k]).map((k) => (
                  <span className="rp-st" key={k}><span className="dot" style={{ background: STATUS_META[k].color }} />{lang === 'ar' ? STATUS_META[k].ar : STATUS_META[k].en}: <b>{stats.planStatus[k]}</b></span>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="rp-foot">
          <span>© {lang === 'ar' ? 'مدينة المعرفة الاقتصادية — المخطط العام التفاعلي' : 'Knowledge Economic City — Interactive Master Plan'}</span>
          <span>powered by : Sa^^3R</span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function Kpi({ v, l }: { v: string; l: string }) {
  return (<div className="rp-kpi"><div className="v">{v}</div><div className="l">{l}</div></div>);
}
