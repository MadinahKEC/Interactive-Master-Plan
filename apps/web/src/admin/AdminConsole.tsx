import { useEffect, useMemo, useState } from 'react';
import { SECTORS, LAND_USES, type PlotCollection } from '@kec/types';
import { useApp } from '../store';
import { useAuth } from '../lib/auth';
import { useOverrides, SUPER_ADMIN_EMAIL, DEFAULT_PLAN_STYLE } from '../lib/overrides';
import { createUserSecondary, watchAccessLog, restoreFromBackup, type AccessSession } from '../lib/firebase';
import { LICENSE_STAGES, PROGRESS_STAGES, resolveProject, t, type ProjectInfo } from '../lib/domain';
import { confirmDialog } from '../lib/dialog';
import type { EffLandUse } from '../lib/effective';
import { PlotEditor } from './PlotEditor';
import { IconPlots, IconPalette, IconUsers, IconAudit, IconSettings, IconClose, IconUndo, IconExcel, IconClock, IconTrash, IconDownload, IconAdmin } from '../components/icons';

type Tab = 'plots' | 'landuses' | 'users' | 'access' | 'audit' | 'settings';
const TABS: Record<Tab, (p: { size?: number }) => JSX.Element> = {
  plots: IconPlots, landuses: IconPalette,
  users: IconUsers, access: IconClock, audit: IconAudit, settings: IconSettings,
};
// Grouped, labelled navigation for a cleaner, more professional console.
const NAV_GROUPS: { label?: string; ids: Tab[]; adminOnly?: Tab[] }[] = [
  { label: 'a.grpData', ids: ['plots', 'landuses'] },
  { label: 'a.grpAdmin', ids: ['users', 'access', 'audit'], adminOnly: ['audit'] },
  { label: 'a.grpSystem', ids: ['settings'] },
];

/**
 * Google-Drive backup web app (deployed Apps Script). Same pattern as the Investor
 * Registration Log: set once here, kept out of the UI. Leave `url` blank to hide the
 * in-app restore browser (the file-based Import/Export still works either way).
 */
const BACKUP_WEBAPP = {
  url: 'https://script.google.com/macros/s/AKfycbybkJa7wawyzyp9hMC6I-jf6ZygAGSmuxP5EBhTNrnKb0TPPviDBkugrT_wNEsgkIEHGw/exec',
  token: 'kec-bk-9f3Kd82m',
};

export function AdminConsole({
  open, onClose, editCode, data, projects, landUses,
}: {
  open: boolean; onClose: () => void; editCode: string | null;
  data: PlotCollection | null; projects: Record<string, ProjectInfo>; landUses: Record<string, EffLandUse>;
}) {
  const { lang } = useApp();
  const role = useAuth((s) => s.user?.role);
  const isAdmin = role === 'administrator';
  const [tab, setTab] = useState<Tab>('plots');
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    if (open && editCode) { setTab('plots'); setEditing(editCode); }
  }, [open, editCode]);

  if (!open || !data) return null;
  return (
    <div className="admin-root" style={{ ['--mod' as string]: '#C9A227' }}>
      <div className="admin-head">
        <div className="admin-brand">
          <img src={import.meta.env.BASE_URL + 'KEC.png'} alt="KEC" />
          <span className="admin-bicon"><IconAdmin size={18} /></span>
          <div className="admin-btitle">
            <span className="admin-kicker">{t('brand.title', lang)}</span>
            <b>{t('a.title', lang)}</b>
          </div>
        </div>
        <button className="ic-btn lg" onClick={onClose}><IconClose size={20} /></button>
      </div>
      <div className="admin-main">
        <nav className="admin-nav">
          {NAV_GROUPS.map((g, i) => {
            const ids = g.ids.filter((id) => !(g.adminOnly?.includes(id)) || isAdmin);
            if (!ids.length) return null;
            return (
              <div className="nav-grp" key={i}>
                {g.label && <div className="nav-grp-l">{t(g.label, lang)}</div>}
                {ids.map((id) => { const Icon = TABS[id]; return (
                  <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
                    <span className="ni"><Icon size={18} /></span>{t(`a.${id}`, lang)}
                  </button>
                ); })}
              </div>
            );
          })}
        </nav>
        <section className="admin-content">
          {tab === 'plots' && <PlotsTab data={data} projects={projects} landUses={landUses} onEdit={setEditing} />}
          {tab === 'landuses' && <LandUsesTab landUses={landUses} data={data} />}
          {tab === 'users' && <UsersTab />}
          {tab === 'access' && <AccessLogTab />}
          {tab === 'audit' && isAdmin && <AuditTab />}
          {tab === 'settings' && <SettingsTab data={data} projects={projects} isAdmin={isAdmin} />}
        </section>
      </div>
      {editing && <PlotEditor code={editing} data={data} projects={projects} landUses={landUses} onClose={() => setEditing(null)} />}
    </div>
  );
}


