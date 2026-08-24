import { useEffect, useMemo, useState } from 'react';
import { MapView } from './map/MapView';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { ControlPanel } from './components/ControlPanel';
import { DetailPanel } from './components/DetailPanel';
import { MultiSelectPanel } from './components/MultiSelectPanel';
import { ShortlistBar } from './components/ShortlistBar';
import { AdminConsole } from './admin/AdminConsole';
import { DevPlanView } from './components/DevPlanView';
import { AnnotateToolbar } from './components/AnnotateToolbar';
import { ReportView } from './components/ReportView';
import { SubdivideModal } from './components/SubdivideModal';
import { Login } from './components/Login';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { Tour } from './components/Tour';
import { DialogHost, useDialog } from './lib/dialog';
import { useBackClose } from './lib/backstack';
import { useUrlSync } from './lib/urlState';
import { usePlots } from './lib/usePlots';
import { useProjects, t } from './lib/domain';
import { can } from '@kec/types';
import { useApp } from './store';
import { useAuth } from './lib/auth';
import { useOverrides } from './lib/overrides';
import { effectiveCollection, effectiveLandUses, effectiveProjects } from './lib/effective';

export default function App() {
  const { data: baseData, error } = usePlots();
  const baseProjects = useProjects();
  const { lang } = useApp();
  const status = useAuth((s) => s.status);
  const role = useAuth((s) => s.user?.role);
  const canAnnotate = can(role as any, 'plot:attr:update');
  const { plotAttrs, projects: projOver, landUses: luOver, plotGeom, merges, splits, createdPlots } = useOverrides();

  const [adminOpen, setAdminOpen] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const [editCode, setEditCode] = useState<string | null>(null);
  const [subdivideCode, setSubdivideCode] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  const projects = useMemo(() => effectiveProjects(baseProjects, projOver), [baseProjects, projOver]);
  const data = useMemo(() => effectiveCollection(baseData, plotAttrs, plotGeom, merges, projects, splits, createdPlots), [baseData, plotAttrs, plotGeom, merges, projects, splits, createdPlots]);
  const landUses = useMemo(() => effectiveLandUses(luOver), [luOver]);

  useUrlSync(data);

  // Back button / edge-swipe closes the top-most overlay (mobile-friendly).
  const selected = useApp((s) => s.selected);
  const multi = useApp((s) => s.multi);
  const measuring = useApp((s) => s.measuring);
  const creating = useApp((s) => s.creating);
  const editGeom = useApp((s) => s.editGeom);
  const reportImage = useApp((s) => s.reportImage);
  const dialogSpec = useDialog((s) => s.spec);
  useBackClose(!!dialogSpec, () => useDialog.getState().close({ value: null, fields: {} }), 200);
  useBackClose(!!subdivideCode, () => setSubdivideCode(null), 90);
  useBackClose(adminOpen, () => { setAdminOpen(false); setEditCode(null); useApp.getState().reveal(); }, 80);
  useBackClose(devOpen, () => { setDevOpen(false); useApp.getState().reveal(); }, 70);
  useBackClose(reportImage !== null, () => useApp.getState().setReportImage(null), 60);
  useBackClose(helpOpen, () => setHelpOpen(false), 55);
  useBackClose(!!editGeom, () => useApp.getState().setEditGeom(null), 45);
  useBackClose(creating, () => useApp.getState().setCreating(false), 44);
  useBackClose(measuring, () => useApp.getState().setMeasuring(false), 42);
  useBackClose(multi.length > 0, () => useApp.getState().clearMulti(), 20);
  useBackClose(!!selected, () => useApp.getState().select(null), 10);

  // First-visit onboarding tour (after login, once the UI is on screen).
  useEffect(() => {
    if (status !== 'in' || !data) return;
    let done = false;
    try { done = localStorage.getItem('kec_tour_v1') === '1'; } catch { /* */ }
    if (done) return;
    const id = setTimeout(() => setTourOpen(true), 700);
    return () => clearTimeout(id);
  }, [status, data]);

  // Esc closes the top-most open overlay (dialogs & local modals handle their own).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || useDialog.getState().spec) return;
      const a = useApp.getState();
      if (helpOpen) { setHelpOpen(false); return; }
      if (a.reportImage !== null) { a.setReportImage(null); return; }
      if (subdivideCode) { setSubdivideCode(null); return; }
      if (adminOpen) { setAdminOpen(false); setEditCode(null); a.reveal(); return; }
      if (devOpen) { setDevOpen(false); a.reveal(); return; }
      if (a.editGeom) { a.setEditGeom(null); return; }
      if (a.creating) { a.setCreating(false); return; }
      if (a.measuring) { a.setMeasuring(false); return; }
      if (a.multi.length) { a.clearMulti(); return; }
      if (a.selected) { a.select(null); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [subdivideCode, adminOpen, devOpen, helpOpen]);

  // Global keyboard shortcuts (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (useDialog.getState().spec) return;
      const a = useApp.getState();
      switch (e.key) {
        case '/': e.preventDefault(); (document.querySelector('.search input') as HTMLInputElement | null)?.focus(); break;
        case '?': setHelpOpen((v) => !v); break;
        case 'l': case 'L': a.toggleLabels(); break;
        case 'm': case 'M': a.toggleMeasure(); break;
        case 'b': case 'B': a.setBasemap(a.basemap === 'light' ? 'satellite' : 'light'); break;
        case '3': a.setDim(a.dim === '2d' ? '3d' : '2d'); break;
        case 'f': case 'F': a.fitAll(); break;
        case 'r': case 'R': a.requestExport(); break;
        default: return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset.theme = 'light';
  }, [lang]);

  const openAdmin = (code?: string) => { setEditCode(code ?? null); setAdminOpen(true); };

  return (
    <>
      <MapView data={data} projects={projects} landUses={landUses} canAnnotate={canAnnotate} />
      <Sidebar onOpenAdmin={() => openAdmin()} onOpenDevPlan={() => setDevOpen(true)} />
      <TopBar />
      {data && <ControlPanel data={data} landUses={landUses} projects={projects} />}
      <DetailPanel projects={projects} landUses={landUses} onEdit={(code) => openAdmin(code)} onSubdivide={(code) => setSubdivideCode(code)} />
      {data && <MultiSelectPanel data={data} projects={projects} />}
      {data && <ShortlistBar data={data} projects={projects} landUses={landUses} />}
      <AnnotateToolbar />
      <ReportView data={data} landUses={landUses} projects={projects} />
      {subdivideCode && <SubdivideModal parentCode={subdivideCode} data={data} onClose={() => setSubdivideCode(null)} />}
      <AdminConsole
        open={adminOpen} onClose={() => { setAdminOpen(false); setEditCode(null); useApp.getState().reveal(); }}
        editCode={editCode} data={data} projects={projects} landUses={landUses}
      />
      <DevPlanView
        open={devOpen} onClose={() => { setDevOpen(false); useApp.getState().reveal(); }}
        data={data} projects={projects} landUses={landUses} onEdit={(code) => openAdmin(code)}
      />
      <div className="credit">© {t('credit', lang)}</div>
      <div className="powered">{t('powered', lang)}</div>
      {!baseData && !error && (
        <div className="loading">
          <img src={import.meta.env.BASE_URL + 'KEC.png'} alt="KEC" className="load-logo" />
          <div className="ring" />
          <p>{t('loading', lang)}</p>
        </div>
      )}
      {error && (<div className="loading"><p>{lang === 'ar' ? 'تعذّر تحميل البيانات' : 'Failed to load data'}: {error}</p></div>)}
      {status !== 'in' && <Login />}
      {helpOpen && <ShortcutsHelp onClose={() => setHelpOpen(false)} />}
      {tourOpen && <Tour onClose={() => setTourOpen(false)} />}
      <DialogHost />
    </>
  );
}
