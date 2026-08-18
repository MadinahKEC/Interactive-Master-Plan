import { useEffect, useMemo, useState } from 'react';
import { SECTORS, type PlotCollection } from '@kec/types';
import { useApp } from '../store';
import { useOverrides, SUPER_ADMIN_EMAIL } from '../lib/overrides';
import { createUserSecondary } from '../lib/firebase';
import { STATUS_META, resolveProject, t, type ProjectInfo } from '../lib/domain';
import type { EffLandUse } from '../lib/effective';
import { Chart } from './Chart';
import { PlotEditor } from './PlotEditor';
import { IconDashboard, IconPlots, IconPalette, IconUsers, IconAudit, IconSettings, IconClose, IconCalendar } from '../components/icons';

type Tab = 'dashboard' | 'plots' | 'devplan' | 'landuses' | 'users' | 'audit' | 'settings';
const TABS: { id: Tab; Icon: (p: { size?: number }) => JSX.Element }[] = [
  { id: 'dashboard', Icon: IconDashboard }, { id: 'plots', Icon: IconPlots }, { id: 'devplan', Icon: IconCalendar },
  { id: 'landuses', Icon: IconPalette }, { id: 'users', Icon: IconUsers }, { id: 'audit', Icon: IconAudit }, { id: 'settings', Icon: IconSettings },
];

export function AdminConsole({
  open, onClose, editCode, data, projects, landUses,
}: {
  open: boolean; onClose: () => void; editCode: string | null;
  data: PlotCollection | null; projects: Record<string, ProjectInfo>; landUses: Record<string, EffLandUse>;
}) {
  const { lang } = useApp();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    if (open && editCode) { setTab('plots'); setEditing(editCode); }
  }, [open, editCode]);

  if (!open || !data) return null;
  return (
    <div className="admin-root">
      <div className="admin-head">
        <div className="admin-brand"><img src={import.meta.env.BASE_URL + 'KEC.png'} alt="KEC" /><b>{t('a.title', lang)}</b></div>
        <button className="ic-btn lg" onClick={onClose}><IconClose size={20} /></button>
      </div>
      <div className="admin-main">
        <nav className="admin-nav">
          {TABS.map((x) => (
            <button key={x.id} className={tab === x.id ? 'on' : ''} onClick={() => setTab(x.id)}>
              <span className="ni"><x.Icon size={18} /></span>{t(`a.${x.id}`, lang)}
            </button>
          ))}
        </nav>
        <section className="admin-content">
          {tab === 'dashboard' && <Dashboard data={data} projects={projects} landUses={landUses} />}
          {tab === 'plots' && <PlotsTab data={data} projects={projects} landUses={landUses} onEdit={setEditing} />}
          {tab === 'devplan' && <DevPlanTab data={data} projects={projects} onEdit={setEditing} />}
          {tab === 'landuses' && <LandUsesTab landUses={landUses} data={data} />}
          {tab === 'users' && <UsersTab />}
          {tab === 'audit' && <AuditTab />}
          {tab === 'settings' && <SettingsTab />}
        </section>
      </div>
      {editing && <PlotEditor code={editing} data={data} projects={projects} landUses={landUses} onClose={() => setEditing(null)} />}
    </div>
  );
}

