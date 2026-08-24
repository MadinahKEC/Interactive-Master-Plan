import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../store';
import { t } from '../lib/domain';
import { IconClose } from './icons';

const SHORTCUTS: { keys: string[]; ar: string; en: string }[] = [
  { keys: ['/'], ar: 'البحث', en: 'Search' },
  { keys: ['L'], ar: 'إظهار أرقام القطع', en: 'Toggle plot numbers' },
  { keys: ['M'], ar: 'أداة القياس', en: 'Measure tool' },
  { keys: ['B'], ar: 'تبديل الخريطة (قمر صناعي)', en: 'Toggle basemap' },
  { keys: ['3'], ar: 'العرض ثلاثي الأبعاد', en: '3D view' },
  { keys: ['F'], ar: 'عرض المخطط كاملاً', en: 'Full plan view' },
  { keys: ['R'], ar: 'تصدير التقرير', en: 'Export report' },
  { keys: ['Esc'], ar: 'إغلاق أي نافذة', en: 'Close any window' },
  { keys: ['?'], ar: 'هذه القائمة', en: 'This help' },
];

export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const { lang } = useApp();
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  return createPortal(
    <div className="modal-wrap dlg-wrap" onClick={onClose}>
      <div className="modal dlg sc-modal" dir={lang === 'ar' ? 'rtl' : 'ltr'} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><b>{t('sc.title', lang)}</b><button className="ic-btn" onClick={onClose}><IconClose size={17} /></button></div>
        <div className="modal-body sc-body">
          {SHORTCUTS.map((s) => (
            <div className="sc-row" key={s.en}>
              <span className="sc-label">{lang === 'ar' ? s.ar : s.en}</span>
              <span className="sc-keys">{s.keys.map((k) => <kbd key={k}>{k}</kbd>)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
