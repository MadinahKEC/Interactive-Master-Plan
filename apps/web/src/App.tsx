import { useEffect, useMemo, useState } from 'react';
import { MapView } from './map/MapView';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { ControlPanel } from './components/ControlPanel';
import { DetailPanel } from './components/DetailPanel';
import { MultiSelectPanel } from './components/MultiSelectPanel';
import { AdminConsole } from './admin/AdminConsole';
import { DevPlanView } from './components/DevPlanView';
import { AnnotateToolbar } from './components/AnnotateToolbar';
import { ReportView } from './components/ReportView';
import { Login } from './components/Login';
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
  const { plotAttrs, projects: projOver, landUses: luOver, plotGeom, merges } = useOverrides();

  const [adminOpen, setAdminOpen] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const [editCode, setEditCode] = useState<string | null>(null);

  const projects = useMemo(() => effectiveProjects(baseProjects, projOver), [baseProjects, projOver]);
  const data = useMemo(() => effectiveCollection(baseData, plotAttrs, plotGeom, merges, projects), [baseData, plotAttrs, plotGeom, merges, projects]);
  const landUses = useMemo(() => effectiveLandUses(luOver), [luOver]);

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
      <DetailPanel projects={projects} landUses={landUses} onEdit={(code) => openAdmin(code)} />
      {data && <MultiSelectPanel data={data} projects={projects} />}
      <AnnotateToolbar />
      <ReportView data={data} landUses={landUses} projects={projects} />
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
          <img src="/KEC.png" alt="KEC" className="load-logo" />
          <div className="ring" />
          <p>{t('loading', lang)}</p>
        </div>
      )}
      {error && (<div className="loading"><p>{lang === 'ar' ? 'تعذّر تحميل البيانات' : 'Failed to load data'}: {error}</p></div>)}
      {status !== 'in' && <Login />}
    </>
  );
}
