import { can } from '@kec/types';
import { useApp } from '../store';
import { useAuth } from '../lib/auth';
import { t } from '../lib/domain';

export function TopBar({ onOpenAdmin, onOpenDevPlan }: { onOpenAdmin: () => void; onOpenDevPlan: () => void }) {
  const { lang, basemap, dim, setBasemap, setDim, reset, toggleLang } = useApp();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const canAdmin = can(user?.role as any, 'plot:attr:update');

  return (
    <div id="topbar">
      <div className="brand">
        <img src="/KEC.png" alt="KEC" className="brand-logo" />
        <div className="brand-txt">
          <b>{t('brand.title', lang)}</b>
          <span>{t('brand.sub', lang)}</span>
        </div>
      </div>
      <div className="spacer" />

      <div className="tb-group">
        <span className="seg-label">{t('tb.basemap', lang)}</span>
        <div className="seg">
          <button className={basemap === 'light' ? 'on' : ''} onClick={() => setBasemap('light')}>{t('tb.light', lang)}</button>
          <button className={basemap === 'satellite' ? 'on' : ''} onClick={() => setBasemap('satellite')}>{t('tb.satellite', lang)}</button>
        </div>
      </div>

      <div className="tb-group">
        <span className="seg-label">{t('tb.view', lang)}</span>
        <div className="seg">
          <button className={dim === '2d' ? 'on' : ''} onClick={() => setDim('2d')}>2D</button>
          <button className={dim === '3d' ? 'on' : ''} onClick={() => setDim('3d')}>3D</button>
        </div>
      </div>

      <button className="tb-icon lang" title="Language" onClick={toggleLang}>{t('tb.langToggle', lang)}</button>
      <button className="tb-btn" onClick={reset}>{t('tb.reset', lang)} ⟲</button>
      <button className="tb-btn devplan" onClick={onOpenDevPlan}>◷ {t('tb.devplan', lang)}</button>
      {canAdmin && <button className="tb-btn admin" onClick={onOpenAdmin}>⚙ {t('tb.admin', lang)}</button>}

      {user && (
        <div className="tb-user">
          <span><b>{user.name}</b></span>
          <span className="role">{t(`role.${user.role}`, lang)}</span>
          <button className="tb-icon" title={t('tb.logout', lang)} onClick={logout}>⏻</button>
        </div>
      )}
    </div>
  );
}