/* ---------------- Dashboard ---------------- */
function Dashboard({ data, projects, landUses }: { data: PlotCollection; projects: Record<string, ProjectInfo>; landUses: Record<string, EffLandUse> }) {
  const { lang } = useApp();
  const txt = '#16221B';
  const stats = useMemo(() => {
    const lu: Record<string, number> = {}; const sec: Record<string, number> = {}; const st: Record<string, number> = {};
    let gfa = 0;
    for (const f of data.features) {
      const p = f.properties;
      lu[p.land_use ?? '—'] = (lu[p.land_use ?? '—'] || 0) + 1;
      sec[p.sector] = (sec[p.sector] || 0) + 1;
      const pr = resolveProject(p.code, p.land_use, projects);
      st[pr.status.key] = (st[pr.status.key] || 0) + 1;
      gfa += p.gfa || 0;
    }
    return { lu, sec, st, gfa };
  }, [data, projects]);
  const named = Object.values(projects).filter((p) => p.name_ar || p.name_en).length;
  const edited = Object.keys(useOverrides.getState().plotAttrs).length;

  const donut = (title: string, obj: Record<string, number>, colorOf: (k: string) => string, labelOf: (k: string) => string) => ({
    title: { text: title, left: 'center', textStyle: { color: txt, fontSize: 13, fontFamily: 'Readex Pro' } },
    tooltip: { trigger: 'item' },
    series: [{ type: 'pie', radius: ['42%', '68%'], center: ['50%', '56%'], avoidLabelOverlap: true,
      label: { show: false }, data: Object.keys(obj).sort((a, b) => obj[b] - obj[a]).map((k) => ({ value: obj[k], name: labelOf(k), itemStyle: { color: colorOf(k) } })) }],
  });

  return (
    <div className="dash">
      <div className="dash-kpis">
        <KpiCard v="958" l={t('a.plots', lang)} />
        <KpiCard v={String(Object.keys(stats.lu).length)} l={t('cp.uses', lang)} />
        <KpiCard v={(stats.gfa / 1e6).toFixed(1) + 'M'} l={t('kpi.gfa', lang)} />
        <KpiCard v={String(named)} l={t('a.named', lang)} />
        <KpiCard v={String(edited)} l={t('a.edited', lang)} />
      </div>
      <div className="dash-charts">
        <div className="chart-card"><Chart option={donut(t('a.byLandUse', lang), stats.lu, (k) => landUses[k]?.color ?? '#ccc', (k) => (lang === 'ar' ? landUses[k]?.labelAr ?? k : landUses[k]?.labelEn ?? k))} /></div>
        <div className="chart-card"><Chart option={donut(t('a.byStatus', lang), stats.st, (k) => STATUS_META[k]?.color ?? '#ccc', (k) => (lang === 'ar' ? STATUS_META[k]?.ar ?? k : STATUS_META[k]?.en ?? k))} /></div>
        <div className="chart-card"><Chart option={{
          title: { text: t('a.bySector', lang), left: 'center', textStyle: { color: txt, fontSize: 13, fontFamily: 'Readex Pro' } },
          tooltip: { trigger: 'axis' }, grid: { left: 40, right: 16, top: 44, bottom: 28 },
          xAxis: { type: 'category', data: Object.keys(stats.sec).map((k) => (lang === 'ar' ? SECTORS[k as keyof typeof SECTORS]?.labelAr ?? k : k)), axisLabel: { color: txt } },
          yAxis: { type: 'value', axisLabel: { color: txt } },
          series: [{ type: 'bar', data: Object.keys(stats.sec).map((k) => stats.sec[k]), itemStyle: { color: '#2F6B3E', borderRadius: [6, 6, 0, 0] } }],
        }} /></div>
      </div>
    </div>
  );
}
function KpiCard({ v, l }: { v: string; l: string }) { return (<div className="dash-kpi"><div className="v">{v}</div><div className="l">{l}</div></div>); }

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
      return { code: p.code, name, land_use: lang === 'ar' ? landUses[p.land_use as string]?.labelAr ?? p.land_use : landUses[p.land_use as string]?.labelEn ?? p.land_use, sector: p.sector, floors: p.floors ?? 0, area: p.area ?? 0, status: lang === 'ar' ? pr.status.ar : pr.status.en };
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
        <span className="hint">{t('a.rowsHint', lang)}</span>
      </div>
      <div className="table-scroll">
        <table className="admin-table">
          <thead><tr>{th('code', t('cp.plotsWord', lang))}{th('name', t('a.name', lang))}{th('land_use', t('a.landuse', lang))}{th('sector', t('a.sector', lang))}{th('floors', t('d.floors', lang))}{th('area', t('d.area', lang))}{th('status', t('a.status', lang))}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} onClick={() => onEdit(r.code)}>
                <td className="mono">{r.code}</td><td>{r.name}</td><td>{r.land_use}</td>
                <td>{lang === 'ar' ? SECTORS[r.sector]?.labelAr ?? r.sector : r.sector}</td>
                <td className="mono">{r.floors}</td><td className="mono">{Math.round(r.area).toLocaleString()}</td><td>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Development plan (only planned plots) ---------------- */
