import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../store';

interface Step { sel: string | null; ar: string; en: string; ar_b: string; en_b: string }
const STEPS: Step[] = [
  { sel: null, ar: 'مرحباً بك 👋', en: 'Welcome 👋', ar_b: 'جولة سريعة على أهم أدوات منصّة المخطط العام لمدينة المعرفة الاقتصادية.', en_b: 'A quick tour of the Knowledge Economic City master-plan platform.' },
  { sel: '.search', ar: 'البحث', en: 'Search', ar_b: 'ابحث برقم البلوت أو اسم المشروع أو المالك أو المساحة.', en_b: 'Search by plot code, project name, owner or area.' },
  { sel: '#controls', ar: 'الفلترة والاستكشاف', en: 'Filter & explore', ar_b: 'صفّي حسب القطاع والاستخدام، وفعّل الفلترة المتقدمة وأرقام القطع على الخريطة.', en_b: 'Filter by sector and land use, and toggle advanced filters and plot numbers.' },
  { sel: '.rail', ar: 'الأدوات', en: 'Tools', ar_b: 'الخريطة والقمر الصناعي، العرض ثلاثي الأبعاد، القياس، تصدير التقرير، ولوحة الإدارة.', en_b: 'Basemaps, 3D, measurement, report export and the admin console.' },
  { sel: null, ar: 'جاهز! 🌿', en: 'All set! 🌿', ar_b: 'اضغط ؟ في أي وقت لعرض اختصارات لوحة المفاتيح. رحلة موفّقة.', en_b: 'Press ? anytime for keyboard shortcuts. Enjoy exploring.' },
];

export function Tour({ onClose }: { onClose: () => void }) {
  const { lang } = useApp();
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = STEPS[i];

  useLayoutEffect(() => {
    const measure = () => {
      if (!step.sel) { setRect(null); return; }
      const el = document.querySelector(step.sel);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [i, step.sel]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1));
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const finish = () => { try { localStorage.setItem('kec_tour_v1', '1'); } catch { /* */ } onClose(); };
  const next = () => (i >= STEPS.length - 1 ? finish() : setI(i + 1));

  const pad = 8;
  const hole = rect ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;
  // tooltip placement: below the target if room, else above; centered when no target
  const vh = window.innerHeight, vw = window.innerWidth;
  let card: React.CSSProperties;
  if (!rect) card = { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' };
  else if (rect.bottom + 190 < vh) card = { top: rect.bottom + 14, left: Math.min(Math.max(rect.left, 16), vw - 340) };
  else if (rect.top - 190 > 0) card = { top: rect.top - 176, left: Math.min(Math.max(rect.left, 16), vw - 340) };
  else card = { top: '50%', left: Math.min(Math.max(rect.right + 14, 16), vw - 340) };

  return createPortal(
    <div className="tour" dir={lang === 'ar' ? 'rtl' : 'ltr'} onClick={next}>
      {hole
        ? <div className="tour-hole" style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }} />
        : <div className="tour-dim" />}
      <div className="tour-card" style={card} onClick={(e) => e.stopPropagation()}>
        <div className="tour-step">{i + 1} / {STEPS.length}</div>
        <h3>{lang === 'ar' ? step.ar : step.en}</h3>
        <p>{lang === 'ar' ? step.ar_b : step.en_b}</p>
        <div className="tour-dots">{STEPS.map((_, k) => <span key={k} className={k === i ? 'on' : ''} />)}</div>
        <div className="tour-acts">
          <button className="tour-skip" onClick={finish}>{lang === 'ar' ? 'تخطّي' : 'Skip'}</button>
          <div className="tour-nav">
            {i > 0 && <button className="btn sm" onClick={() => setI(i - 1)}>{lang === 'ar' ? 'السابق' : 'Back'}</button>}
            <button className="btn sm primary" onClick={next}>{i >= STEPS.length - 1 ? (lang === 'ar' ? 'إنهاء' : 'Done') : (lang === 'ar' ? 'التالي' : 'Next')}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
