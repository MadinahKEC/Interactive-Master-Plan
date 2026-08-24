import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store';
import { IconCalendar } from './icons';

const MONTHS = {
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const DOW = { ar: ['أح', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب'], en: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] };
const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s?: string) => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return y ? new Date(y, (m || 1) - 1, d || 1) : null; };

/** KEC-themed date picker (replaces the browser-native calendar). Value is 'YYYY-MM-DD'. */
export function DateField({ value, onChange, title }: { value?: string; onChange: (v: string) => void; title?: string }) {
  const { lang } = useApp();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Date>(() => parse(value) ?? new Date());
  const wrap = useRef<HTMLDivElement>(null);
  const sel = parse(value);

  useEffect(() => { if (open) setView(parse(value) ?? new Date()); }, [open, value]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const y = view.getFullYear(), m = view.getMonth();
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const today = toISO(new Date());

  const pick = (d: number) => { onChange(toISO(new Date(y, m, d))); setOpen(false); };
  const shift = (n: number) => setView(new Date(y, m + n, 1));

  return (
    <div className="df" ref={wrap} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <button type="button" className="df-input" onClick={() => setOpen((o) => !o)} title={title}>
        <IconCalendar size={14} />
        <span className={sel ? 'df-val' : 'df-ph'}>{sel ? toISO(sel) : (lang === 'ar' ? 'اختر تاريخاً' : 'Pick a date')}</span>
      </button>
      {open && (
        <div className="df-pop">
          <div className="df-head">
            <button type="button" className="df-nav" onClick={() => shift(-1)}>{lang === 'ar' ? '›' : '‹'}</button>
            <span className="df-title">{MONTHS[lang][m]} {y}</span>
            <button type="button" className="df-nav" onClick={() => shift(1)}>{lang === 'ar' ? '‹' : '›'}</button>
          </div>
          <div className="df-grid df-dow">{DOW[lang].map((d) => <span key={d} className="df-dowc">{d}</span>)}</div>
          <div className="df-grid">
            {cells.map((d, i) => {
              if (d == null) return <span key={i} className="df-cell df-empty" />;
              const iso = toISO(new Date(y, m, d));
              return (
                <button type="button" key={i} className={`df-cell ${iso === value ? 'sel' : ''} ${iso === today ? 'today' : ''}`} onClick={() => pick(d)}>{d}</button>
              );
            })}
          </div>
          <div className="df-foot">
            <button type="button" className="df-today" onClick={() => { onChange(today); setOpen(false); }}>{lang === 'ar' ? 'اليوم' : 'Today'}</button>
            {value && <button type="button" className="df-clear" onClick={() => { onChange(''); setOpen(false); }}>{lang === 'ar' ? 'مسح' : 'Clear'}</button>}
          </div>
        </div>
      )}
    </div>
  );
}