function DevPlanTab({ data, projects, onEdit }: { data: PlotCollection; projects: Record<string, ProjectInfo>; onEdit: (c: string) => void }) {
  const { lang } = useApp();
  const planned = useMemo(() => data.features.filter((f) => (projects[f.properties.code]?.phases?.length ?? 0) > 0), [data, projects]);
  const times = planned.flatMap((f) => (projects[f.properties.code].phases ?? []).filter((p) => p.start && p.end).flatMap((p) => [new Date(p.start!).getTime(), new Date(p.end!).getTime()]));
  const min = times.length ? Math.min(...times) : 0;
  const max = times.length ? Math.max(...times) : 1;
  const span = Math.max(1, max - min);

  if (!planned.length) return <div className="empty">{t('dp.onlyPlanned', lang)} — {t('dp.noPlan', lang)}</div>;
  return (
    <div className="devplan">
      <div className="dp-hint">{t('dp.onlyPlanned', lang)}</div>
      {planned.map((f) => {
        const code = f.properties.code;
        const pr = resolveProject(code, f.properties.land_use, projects);
        const name = pr.named ? (lang === 'ar' ? pr.overlay.name_ar || pr.overlay.name_en : pr.overlay.name_en || pr.overlay.name_ar) : code;
        return (
          <div className="dp-plot" key={code} onClick={() => onEdit(code)}>
            <div className="dp-plot-head"><b className="mono">{code}</b><span>{name}</span></div>
            <div className="dp-gantt">
              {(pr.overlay.phases ?? []).map((ph, i) => {
                const s = ph.start ? new Date(ph.start).getTime() : min;
                const e = ph.end ? new Date(ph.end).getTime() : s;
                const left = ((s - min) / span) * 100;
                const width = Math.max(3, ((e - s) / span) * 100);
                const st = STATUS_META[ph.status ?? 'Future'] ?? STATUS_META.Future;
                const nm = (lang === 'ar' ? ph.name_ar || ph.name_en : ph.name_en || ph.name_ar) || `${lang === 'ar' ? 'مرحلة' : 'Phase'} ${i + 1}`;
                return (
                  <div className="dp-track" key={i}>
                    <span className="dp-plabel">{nm}</span>
                    <div className="dp-line"><span className="dp-bar" style={{ insetInlineStart: `${left}%`, width: `${width}%`, background: st.color }} title={`${ph.start ?? ''} → ${ph.end ?? ''}`} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Land uses ---------------- */
function LandUsesTab({ landUses, data }: { landUses: Record<string, EffLandUse>; data: PlotCollection }) {
  const { lang } = useApp();
  const { setLandUse } = useOverrides();
  const counts = useMemo(() => { const c: Record<string, number> = {}; for (const f of data.features) c[f.properties.land_use ?? ''] = (c[f.properties.land_use ?? ''] || 0) + 1; return c; }, [data]);
  return (
    <div className="tab-lu">
      {Object.keys(landUses).sort((a, b) => (counts[b] || 0) - (counts[a] || 0)).map((k) => (
        <div className="lu-row" key={k}>
          <input type="color" value={landUses[k].color} onChange={(e) => setLandUse(k, { color: e.target.value })} />
          <input className="lu-name" value={lang === 'ar' ? landUses[k].labelAr : landUses[k].labelEn}
            onChange={(e) => setLandUse(k, lang === 'ar' ? { labelAr: e.target.value } : { labelEn: e.target.value })} />
          <span className="lu-key mono">{k}</span>
          <span className="lu-ct mono">{counts[k] || 0}</span>
        </div>
      ))}
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
                <td>{u.email !== SUPER_ADMIN_EMAIL && <button className="mini-btn danger" onClick={() => removeUser(u.id)}>{t('a.remove', lang)}</button>}</td>
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

/* ---------------- Audit ---------------- */
function AuditTab() {
  const { lang } = useApp();
  const { audit } = useOverrides();
  if (!audit.length) return <div className="empty">{t('a.noEdits', lang)}</div>;
  return (
    <div className="table-scroll">
      <table className="admin-table">
        <thead><tr><th>{t('a.time', lang)}</th><th>{t('a.action', lang)}</th><th>{t('a.target', lang)}</th><th>{t('a.detail', lang)}</th></tr></thead>
        <tbody>
          {audit.map((e, i) => (
            <tr key={i}><td className="mono">{new Date(e.at).toLocaleString()}</td><td>{e.action}</td><td className="mono">{e.target ?? '—'}</td><td className="dim">{e.detail}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Settings ---------------- */
function SettingsTab() {
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
  return (
    <div className="tab-settings">
      <div className="set-row"><span>اللغة / Language</span>
        <button className="btn" onClick={toggleLang}>{lang === 'ar' ? 'English' : 'العربية'}</button></div>
      <div className="set-row"><span>{t('a.export', lang)}</span><button className="btn primary" onClick={doExport}>⬇ {t('a.export', lang)}</button></div>
      <div className="set-row"><span>{t('a.import', lang)}</span><label className="btn">⬆ {t('a.import', lang)}<input type="file" accept="application/json" hidden onChange={doImport} /></label></div>
      <div className="set-row"><span>{t('a.reset', lang)}</span><button className="btn danger" onClick={() => { if (confirm(t('a.resetConfirm', lang))) reset(); }}>{t('a.reset', lang)}</button></div>
    </div>
  );
}
