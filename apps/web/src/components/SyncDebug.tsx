import { useEffect, useState } from 'react';
import { onSyncEvent, syncLog, type SyncEvt } from '../lib/firebase';

/**
 * Temporary, admin-only sync readout — shows whether each save actually reaches
 * Firestore (write-ok / write-err) and when a remote snapshot is applied (which
 * is what would "revert" an edit). Lets us pinpoint the land-use persistence issue.
 */
export function SyncDebug() {
  const [evts, setEvts] = useState<SyncEvt[]>(syncLog.slice(0, 5));
  const [open, setOpen] = useState(true);
  useEffect(() => onSyncEvent(() => setEvts(syncLog.slice(0, 5))), []);
  if (!open) return <button className="syncdbg-reopen" onClick={() => setOpen(true)} title="sync log">⇅</button>;
  const color = (k: SyncEvt['kind']) => (k === 'write-ok' ? '#2F6B3E' : k === 'write-err' ? '#B5462F' : '#2E7D6B');
  const t = (at: number) => new Date(at).toLocaleTimeString();
  return (
    <div className="syncdbg">
      <div className="syncdbg-head"><b>Sync log</b><button onClick={() => setOpen(false)}>×</button></div>
      {evts.length === 0 && <div className="syncdbg-row muted">no events yet — add/edit something</div>}
      {evts.map((e, i) => (
        <div className="syncdbg-row" key={i}>
          <span className="syncdbg-dot" style={{ background: color(e.kind) }} />
          <span className="syncdbg-k" style={{ color: color(e.kind) }}>{e.kind}</span>
          <span className="syncdbg-m">{e.msg}</span>
          <span className="syncdbg-t">{t(e.at)}</span>
        </div>
      ))}
    </div>
  );
}