/* ---------------- Plots table ---------------- */
function PlotsTab({ data, projects, landUses, onEdit }: { data: PlotCollection; projects: Record<string, ProjectInfo>; landUses: Record<string, EffLandUse>; onEdit: (c: string) => void }) {
  const { lang } = useApp();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ k: string; dir: 1 | -1 }>({ k: 'code', dir: 1 });
  const rows = useMemo(() => {
    const s = q.trim().toUpperCase();
    let r = data.features.map((f) => {
      const p = f.properties; const pr = resolveProject(p.code, p.land_use, projects);
      const name = pr.named ? (lang === 'ar' ? pr.overlay.name_ar || pr.overlay.name_en : pr.overlay.name_en || pr.overlay.name_ar) : '—';
      return { code: p.code, name, land_use: lang === 'ar' ? landUses[p.land_use as string]?.labelAr ?? p.land_use : landUses[p.land_use as string]?.labelEn ?? p.land_use, luColor: landUses[p.land_use as string]?.color ?? '#C9C9C9', sector: p.sector, floors: p.floors ?? 0, area: p.area ?? 0, status: lang === 'ar' ? pr.status.ar : pr.status.en, statusColor: pr.status.color };
    });
    if (s) r = r.filter((x) => x.code.toUpperCase().includes(s) || (x.name ?? '').toUpperCase().includes(s));
    r.sort((a: any, b: any) => (a[sort.k] > b[sort.k] ? 1 : a[sort.k] < b[sort.k] ? -1 : 0) * sort.dir);
    return r.slice(0, 200);
  }, [data, projects, landUses, q, sort, lang]);
  const th = (k: string, label: string) => (
    <th onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : 1 }))}>{label}{sort.k === k ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</th>
  );
  return (
    <div className="tab-plots">
      <div className="tab-toolbar">
        <input className="admin-search" placeholder={t('a.search', lang)} value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="tt-count"><b>{rows.length}</b> {t('cp.plotsWord', lang)}</span>
      </div>
      <div className="table-scroll">
        <table className="admin-table admin-table--plots">
          <thead><tr>{th('code', t('cp.plotsWord', lang))}{th('name', t('a.name', lang))}{th('land_use', t('a.landuse', lang))}{th('sector', t('a.sector', lang))}{th('floors', t('d.floors', lang))}{th('area', t('d.area', lang))}{th('status', t('a.status', lang))}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} onClick={() => onEdit(r.code)}>
                <td className="mono at-code">{r.code}</td><td>{r.name}</td>
                <td><span className="at-lu"><span className="at-sw" style={{ background: r.luColor }} />{r.land_use}</span></td>
                <td>{lang === 'ar' ? SECTORS[r.sector]?.labelAr ?? r.sector : r.sector}</td>
                <td className="mono">{r.floors}</td><td className="mono">{Math.round(r.area).toLocaleString()}</td>
                <td><span className="at-status" style={{ color: r.statusColor, background: r.statusColor + '1f', borderColor: r.statusColor + '55' }}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Land uses ---------------- */
