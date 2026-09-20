import { useState } from 'react';
import { useApp } from '../store';
import { t } from '../lib/domain';
import { changePassword } from '../lib/firebase';
import { IconClose, IconKey } from './icons';

/** Themed dialog to change the signed-in user's password: current + new + confirm. */
export function ChangePassword({ onClose }: { onClose: () => void }) {
  const { lang } = useApp();
  const ar = lang === 'ar';
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [cf, setCf] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (nw.length < 6) { setErr(t('pw.short', lang)); return; }
    if (nw !== cf) { setErr(t('pw.mismatch', lang)); return; }
    if (nw === cur) { setErr(t('pw.same', lang)); return; }
    setBusy(true);
    try {
      await changePassword(cur, nw);
      setDone(true);
      setTimeout(onClose, 1500);
    } catch (ex: any) {
      const c = ex?.code || '';
      if (c === 'auth/wrong-password' || c === 'auth/invalid-credential') setErr(t('pw.wrong', lang));
      else if (c === 'auth/weak-password') setErr(t('pw.short', lang));
      else if (c === 'auth/requires-recent-login') setErr(t('pw.reauth', lang));
      else setErr(t('pw.err', lang));
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-wrap" onClick={onClose}>
      <form className="modal cpw" onClick={(e) => e.stopPropagation()} onSubmit={submit} dir={ar ? 'rtl' : 'ltr'}>
        <div className="modal-head"><b className="cpw-head"><span className="cpw-badge"><IconKey size={16} /></span>{t('pw.title', lang)}</b><button type="button" className="ic-btn" onClick={onClose}><IconClose size={16} /></button></div>
        <div className="cpw-body">
          {done ? (
            <div className="cpw-done"><span className="cpw-check">✓</span>{t('pw.done', lang)}</div>
          ) : (
            <>
              <p className="cpw-sub">{t('pw.sub', lang)}</p>
              {err && <div className="cpw-err">{err}</div>}
              <label className="cpw-lb">{t('pw.current', lang)}</label>
              <input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
              <label className="cpw-lb">{t('pw.new', lang)}</label>
              <input type="password" autoComplete="new-password" value={nw} onChange={(e) => setNw(e.target.value)} />
              <span className="cpw-hint">{t('pw.hint', lang)}</span>
              <label className="cpw-lb">{t('pw.confirm', lang)}</label>
              <input type="password" autoComplete="new-password" value={cf} onChange={(e) => setCf(e.target.value)} />
            </>
          )}
        </div>
        {!done && (
          <div className="cpw-foot">
            <button type="button" className="btn" onClick={onClose}>{t('a.cancel', lang)}</button>
            <button type="submit" className="btn primary" disabled={busy || !cur || !nw || !cf}>{busy ? t('pw.saving', lang) : t('pw.save', lang)}</button>
          </div>
        )}
      </form>
    </div>
  );
}
