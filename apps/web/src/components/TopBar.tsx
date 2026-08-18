import { useApp } from '../store';
import { useAuth } from '../lib/auth';
import { t } from '../lib/domain';

export function TopBar() {
  const { lang } = useApp();
  const user = useAuth((s) => s.user);

  return (
    <div id="topbar">
      <div className="brand">
        <div className="brand-txt">
          <b>{t('brand.title', lang)}</b>
          <span>{t('brand.sub', lang)}</span>
        </div>
      </div>
      <div className="spacer" />
      {user && (
        <div className="tb-user">
          <span><b>{user.name}</b></span>
          <span className="role">{t(`role.${user.role}`, lang)}</span>
        </div>
      )}
    </div>
  );
}
