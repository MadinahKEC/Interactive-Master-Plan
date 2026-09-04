import { useState, type ReactNode } from 'react';
import { can } from '@kec/types';
import { useApp } from '../store';
import { useAuth } from '../lib/auth';
import { useShortlist } from '../lib/shortlist';
import { t } from '../lib/domain';
import { LayersFlyout } from './LayersFlyout';
import { IconHome, IconAdmin, IconLayers, IconPower, IconTag, IconExport, IconRuler, IconPlus, IconChevron, IconDashboard, IconCompare } from './icons';

/** Vertical icon rail: navigation, a unified layers/view flyout, and map tools. */
export function Sidebar({ onOpenAdmin, onOpenExec }: { onOpenAdmin: () => void; onOpenExec: () => void }) {
  const { lang, dim, annotateMode, measuring, creating, toggleMeasure, setCreating, setAnnotateMode, fitAll, toggleLang, requestExport, toggleRail } = useApp();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const canAdmin = can(user?.role as any, 'plot:attr:update');
  const initial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase();
  const [layersOpen, setLayersOpen] = useState(false);
  const viewOn = dim !== '2d';
  const compareCount = useShortlist((s) => s.codes.length);
  const compareOpen = useShortlist((s) => s.compareOpen);
  const openCompare = useShortlist((s) => s.setCompareOpen);

  return (
    <nav className="rail">
      <div className="rail-brand"><img src={import.meta.env.BASE_URL + 'KEC.png'} alt="KEC" /></div>
      <button className="rail-hide" onClick={toggleRail} data-tip={t('tb.hideMenu', lang)} aria-label={t('tb.hideMenu', lang)}><IconChevron size={16} /></button>

      <div className="rail-group">
        <RailBtn tip={t('d.fullPlan', lang)} onClick={fitAll}><IconHome size={20} /></RailBtn>
        {canAdmin && <RailBtn tip={t('tb.exec', lang)} onClick={onOpenExec}><IconDashboard size={20} /></RailBtn>}
      </div>

      <div className="rail-sep" />

      {/* what the map shows — one grouped flyout, plus map tools + comparison */}
      <div className="rail-group">
        <RailBtn tip={t('tb.layers', lang)} active={layersOpen || viewOn} onClick={() => setLayersOpen((o) => !o)}><IconLayers size={20} /></RailBtn>
        <RailBtn tip={t('tb.measure', lang)} active={measuring} onClick={toggleMeasure}><IconRuler size={20} /></RailBtn>
        <RailBtn tip={t('tb.compare', lang)} active={compareOpen} badge={compareCount} onClick={() => openCompare(true)}><IconCompare size={20} /></RailBtn>
        {canAdmin && <RailBtn tip={t('tb.export', lang)} onClick={requestExport}><IconExport size={20} /></RailBtn>}
      </div>

      {canAdmin && (
        <>
          <div className="rail-sep" />
          <div className="rail-group">
            <RailBtn tip={t('tb.create', lang)} active={creating} onClick={() => setCreating(!creating)}><IconPlus size={20} /></RailBtn>
            <RailBtn tip={t('tb.annotate', lang)} active={annotateMode !== 'off'} onClick={() => setAnnotateMode(annotateMode === 'off' ? 'text' : 'off')}><IconTag size={20} /></RailBtn>
          </div>
        </>
      )}

      <div className="rail-spacer" />

      {/* Admin console sits just above the sign-out control */}
      {canAdmin && (
        <div className="rail-group">
          <RailBtn tip={t('tb.admin', lang)} onClick={onOpenAdmin}><IconAdmin size={20} /></RailBtn>
        </div>
      )}

      <div className="rail-group">
        <RailBtn tip="العربية / English" onClick={toggleLang}><span className="rail-lang">{t('tb.langToggle', lang)}</span></RailBtn>
        {user && (
          <div className="rail-user">
            <div className="rail-avatar" title={`${user.name} · ${t(`role.${user.role}`, lang)}`}>{initial}</div>
            <RailBtn tip={t('tb.logout', lang)} onClick={logout}><IconPower size={18} /></RailBtn>
          </div>
        )}
      </div>

      {layersOpen && <LayersFlyout onClose={() => setLayersOpen(false)} />}
    </nav>
  );
}

function RailBtn({ tip, active, onClick, children, badge }: { tip: string; active?: boolean; onClick: () => void; children: ReactNode; badge?: number }) {
  return (
    <button className={`rail-btn ${active ? 'on' : ''}`} onClick={onClick} data-tip={tip} aria-label={tip}>
      {children}
      {badge != null && badge > 0 && <span className="rail-badge">{badge}</span>}
    </button>
  );
}
