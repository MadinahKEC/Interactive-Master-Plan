import { useState } from 'react';
import { useApp } from '../store';
import { useAuth } from '../lib/auth';

const ERR: Record<string, { ar: string; en: string }> = {
  invalid: { ar: 'البريد الإلكتروني وكلمة المرور غير متطابقين مع أي حساب.', en: 'That email and password do not match an account.' },
  toomany: { ar: 'محاولات كثيرة. انتظر دقيقة ثم أعد المحاولة.', en: 'Too many attempts. Wait a minute, then try again.' },
  network: { ar: 'مشكلة في الاتصال — تحقق من الشبكة وأعد المحاولة.', en: 'Network problem — check your connection and try again.' },
  failed: { ar: 'تعذّر تسجيل الدخول.', en: 'Sign-in failed.' },
  noaccount: { ar: 'هذا البريد مسجّل لكن لا يملك صلاحية. اطلب من المسؤول إضافتك.', en: 'This email is signed in but has no access. Ask an administrator to add you.' },
  setup: { ar: 'لم يتم تفعيل خدمة الدخول في Firebase بعد. فعّل Email/Password من لوحة Firebase.', en: 'Sign-in isn’t enabled in Firebase yet. Enable Email/Password in the Firebase console.' },
};

export function Login() {
  const { lang, toggleLang } = useApp();
  const { status, error, busy, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const ar = lang === 'ar';

  if (status === 'loading') {
    return (
      <div className="auth-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading" style={{ position: 'static', background: 'transparent' }}>
          <img src={import.meta.env.BASE_URL + 'KEC.png'} alt="KEC" className="load-logo" />
          <div className="ring" />
        </div>
      </div>
    );
  }

  const submit = (e: React.FormEvent) => { e.preventDefault(); login(email, password, remember); };

  return (
    <div className="auth-overlay" style={{ display: 'flex' }}>
      <div className="auth-brand">
        <div className="auth-brand__in">
          <div className="auth-mark"><img src={import.meta.env.BASE_URL + 'KEC.png'} alt="KEC" /></div>
          <h1 className="auth-brand__t">{ar ? 'المخطط العام التفاعلي' : 'Interactive Master Plan'}</h1>
          <p className="auth-brand__s">{ar ? 'مدينة المعرفة الاقتصادية' : 'Knowledge Economic City'}</p>
          <span className="auth-brand__rule" />
        </div>
      </div>
      <div className="auth-panel">
        <form className="auth-form" onSubmit={submit} autoComplete="on" noValidate>
          <button type="button" className="auth-lang" onClick={toggleLang}>{ar ? 'English' : 'العربية'}</button>
          <h2 className="auth-form__t">{ar ? 'مرحباً بعودتك' : 'Welcome back'}</h2>
          <p className="auth-form__s">{ar ? 'سجّل الدخول للوصول إلى المخطط العام التفاعلي' : 'Sign in to access the Interactive Master Plan'}</p>
          {error && <div className="auth-error" style={{ display: 'block' }}>{ERR[error]?.[lang]}</div>}

          <label className="auth-lb" htmlFor="authEmail">{ar ? 'البريد الإلكتروني' : 'Email'}</label>
          <input id="authEmail" type="email" placeholder="name@madinahkec.com" autoComplete="username" spellCheck={false}
            value={email} onChange={(e) => setEmail(e.target.value)} />

          <label className="auth-lb" htmlFor="authPassword">{ar ? 'كلمة المرور' : 'Password'}</label>
          <input id="authPassword" type="password" placeholder={ar ? 'كلمة المرور' : 'Password'} autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)} />

          <div className="auth-row">
            <label className="auth-chk"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span>{ar ? 'إبقائي مسجّلاً على هذا الجهاز' : 'Keep me signed in on this device'}</span></label>
          </div>

          <button className="btn auth-go primary" type="submit" disabled={busy}>{busy ? (ar ? 'جارٍ الدخول…' : 'Signing in…') : (ar ? 'دخول آمن' : 'Sign In securely')}</button>
          <p className="auth-note">{ar ? 'كل حساب يُصدره المسؤول. المستعرض يسجّل بحسابه الخاص ويرى المخطط للقراءة فقط.' : 'Every account is issued by an administrator. Viewers sign in with their own account and see the plan read-only.'}</p>
          <p className="auth-pow">powered by : Sa^^3R</p>
        </form>
      </div>
    </div>
  );
}
