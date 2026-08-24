import { useApp } from '../store';
import { t } from '../lib/domain';
import { LM_CATEGORIES } from '../lib/landmarks';
import { useBackClose } from '../lib/backstack';
import { IconLabel, IconLandmark } from './icons';

/**
 * One place for everything that controls *what the map shows*: basemap, the 2D /
 * 3D / Earth view, and the overlays (plot numbers + Madinah landmarks by
 * category). Opened from the rail so these controls stop being scattered.
 */
export function LayersFlyout({ onClose }: { onClose: () => void }) {
  const { lang, basemap, dim, labels, landmarks, lmCats, setBasemap, setDim, toggleLabels, toggleLandmarks, toggleLmCat } = useApp();
  const rtl = lang === 'ar';
  useBackClose(true, onClose, 50);

  return (
    <>
      <div className="lf-scrim" onClick={onClose} />
      <div className="layers-flyout" dir={rtl ? 'rtl' : 'ltr'} onClick={(e) => e.stopPropagation()}>
        <div className="lf-head">{t('lf.title', lang)}<button className="lf-x" onClick={onClose}>×</button></div>

        <div className="lf-group">
          <div className="lf-label">{t('tb.basemap', lang)}</div>
          <div className="lf-seg">
            <button className={basemap === 'light' ? 'on' : ''} onClick={() => setBasemap('light')}>{t('tb.light', lang)}</button>
            <button className={basemap === 'satellite' ? 'on' : ''} onClick={() => setBasemap('satellite')}>{t('tb.satellite', lang)}</button>
          </div>
        </div>

        <div className="lf-group">
          <div className="lf-label">{t('tb.view', lang)}</div>
          <div className="lf-seg">
            <button className={dim === '2d' ? 'on' : ''} onClick={() => setDim('2d')}>{t('view.2d', lang)}</button>
            <button className={dim === '3d' ? 'on' : ''} onClick={() => setDim('3d')}>{t('view.3d', lang)}</button>
            <button className={dim === 'earth' ? 'on' : ''} onClick={() => setDim('earth')}>{t('view.earth', lang)}</button>
          </div>
          <div className="lf-hint">{dim === 'earth' ? t('view.earthHint', lang) : dim === '3d' ? t('view.3dHint', lang) : t('view.2dHint', lang)}</div>
        </div>

        <div className="lf-group">
          <div className="lf-label">{t('lf.overlays', lang)}</div>
          <label className={`lf-toggle ${labels ? 'on' : ''}`}>
            <input type="checkbox" checked={labels} onChange={toggleLabels} />
            <span className="pt-switch" /><span className="pt-label"><IconLabel size={14} /> {t('cp.labels', lang)}</span>
          </label>
          <label className={`lf-toggle ${landmarks ? 'on' : ''}`}>
            <input type="checkbox" checked={landmarks} onChange={toggleLandmarks} />
            <span className="pt-switch" /><span className="pt-label"><IconLandmark size={14} /> {t('cp.landmarks', lang)}</span>
          </label>
          {landmarks && (
            <div className="lf-cats">
              {LM_CATEGORIES.map((c) => (
                <button key={c.key} className={`lf-cat ${lmCats.has(c.key) ? 'on' : ''}`}
                  style={lmCats.has(c.key) ? { borderColor: c.color, background: c.color + '18' } : undefined}
                  onClick={() => toggleLmCat(c.key)}>
                  <span className="lf-cat-dot" style={{ background: c.color }} />{lang === 'ar' ? c.ar : c.en}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
