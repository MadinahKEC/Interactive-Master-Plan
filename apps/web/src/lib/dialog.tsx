import { useEffect, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { IconClose } from '../components/icons';

export interface DialogField { key: string; label: string; value: string | number; type?: 'number' | 'text' | 'color'; suffix?: string; placeholder?: string }
export interface DialogButton { label: string; value: string; variant?: 'primary' | 'danger' | 'default' }
export interface DialogSpec {
  title: string;
  body?: ReactNode;
  icon?: ReactNode;
  fields?: DialogField[];
  buttons: DialogButton[];
  tone?: 'default' | 'danger';
  dir?: 'rtl' | 'ltr';
}
export interface DialogResult { value: string | null; fields: Record<string, string> }

interface DState {
  spec: DialogSpec | null;
  resolve: ((r: DialogResult) => void) | null;
  open: (s: DialogSpec) => Promise<DialogResult>;
  close: (r: DialogResult) => void;
}

export const useDialog = create<DState>((set, get) => ({
  spec: null,
  resolve: null,
  open: (s) => new Promise<DialogResult>((res) => set({ spec: s, resolve: res })),
  close: (r) => { const { resolve } = get(); resolve?.(r); set({ spec: null, resolve: null }); },
}));

/** Convenience themed confirm. Resolves true when the confirm button is pressed. */
export async function confirmDialog(opts: { title: string; body?: ReactNode; icon?: ReactNode; confirmLabel: string; cancelLabel: string; danger?: boolean; dir?: 'rtl' | 'ltr' }): Promise<boolean> {
  const r = await useDialog.getState().open({
    title: opts.title,
    body: opts.body,
    icon: opts.icon,
    tone: opts.danger ? 'danger' : 'default',
    dir: opts.dir,
    buttons: [
      { label: opts.cancelLabel, value: 'cancel' },
      { label: opts.confirmLabel, value: 'ok', variant: opts.danger ? 'danger' : 'primary' },
    ],
  });
  return r.value === 'ok';
}

/** Convenience themed prompt for a single text value. Resolves the trimmed value, or null on cancel. */
export async function promptDialog(opts: {
  title: string; body?: ReactNode; icon?: ReactNode; label: string; placeholder?: string; value?: string;
  confirmLabel: string; cancelLabel: string; dir?: 'rtl' | 'ltr';
}): Promise<string | null> {
  const r = await useDialog.getState().open({
    title: opts.title,
    body: opts.body,
    icon: opts.icon,
    dir: opts.dir,
    fields: [{ key: 'value', label: opts.label, value: opts.value ?? '', placeholder: opts.placeholder }],
    buttons: [
      { label: opts.cancelLabel, value: 'cancel' },
      { label: opts.confirmLabel, value: 'ok', variant: 'primary' },
    ],
  });
  return r.value === 'ok' ? (r.fields.value ?? '').trim() : null;
}

export function DialogHost() {
  const spec = useDialog((s) => s.spec);
  const close = useDialog((s) => s.close);
  const [vals, setVals] = useState<Record<string, string>>({});

  useEffect(() => {
    if (spec) setVals(Object.fromEntries((spec.fields ?? []).map((f) => [f.key, String(f.value)])));
  }, [spec]);

  useEffect(() => {
    if (!spec) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close({ value: null, fields: {} }); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [spec, close]);

  if (!spec) return null;
  const done = (value: string | null) => close({ value, fields: { ...vals } });
  const confirmValue = spec.buttons.find((b) => b.variant === 'primary' || b.variant === 'danger')?.value ?? null;

  return (
    <div className="modal-wrap dlg-wrap" onClick={() => done(null)}>
      <div className={`modal dlg ${spec.tone === 'danger' ? 'dlg-danger' : ''}`} dir={spec.dir ?? 'rtl'} onClick={(e) => e.stopPropagation()}>
        <button className="dlg-x" onClick={() => done(null)} aria-label="close"><IconClose size={16} /></button>
        <div className="dlg-main">
          {spec.icon && <div className="dlg-icon">{spec.icon}</div>}
          <div className="dlg-title">{spec.title}</div>
          {spec.body && <div className="dlg-text">{spec.body}</div>}
          {spec.fields && spec.fields.length > 0 && (
            <div className="dlg-fields">
              {spec.fields.map((f) => (
                <label className="dlg-field" key={f.key}>
                  <span>{f.label}</span>
                  <div className={`dlg-input ${f.type === 'color' ? 'dlg-input-color' : ''}`}>
                    <input
                      type={f.type ?? 'text'}
                      autoFocus={spec.fields![0].key === f.key}
                      placeholder={f.placeholder}
                      value={vals[f.key] ?? ''}
                      onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter' && confirmValue) done(confirmValue); }}
                    />
                    {f.type === 'color' && <em className="mono">{vals[f.key] ?? ''}</em>}
                    {f.suffix && <em>{f.suffix}</em>}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="modal-foot dlg-foot">
          {spec.buttons.map((b) => (
            <button
              key={b.value}
              className={`btn ${b.variant === 'primary' ? 'primary' : ''} ${b.variant === 'danger' ? 'danger' : ''}`}
              onClick={() => done(b.value)}
            >{b.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