function LandUsesTab({ landUses, data }: { landUses: Record<string, EffLandUse>; data: PlotCollection }) {
  const { lang } = useApp();
  const { setLandUse, removeLandUse, restoreLandUse, planStyle, setPlanStyle } = useOverrides();
  const hiddenLandUses = useOverrides((s) => s.hiddenLandUses);
  const counts = useMemo(() => { const c: Record<string, number> = {}; for (const f of data.features) c[f.properties.land_use ?? ''] = (c[f.properties.land_use ?? ''] || 0) + 1; return c; }, [data]);
  const [nu, setNu] = useState({ ar: '', en: '', color: '#2F6B3E' });
  const addLandUse = () => {
    const en = nu.en.trim(), ar = nu.ar.trim();
    const key = (en || ar).trim();
    if (!key || landUses[key]) return;
    setLandUse(key, { labelAr: ar || key, labelEn: en || key, color: nu.color });
    setNu({ ar: '', en: '', color: '#2F6B3E' });
  };
  const removeOne = async (k: string) => {
    if (await confirmDialog({ title: t('a.remove', lang), body: <b>{lang === 'ar' ? landUses[k].labelAr : landUses[k].labelEn}</b>, icon: <IconTrash size={24} />, confirmLabel: t('a.remove', lang), cancelLabel: t('a.cancel', lang), danger: true, dir: lang === 'ar' ? 'rtl' : 'ltr' })) removeLandUse(k);
  };
  return (
    <div className="tab-lu">
      <div className="lu-add">
        <input type="color" value={nu.color} onChange={(e) => setNu({ ...nu, color: e.target.value })} />
        <input className="lu-name" placeholder={t('opt.ar', lang)} value={nu.ar} onChange={(e) => setNu({ ...nu, ar: e.target.value })} />
        <input className="lu-name" placeholder={t('opt.en', lang)} value={nu.en} onChange={(e) => setNu({ ...nu, en: e.target.value })} />
        <button className="btn primary" disabled={!nu.ar.trim() && !nu.en.trim()} onClick={addLandUse}>{t('a.addLanduse', lang)}</button>
      </div>
      <div className="lu-plan">
        <div className="lu-plan-head"><b>{t('a.planStyle', lang)}</b><span>{t('a.planStyleHint', lang)}</span></div>
        <div className="lu-plan-row">
          <label className="lu-plan-k"><input type="checkbox" checked={planStyle.outlineByStatus ?? true} onChange={(e) => setPlanStyle({ outlineByStatus: e.target.checked })} /><span>{t('a.planOutlineStatus', lang)}</span></label>
          {!(planStyle.outlineByStatus ?? true) && <label className="lu-plan-c"><input type="color" value={planStyle.outline} onChange={(e) => setPlanStyle({ outline: e.target.value })} /><span>{t('a.planOutline', lang)}</span></label>}
          <label className="lu-plan-k"><input type="checkbox" checked={planStyle.dash} onChange={(e) => setPlanStyle({ dash: e.target.checked })} /><span>{t('a.planDash', lang)}</span></label>
          <label className="lu-plan-k"><input type="checkbox" checked={planStyle.glow} onChange={(e) => setPlanStyle({ glow: e.target.checked })} /><span>{t('a.planGlow', lang)}</span></label>
          <button className="btn sm" onClick={() => setPlanStyle(DEFAULT_PLAN_STYLE)}>{t('a.reset', lang)}</button>
        </div>
        <div className="lu-plan-row lu-plan-adv">
          <label className="lu-plan-s"><span>{t('a.planOutlineW', lang)}</span><input type="range" min={1} max={8} step={0.2} value={planStyle.outlineWidth ?? 2.6} onChange={(e) => setPlanStyle({ outlineWidth: +e.target.value })} /></label>
          {planStyle.dash && <label className="lu-plan-s"><span>{t('a.planDashLen', lang)}</span><input type="range" min={0.5} max={6} step={0.5} value={planStyle.dashLen ?? 2} onChange={(e) => setPlanStyle({ dashLen: +e.target.value })} /></label>}
          {planStyle.dash && <label className="lu-plan-s"><span>{t('a.planDashGap', lang)}</span><input type="range" min={0.5} max={6} step={0.5} value={planStyle.dashGap ?? 1.4} onChange={(e) => setPlanStyle({ dashGap: +e.target.value })} /></label>}
          {planStyle.glow && <label className="lu-plan-s"><span>{t('a.planGlowW', lang)}</span><input type="range" min={3} max={18} step={1} value={planStyle.glowWidth ?? 9} onChange={(e) => setPlanStyle({ glowWidth: +e.target.value })} /></label>}
        </div>
      </div>
      <div className="lu-sec-h">{t('cp.uses', lang)} <span className="lu-sec-n">{Object.keys(landUses).length}</span></div>
      <div className="lu-grid">
        {Object.keys(landUses).sort((a, b) => (counts[b] || 0) - (counts[a] || 0)).map((k) => (
          <div className="lu-row" key={k} style={{ ['--lu' as string]: landUses[k].color }}>
            <input type="color" value={landUses[k].color} onChange={(e) => setLandUse(k, { color: e.target.value })} />
            <div className="lu-body">
              <input className="lu-name" value={lang === 'ar' ? landUses[k].labelAr : landUses[k].labelEn}
                onChange={(e) => setLandUse(k, lang === 'ar' ? { labelAr: e.target.value } : { labelEn: e.target.value })} />
              <span className="lu-usage"><span className="lu-usage-bar" style={{ width: `${((counts[k] || 0) / Math.max(1, ...Object.keys(landUses).map((x) => counts[x] || 0))) * 100}%`, background: landUses[k].color }} /></span>
            </div>
            <span className="lu-ct mono">{counts[k] || 0}</span>
            <button className="mini-btn danger" onClick={() => removeOne(k)} title={t('a.remove', lang)}>✕</button>
          </div>
        ))}
      </div>
      {hiddenLandUses.length > 0 && (
        <div className="lu-removed">
          <span className="lu-removed-t">{t('a.removedLanduses', lang)}</span>
          {hiddenLandUses.map((k) => (
            <button key={k} className="lu-restore" onClick={() => restoreLandUse(k)}>↺ {LAND_USES[k] ? (lang === 'ar' ? LAND_USES[k].labelAr : k) : k}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Users ---------------- */
function UsersTab() {
  const { lang } = useApp();
  const { users, addUser, updateUser, removeUser } = useOverrides();
  const [nu, setNu] = useState({ name: '', email: '', password: '', role: 'viewer' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const email = nu.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { setMsg({ ok: false, text: lang === 'ar' ? 'بريد غير صالح' : 'Invalid email' }); return; }
    if (nu.password.length < 6) { setMsg({ ok: false, text: lang === 'ar' ? 'كلمة المرور 6 أحرف على الأقل' : 'Password must be ≥ 6 chars' }); return; }
    setBusy(true); setMsg(null);
    try {
      await createUserSecondary(email, nu.password);          // creates the Firebase account
      addUser({ name: nu.name, email, role: nu.role, active: true }); // stores the role mapping
      setNu({ name: '', email: '', password: '', role: 'viewer' });
      setMsg({ ok: true, text: lang === 'ar' ? 'تم إنشاء المستخدم' : 'User created' });
    } catch (e: any) {
      const c = e?.code || '';
      const text = c === 'auth/email-already-in-use' ? (lang === 'ar' ? 'البريد مستخدم مسبقاً' : 'Email already in use')
        : c === 'auth/operation-not-allowed' ? (lang === 'ar' ? 'فعّل Email/Password في Firebase' : 'Enable Email/Password in Firebase')
        : (lang === 'ar' ? 'فشل الإنشاء' : 'Creation failed') + (c ? ` (${c})` : '');
      setMsg({ ok: false, text });
    } finally { setBusy(false); }
  };

  return (
    <div className="tab-users">
      <div className="table-scroll">
        <table className="admin-table">
          <thead><tr><th>{t('a.name', lang)}</th><th>{t('a.email', lang)}</th><th>{t('a.role', lang)}</th><th>{t('a.active', lang)}</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td className="mono">{u.email}</td>
                <td><select value={u.role} disabled={u.email === SUPER_ADMIN_EMAIL} onChange={(e) => updateUser(u.id, { role: e.target.value })}>
                  {['administrator', 'editor', 'contributor', 'viewer'].map((r) => <option key={r} value={r}>{t(`role.${r}`, lang)}</option>)}
                </select></td>
                <td><input type="checkbox" checked={u.active} disabled={u.email === SUPER_ADMIN_EMAIL} onChange={(e) => updateUser(u.id, { active: e.target.checked })} /></td>
                <td>{u.email !== SUPER_ADMIN_EMAIL && <button className="mini-btn danger" onClick={async () => { if (await confirmDialog({ title: t('a.removeUser', lang), body: <><b>{u.name || u.email}</b> — {t('a.removeUserConfirm', lang)}</>, icon: <IconTrash size={24} />, confirmLabel: t('a.removeUser', lang), cancelLabel: t('a.cancel', lang), danger: true, dir: lang === 'ar' ? 'rtl' : 'ltr' })) removeUser(u.id); }}>{t('a.remove', lang)}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="add-user">
        <input placeholder={t('a.name', lang)} value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} />
        <input placeholder={t('a.email', lang)} value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} />
        <input type="password" placeholder={t('a.password', lang)} value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} />
        <select value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}>
          {['administrator', 'editor', 'contributor', 'viewer'].map((r) => <option key={r} value={r}>{t(`role.${r}`, lang)}</option>)}
        </select>
        <button className="btn primary" disabled={busy || !nu.name || !nu.email} onClick={create}>{busy ? '…' : t('a.addUser', lang)}</button>
      </div>
      {msg && <div className={`add-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      <div className="hint" style={{ marginTop: 8 }}>{lang === 'ar' ? 'يُنشئ حساب Firebase حقيقياً ويربط الدور. يتطلب تفعيل Email/Password في Firebase.' : 'Creates a real Firebase account and maps the role. Requires Email/Password enabled in Firebase.'}</div>
    </div>
  );
}

/* ---------------- Access log ---------------- */
function deviceOf(ua?: string): string {
  if (!ua) return '—';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/android/i.test(ua)) return 'Android';
  if (/windows/i.test(ua)) return 'Windows';
  if (/mac os/i.test(ua)) return 'macOS';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Other';
}
function AccessLogTab() {
  const { lang } = useApp();
  const [rows, setRows] = useState<AccessSession[]>([]);
  useEffect(() => watchAccessLog(setRows), []);
  const dur = (s: AccessSession) => {
    const m = Math.max(0, Math.round((s.lastSeen - s.loginAt) / 60000));
    return m < 60 ? `${m} ${lang === 'ar' ? 'د' : 'min'}` : `${Math.floor(m / 60)} ${lang === 'ar' ? 'س' : 'h'} ${m % 60}`;
  };
  return (
    <div>
      <div className="ed-sec">{t('a.access', lang)} · {rows.length}</div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr>
            <th>{t('a.name', lang)}</th><th>{t('a.role', lang)}</th><th>IP</th>
            <th>{t('a.location', lang)}</th><th>{t('a.device', lang)}</th><th>{t('a.time', lang)}</th><th>{t('a.duration', lang)}</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="dim">{t('a.noSessions', lang)}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name || r.email}<div className="dim">{r.email}</div></td>
                <td>{t(`role.${r.role}`, lang)}</td>
                <td className="mono">{r.ip || '—'}</td>
                <td>{[r.city, r.country].filter(Boolean).join(', ') || '—'}</td>
                <td>{deviceOf(r.ua)}</td>
                <td className="mono">{new Date(r.loginAt).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-GB')}</td>
                <td className="mono">{dur(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Audit ---------------- */
/** Change-log action → category (colour + verb), matching the KEC register style. */
function auditCat(action: string): 'added' | 'edited' | 'deleted' {
  const a = action.toLowerCase();
  if (/remove|hide|delete|unmerge/.test(a)) return 'deleted';
  if (/edit|attr|project|planstyle|geometry|subdivide|option|update/.test(a)) return 'edited';
  return 'added';
}
function AuditTab() {
  const { lang } = useApp();
  const audit = useOverrides((s) => s.audit);
  const revertOne = useOverrides((s) => s.revertOne);
  const clearAudit = useOverrides((s) => s.clearAudit);
  const [q, setQ] = useState('');
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const doRevert = async (id: string) => {
    const ok = await confirmDialog({
      title: t('audit.revertTitle', lang), body: t('audit.revertBody', lang), icon: <IconUndo size={24} />,
      confirmLabel: t('audit.revert', lang), cancelLabel: t('a.cancel', lang), danger: true, dir,
    });
    if (ok) revertOne(id);
  };
  const doClear = async () => {
    if (await confirmDialog({ title: t('cl.clear', lang), body: t('cl.clearConfirm', lang), icon: <IconTrash size={24} />, confirmLabel: t('cl.clear', lang), cancelLabel: t('a.cancel', lang), danger: true, dir })) clearAudit();
  };
  const doExport = () => {
    const head = ['When', 'User', 'Action', 'Target', 'Details'].join(',');
    const cell = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const body = audit.map((e) => [new Date(e.at).toLocaleString(), e.actor ?? '', e.action, e.target ?? '', e.detail ?? ''].map(cell).join(','));
    const blob = new Blob(['﻿' + [head, ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `kec-change-log-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  const query = q.trim().toLowerCase();
  const rows = audit.filter((e) => !query || `${e.actor ?? ''} ${e.action} ${e.target ?? ''} ${e.detail ?? ''}`.toLowerCase().includes(query));
  const people = new Set(audit.map((e) => e.actor).filter(Boolean)).size;
  const today = new Date().toDateString();
  const todayN = audit.filter((e) => new Date(e.at).toDateString() === today).length;
  const latest = audit.find((e) => e.prev);
  // Group newest-first entries under a day heading (records are ordered, so no re-sort).
  const groupByDay = (list: typeof rows) => {
    const ykey = new Date().toDateString(); const ykey2 = new Date(Date.now() - 864e5).toDateString();
    const out: { key: string; label: string; items: typeof rows }[] = [];
    for (const e of list) {
      const d = new Date(e.at); const key = d.toDateString();
      const label = key === ykey ? t('cl.today', lang) : key === ykey2 ? t('cl.yesterday', lang)
        : d.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(e); else out.push({ key, label, items: [e] });
    }
    return out;
  };

  return (
    <div className="clog">
      <div className="clog-ttl">{t('a.audit', lang)}</div>
      <p className="clog-sub">{t('a.auditHint', lang)}</p>
      <div className="clog-bar">
        <span className="clog-stat"><b>{audit.length}</b> {t('cl.changes', lang)}</span>
        <span className="clog-stat"><b>{people}</b> {t('cl.people', lang)}</span>
        <span className="clog-stat"><b>{todayN}</b> {t('cl.today', lang)}</span>
        <span className="clog-sp" />
        <input className="clog-q" placeholder={t('cl.filter', lang)} value={q} onChange={(e) => setQ(e.target.value)} />
        {latest && <button className="btn sm" onClick={() => doRevert(latest.id)}><IconUndo size={13} /> {t('a.undoLast', lang)}</button>}
        {audit.length > 0 && <button className="btn sm" onClick={doExport}><IconExcel size={13} /> {t('cl.export', lang)}</button>}
        {audit.length > 0 && <button className="btn sm danger" onClick={doClear}>{t('cl.clear', lang)}</button>}
      </div>
      {rows.length === 0 ? (
        <div className="clog-empty">{audit.length ? t('cl.emptyFilter', lang) : t('cl.empty', lang)}</div>
      ) : (
        <div className="clog-days">
          {groupByDay(rows).map((g) => (
            <div className="clog-day" key={g.key}>
              <div className="clog-day-h"><span className="clog-day-l">{g.label}</span><span className="clog-day-n">{g.items.length}</span></div>
              <ul className="clog-ol">
                {g.items.map((e) => {
                  const cat = auditCat(e.action);
                  return (
                    <li className="clog-o" key={e.id}>
                      <span className={`clog-tag ${cat}`}>{t(`cl.${cat}`, lang)}</span>
                      <span className="clog-t">
                        <b>{e.target ?? e.action}</b>
                        {e.detail && <span className="clog-dim"> · {e.detail}</span>}
                      </span>
                      <span className="clog-u" title={t('a.actor', lang)}>{e.actor ?? '—'}</span>
                      <span className="clog-when mono">{new Date(e.at).toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                      {e.prev
                        ? <button className="clog-ib dg" onClick={() => doRevert(e.id)} title={t('audit.revert', lang)}><IconUndo size={13} /> {t('audit.revert', lang)}</button>
                        : <span className="clog-old">{t('cl.olderNote', lang)}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Drive restore (inside Settings) ---------------- */
type BackupFile = { id: string; name: string; date: string; size: number };
function DriveRestore() {
  const { lang } = useApp();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<BackupFile[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const api = (params: string) =>
    fetch(BACKUP_WEBAPP.url + (BACKUP_WEBAPP.url.indexOf('?') < 0 ? '?' : '&') + 'token=' + encodeURIComponent(BACKUP_WEBAPP.token) + '&' + params).then((r) => r.json());

  const load = async () => {
    setBusy(true); setErr(''); setFiles(null);
    try {
      const res = await api('action=list');
      if (res.error) setErr(t('bk.err', lang)); else setFiles(res.files || []);
    } catch { setErr(t('bk.err', lang)); } finally { setBusy(false); }
  };
  const toggle = () => { const n = !open; setOpen(n); if (n && !files) load(); };

  const fmtDate = (d: string) => {
    const p = d.split('-'); if (p.length !== 3) return d;
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const fmtSize = (n: number) => (n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB');

  const doRestore = async (f: BackupFile) => {
    const ok = await confirmDialog({
      title: t('bk.restore', lang), icon: <IconUndo size={24} />,
      body: <><div>{t('bk.restoreConfirm', lang)}</div><b>{fmtDate(f.date)}</b></>,
      confirmLabel: t('bk.restore', lang), cancelLabel: t('a.cancel', lang), danger: true, dir,
    });
    if (!ok) return;
    setBusy(true); setErr('');
    try {
      const res = await api('action=get&id=' + encodeURIComponent(f.id));
      if (res.error || !res.content) throw new Error(res.error || 'no content');
      await restoreFromBackup(JSON.parse(res.content).docs || {});
      setTimeout(() => window.location.reload(), 600);
    } catch { setErr(t('bk.err', lang)); setBusy(false); }
  };

  if (!BACKUP_WEBAPP.url) return null;
  return (
    <div className="set-row set-row--col">
      <div className="set-row__head">
        <span>{t('bk.restoreTitle', lang)}</span>
        <button className="btn" onClick={toggle}><IconDownload size={14} /> {open ? t('bk.hideList', lang) : t('bk.browse', lang)}</button>
      </div>
      {open && (
        <div className="bk-list">
          <div className="bk-note">{t('bk.hint', lang)}</div>
          {err && <div className="clog-empty" style={{ color: 'var(--kec-neg)' }}>{err}</div>}
          {busy && !files && <div className="clog-empty">{t('bk.loading', lang)}</div>}
          {files && files.length === 0 && <div className="clog-empty">{t('bk.none', lang)}</div>}
          {files && files.length > 0 && (
            <ul className="clog-ol">
              {files.map((f) => (
                <li className="clog-o" key={f.id}>
                  {f.date === new Date().toISOString().slice(0, 10)
                    ? <span className="clog-tag added">{t('cl.today', lang)}</span>
                    : <span className="bk-dot" />}
                  <span className="clog-t"><b>{fmtDate(f.date)}</b> <span className="clog-dim">· {fmtSize(f.size)}</span></span>
                  <button className="clog-ib dg" disabled={busy} onClick={() => doRestore(f)}><IconUndo size={13} /> {t('bk.restore', lang)}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- Settings ---------------- */
function SettingsTab({ data, projects, isAdmin }: { data: PlotCollection | null; projects: Record<string, ProjectInfo>; isAdmin: boolean }) {
  const { lang, toggleLang } = useApp();
  const { exportAll, importAll, reset } = useOverrides();
  const doExport = () => {
    const blob = new Blob([exportAll()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'kec-overrides.json'; a.click();
  };
  const doImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    file.text().then((txt) => importAll(txt));
  };
  const doExcel = () => {
    if (!data) return;
    const licLabel = (k?: string) => LICENSE_STAGES.find((x) => x.key === k)?.en ?? k ?? '';
    const stgLabel = (k?: string) => PROGRESS_STAGES.find((x) => x.key === k)?.en ?? k ?? '';
    const headers = ['Code', 'Name (AR)', 'Name (EN)', 'Land Use', 'Sector', 'Type', 'Status', 'Plan Status', 'Ownership', 'Owner', 'Purchase Date', 'Area (m²)', 'GFA', 'Floors', 'Height (m)', 'Coverage', 'FAR', 'Construction Stage', 'Latest Permit'];
    const esc = (v: any) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = data.features.map((f) => {
      const p = f.properties as any; const pr = resolveProject(p.code, p.land_use, projects); const o = pr.overlay;
      return [
        p.code, o.name_ar || '', o.name_en || '', p.land_use, p.sector, pr.type.en, pr.status.en, p.planStatus || '',
        pr.ownership.en, pr.owner || '', o.purchase_date || '', p.area, p.gfa, p.floors, p.height, p.coverage, p.far,
        stgLabel(o.stage), licLabel(o.license),
      ];
    });
    const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `kec-plots-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };
  return (
    <div className="tab-settings">
      <div className="set-sec">{t('a.grpGeneral', lang)}</div>
      <div className="set-row"><span>اللغة / Language</span>
        <button className="btn" onClick={toggleLang}>{lang === 'ar' ? 'English' : 'العربية'}</button></div>

      <div className="set-sec">{t('a.grpBackup', lang)}</div>
      <div className="set-row"><span>{t('a.excel', lang)}</span><button className="btn primary" onClick={doExcel}><IconExcel size={15} /> {t('a.excel', lang)} ({data?.features.length ?? 0})</button></div>
      <div className="set-row"><span>{t('a.export', lang)}</span><button className="btn" onClick={doExport}>⬇ {t('a.export', lang)}</button></div>
      <div className="set-row"><span>{t('a.import', lang)}</span><label className="btn">⬆ {t('a.import', lang)}<input type="file" accept="application/json" hidden onChange={doImport} /></label></div>
      {isAdmin && <DriveRestore />}

      {isAdmin && <>
        <div className="set-sec set-sec--danger">{t('a.grpDanger', lang)}</div>
        <div className="set-row"><span>{t('a.reset', lang)}</span><button className="btn danger" onClick={async () => { if (await confirmDialog({ title: t('a.reset', lang), body: t('a.resetConfirm', lang), icon: <IconTrash size={24} />, confirmLabel: t('a.reset', lang), cancelLabel: t('a.cancel', lang), danger: true, dir: lang === 'ar' ? 'rtl' : 'ltr' })) reset(); }}>{t('a.reset', lang)}</button></div>
      </>}
    </div>
  );
}
