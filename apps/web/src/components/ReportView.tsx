import { useMemo } from 'react';
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
    const lu: Record<string, number> = {}; let n = 0, gfa = 0, area = 0;
    const planStatus: Record<string, number> = {};
    let planArea = 0, planGfa = 0;
    const planList: { code: string; name: string; status: string; color: string; area: number; gfa: number }[] = [];
    if (data) for (const f of data.features) {
      if (!matchPlot(f.properties, state)) continue;
      const p = f.properties;
      n++; gfa += p.gfa || 0; area += p.area || 0;
      const k = p.land_use ?? '—'; lu[k] = (lu[k] || 0) + 1;
      if (p.planStatus) {
        const pr = resolveProject(p.code, p.land_use, projects);
        planArea += p.area || 0; planGfa += p.gfa || 0;
        planStatus[pr.status.key] = (planStatus[pr.status.key] || 0) + 1;
        const name = pr.named ? (lang === 'ar' ? pr.overlay.name_ar || pr.overlay.name_en : pr.overlay.name_en || pr.overlay.name_ar) : '—';
        planList.push({ code: p.code, name: name || '—', status: lang === 'ar' ? pr.status.ar : pr.status.en, color: pr.status.color, area: p.area || 0, gfa: p.gfa || 0 });
      }
    }
    planList.sort((a, b) => b.area - a.area);
    return { lu, n, gfa, area, planStatus, planArea, planGfa, planList };
  }, [data, state, projects, lang]);

  if (reportImage === null) return null;
  const projectsNamed = Object.values(projects).filter((p) => p.name_ar || p.name_en).length;
  const date = new Date().toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-GB');
  const dl = () => { const a = document.createElement('a'); a.href = reportImage; a.download = 'kec-master-plan.png'; a.click(); };

  return (
    <div className="report-overlay">
      <div className="report-toolbar">
        <button className="btn" onClick={() => setReportImage(null)}><IconClose size={15} /> {t('report.close', lang)}</button>
        <button className="btn" onClick={dl}>⬇ {t('report.dl', lang)}</button>
        <button className="btn primary" onClick={() => window.print()}>🖨 {t('report.print', lang)}</button>
      </div>

      <div className="report-sheet report-print">
        <header className="rp-head">
          <img src={import.meta.env.BASE_URL + 'KEC.png'} alt="KEC" />
          <div className="rp-title">
            <h1>{t('report.title', lang)}</h1>
            <p>{lang === 'ar' ? 'مدينة المعرفة الاقتصادية' : 'Knowledge Economic City'} · {t('report.generated', lang)}: {date}</p>
          </div>
        </header>

        {reportImage ? <img className="rp-map" src={reportImage} alt="map" /> : <div className="rp-map rp-noimg">—</div>}

        <div className="rp-sub">{t('report.overview', lang)}</div>
        <div className="rp-kpis">
          <Kpi v={nf.format(stats.n)} l={t('kpi.count', lang)} />
          <Kpi v={fmt(stats.gfa)} l={t('kpi.gfa', lang)} />
          <Kpi v={fmt(stats.area)} l={t('kpi.area', lang)} />
          <Kpi v={String(stats.planList.length)} l={t('cp.planTitle', lang)} />
          <Kpi v={String(projectsNamed)} l={t('a.named', lang)} />
        </div>

        {stats.planList.length > 0 && (
          <>
            <div className="rp-sub">{t('cp.planTitle', lang)}</div>
            <div className="rp-kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
              <Kpi v={String(stats.planList.length)} l={t('cp.planned', lang)} />
              <Kpi v={fmt(stats.planArea)} l={t('kpi.area', lang)} />
              <Kpi v={fmt(stats.planGfa)} l={t('kpi.gfa', lang)} />
            </div>
            <div className="rp-status">
              {['Completed', 'UnderConstruction', 'Future', 'Partner'].filter((k) => stats.planStatus[k]).map((k) => (
                <span className="rp-st" key={k}><span className="dot" style={{ background: STATUS_META[k].color }} />{lang === 'ar' ? STATUS_META[k].ar : STATUS_META[k].en}: <b>{stats.planStatus[k]}</b></span>
              ))}
            </div>
          </>
        )}

        <div className="rp-sub">{t('cp.uses', lang)}</div>
        <div className="rp-legend">
          {Object.keys(stats.lu).sort((a, b) => stats.lu[b] - stats.lu[a]).map((k) => (
            <div className="rp-lg" key={k}>
              <span className="sw" style={{ background: landUses[k]?.color ?? '#ccc' }} />
              <span className="nm">{lang === 'ar' ? landUses[k]?.labelAr ?? k : landUses[k]?.labelEn ?? k}</span>
              <span className="ct">{stats.lu[k]}</span>
            </div>
          ))}
        </div>

        <footer className="rp-foot">
          <span>© {lang === 'ar' ? 'مدينة المعرفة الاقتصادية' : 'Knowledge Economic City'} — GIS Master Plan</span>
          <span>powered by : Sa^^3R</span>
        </footer>
      </div>
    </div>
  );
}

function Kpi({ v, l }: { v: string; l: string }) {
  return (<div className="rp-kpi"><div className="v">{v}</div><div className="l">{l}</div></div>);
}
