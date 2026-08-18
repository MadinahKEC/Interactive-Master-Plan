import { type ReactNode } from 'react';
import { can } from '@kec/types';
import { useApp } from '../store';
import { useAuth } from '../lib/auth';
import { t } from '../lib/domain';
import { IconHome, IconCalendar, IconAdmin, IconLayers, IconSatellite, IconCube, IconPower, IconTag, IconExport } from './icons';

/** Vertical icon rail: primary navigation + map tools. */
export function Sidebar({ onOpenAdmin, onOpenDevPlan }: { onOpenAdmin: () => void; onOpenDevPlan: () => void }) {
  const { lang, basemap, dim, annotateMode, setAnnotateMode, setBasemap, setDim, fitAll, toggleLang, requestExport } = useApp();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const canAdmin = can(user?.role as any, 'plot:attr:update');
  const initial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase();

  return (
    <nav className="rail">
      <div className="rail-brand"><img src={import.meta.env.BASE_URL + 'KEC.png'} alt="KEC" /></div>

      <div className="rail-group">
        <RailBtn tip={t('d.fullPlan', lang)} onClick={fitAll}><IconHome size={20} /></RailBtn>
        <RailBtn tip={t('tb.devplan', lang)} onClick={onOpenDevPlan}><IconCalendar size={20} /></RailBtn>
        {canAdmin && <RailBtn tip={t('tb.annotate', lang)} active={annotateMode !== 'off'} onClick={() => setAnnotateMode(annotateMode === 'off' ? 'text' : 'off')}><IconTag size={20} /></RailBtn>}
        {canAdmin && <RailBtn tip={t('tb.admin', lang)} onClick={onOpenAdmin}><IconAdmin size={20} /></RailBtn>}
      </div>

      <div className="rail-sep" />

      <div className="rail-group">
        <RailBtn tip={basemap === 'light' ? t('tb.satellite', lang) : t('tb.light', lang)} active={basemap === 'satellite'}
          onClick={() => setBasemap(basemap === 'light' ? 'satellite' : 'light')}>
          {basemap === 'light' ? <IconSatellite size={20} /> : <IconLayers size={20} />}
        </RailBtn>
        <RailBtn tip={dim === '2d' ? '3D' : '2D'} active={dim === '3d'} onClick={() => setDim(dim === '2d' ? '3d' : '2d')}>
          <IconCube size={20} />
        </RailBtn>
        <RailBtn tip={t('tb.export', lang)} onClick={requestExport}><IconExport size={20} /></RailBtn>
      </div>

      <div className="rail-spacer" />

      <div className="rail-group">
        <RailBtn tip="العربية / English" onClick={toggleLang}><span className="rail-lang">{t('tb.langToggle', lang)}</span></RailBtn>
        {user && (
          <div className="rail-user">
            <div className="rail-avatar" title={`${user.name} · ${t(`role.${user.role}`, lang)}`}>{initial}</div>
            <RailBtn tip={t('tb.logout', lang)} onClick={logout}><IconPower size={18} /></RailBtn>
          </div>
        )}
      </div>
    </nav>
  );
}

function RailBtn({ tip, active, onClick, children }: { tip: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button className={`rail-btn ${active ? 'on' : ''}`} onClick={onClick} data-tip={tip} aria-label={tip}>
      {children}
    </button>
  );
}
