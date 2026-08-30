import { useEffect, useRef, useState } from 'react';
import { onSyncEvent } from '../lib/firebase';
import { useApp } from '../store';
import { t } from '../lib/domain';

/** Small bottom toast that confirms every edit reached the cloud (or warns if not),
 *  then fades after a couple of seconds. */
export function SaveToast() {
  const lang = useApp((s) => s.lang);
  const [state, setState] = useState<'ok' | 'err' | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => onSyncEvent((e) => {
    if (e.kind !== 'write-ok' && e.kind !== 'write-err') return; // ignore remote-apply events
    setState(e.kind === 'write-ok' ? 'ok' : 'err');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState(null), e.kind === 'write-ok' ? 2200 : 4000);
  }), []);
  if (!state) return null;
  return (
    <div className={`save-toast ${state}`} role="status">
      <span className="save-toast-ic">{state === 'ok' ? '✓' : '!'}</span>
      {state === 'ok' ? t('save.ok', lang) : t('save.err', lang)}
    </div>
  );
}
