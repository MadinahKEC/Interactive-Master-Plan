import { useEffect, useMemo, useState } from 'react';
import { SECTORS, LAND_USES, type PlotCollection } from '@kec/types';
import { useApp } from '../store';
import { useOverrides, SUPER_ADMIN_EMAIL, DEFAULT_PLAN_STYLE } from '../lib/overrides';
import { createUserSecondary, watchAccessLog, type AccessSession } from '../lib/firebase';
import { STATUS_META, LICENSE_STAGES, PROGRESS_STAGES, resolveProject, t, type ProjectInfo } from '../lib/domain';
import { confirmDialog } from '../lib/dialog';
import type { EffLandUse } from '../lib/effective';
import { Chart } from './Chart';
import { PlotEditor } from './PlotEditor';
import { IconDashboard, IconPlots, IconPalette, IconUsers, IconAudit, IconSettings, IconClose, IconCalendar, IconUndo, IconExcel, IconClock, IconTrash } from '../components/icons';

type Tab = 'dashboard' | 'plots' | 'devplan' | 'landuses' | 'users' | 'access' | 'audit' | 'settings';
const TABS: { id: Tab; Icon: (p: { size?: number }) => JSX.Element }[] = [
  { id: 'dashboard', Icon: IconDashboard }, { id: 'plots', Icon: IconPlots }, { id: 'devplan', Icon: IconCalendar },
  { id: 'landuses', Icon: IconPalette }, { id: 'users', Icon: IconUsers }, { id: 'access', Icon: IconClock }, { id: 'audit', Icon: IconAudit }, { id: 'settings', Icon: IconSettings },
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
          {tab === 'access' && <AccessLogTab />}
          {tab === 'audit' && <AuditTab />}
          {tab === 'settings' && <SettingsTab data={data} projects={projects} />}
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
  const fmt = (x: number) => (x >= 1e6 ? (x / 1e6).toFixed(2) + 'M' : x >= 1e3 ? Math.round(x / 1e3) + 'K' : String(Math.round(x)));
  const stats = useMemo(() => {
    const luArea: Record<string, number> = {}; const st: Record<string, number> = {};
    const secGfa: Record<string, number> = {}; const lic: Record<string, number> = {};
    let gfa = 0, area = 0, farW = 0, developable = 0, planCount = 0, licensed = 0;
    for (const f of data.features) {
      const p = f.properties;
      luArea[p.land_use ?? '—'] = (luArea[p.land_use ?? '—'] || 0) + (p.area || 0);
      secGfa[p.sector] = (secGfa[p.sector] || 0) + (p.gfa || 0);
      const pr = resolveProject(p.code, p.land_use, projects);
      st[pr.status.key] = (st[pr.status.key] || 0) + 1;
      gfa += p.gfa || 0; area += p.area || 0;
      if (p.far) farW += (p.far || 0) * (p.area || 0);
      if ((p.far || 0) > 0) developable += p.area || 0;
      if ((p as any).planStatus) planCount++;
      const lk = pr.overlay.license; if (lk) { lic[lk] = (lic[lk] || 0) + 1; licensed++; }
    }
    return { luArea, st, secGfa, lic, gfa, area, avgFar: area ? farW / area : 0, developable, planCount, licensed, uses: Object.keys(luArea).length };
  }, [data, projects]);
  const named = Object.values(projects).filter((p) => p.name_ar || p.name_en).length;

  const donut = (title: string, obj: Record<string, number>, colorOf: (k: string) => string, labelOf: (k: string) => string, valFmt?: (v: number) => string) => ({
    title: { text: title, left: 'center', textStyle: { color: txt, fontSize: 13, fontFamily: 'Readex Pro' } },
    tooltip: { trigger: 'item', valueFormatter: (v: number) => (valFmt ? valFmt(v) : String(v)) },
    series: [{ type: 'pie', radius: ['42%', '68%'], center: ['50%', '56%'], avoidLabelOverlap: true,
      label: { show: false }, data: Object.keys(obj).filter((k) => obj[k] > 0).sort((a, b) => obj[b] - obj[a]).map((k) => ({ value: Math.round(obj[k]), name: labelOf(k), itemStyle: { color: colorOf(k) } })) }],
  });
  const bar = (title: string, keys: string[], vals: number[], color: string, labelOf: (k: string) => string, valFmt?: (v: number) => string) => ({
    title: { text: title, left: 'center', textStyle: { color: txt, fontSize: 13, fontFamily: 'Readex Pro' } },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => (valFmt ? valFmt(v) : String(v)) }, grid: { left: 48, right: 16, top: 44, bottom: 40 },
    xAxis: { type: 'category', data: keys.map(labelOf), axisLabel: { color: txt, interval: 0, rotate: keys.length > 4 ? 24 : 0, fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { color: txt, formatter: (v: number) => (v >= 1e6 ? v / 1e6 + 'M' : v >= 1e3 ? v / 1e3 + 'K' : v) } },
    series: [{ type: 'bar', data: vals.map((v) => Math.round(v)), itemStyle: { color, borderRadius: [6, 6, 0, 0] } }],
  });

  const secKeys = Object.keys(stats.secGfa).filter((k) => stats.secGfa[k] > 0);
  const licKeys = LICENSE_STAGES.map((x) => x.key).filter((k) => stats.lic[k]);

  return (
    <div className="dash">
      <div className="dash-kpis">
        <KpiCard v="958" l={t('a.plots', lang)} />
        <KpiCard v={fmt(stats.area)} l={`${t('kpi.area', lang)} (m²)`} />
        <KpiCard v={fmt(stats.gfa)} l={`${t('kpi.gfa', lang)} (m²)`} />
        <KpiCard v={fmt(stats.developable)} l={t('report.developable', lang)} />
        <KpiCard v={stats.avgFar.toFixed(2)} l={t('report.avgFar', lang)} />
        <KpiCard v={String(stats.planCount)} l={t('cp.planTitle', lang)} />
        <KpiCard v={String(named)} l={t('a.named', lang)} />
        <KpiCard v={String(stats.licensed)} l={t('sec.license', lang)} />
      </div>
      <div className="dash-charts">
        <div className="chart-card"><Chart option={donut(t('report.luMix', lang), stats.luArea, (k) => landUses[k]?.color ?? '#ccc', (k) => (lang === 'ar' ? landUses[k]?.labelAr ?? k : landUses[k]?.labelEn ?? k), (v) => fmt(v) + ' m²')} /></div>
        <div className="chart-card"><Chart option={donut(t('a.byStatus', lang), stats.st, (k) => STATUS_META[k]?.color ?? '#ccc', (k) => (lang === 'ar' ? STATUS_META[k]?.ar ?? k : STATUS_META[k]?.en ?? k))} /></div>
        <div className="chart-card"><Chart option={bar(t('dash.gfaSector', lang), secKeys, secKeys.map((k) => stats.secGfa[k]), '#2F6B3E', (k) => (lang === 'ar' ? SECTORS[k as keyof typeof SECTORS]?.labelAr ?? k : k), (v) => fmt(v) + ' m²')} /></div>
        {licKeys.length > 0
          ? <div className="chart-card"><Chart option={bar(t('dash.permits', lang), licKeys, licKeys.map((k) => stats.lic[k]), '#2E7D6B', (k) => (lang === 'ar' ? LICENSE_STAGES.find((x) => x.key === k)?.ar ?? k : LICENSE_STAGES.find((x) => x.key === k)?.en ?? k))} /></div>
          : <div className="chart-card dash-empty">{t('dash.noPermits', lang)}</div>}
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
      {Object.keys(landUses).sort((a, b) => (counts[b] || 0) - (counts[a] || 0)).map((k) => (
        <div className="lu-row" key={k}>
          <input type="color" value={landUses[k].color} onChange={(e) => setLandUse(k, { color: e.target.value })} />
          <input className="lu-name" value={lang === 'ar' ? landUses[k].labelAr : landUses[k].labelEn}
            onChange={(e) => setLandUse(k, lang === 'ar' ? { labelAr: e.target.value } : { labelEn: e.target.value })} />
          <span className="lu-key mono">{k}</span>
          <span className="lu-ct mono">{counts[k] || 0}</span>
          <button className="mini-btn danger" onClick={() => removeOne(k)}>{t('a.remove', lang)}</button>
        </div>
      ))}
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
function AuditTab() {
  const { lang } = useApp();
  const { audit, revertTo } = useOverrides();
  if (!audit.length) return <div className="empty">{t('a.noEdits', lang)}</div>;
  const doRevert = async (id: string) => {
    const ok = await confirmDialog({
      title: t('audit.revertTitle', lang), body: t('audit.revertBody', lang), icon: <IconUndo size={24} />,
      confirmLabel: t('audit.revert', lang), cancelLabel: t('a.cancel', lang), danger: true, dir: lang === 'ar' ? 'rtl' : 'ltr',
    });
    if (ok) revertTo(id);
  };
  return (
    <div className="table-scroll">
      <table className="admin-table">
        <thead><tr><th>{t('a.time', lang)}</th><th>{t('a.action', lang)}</th><th>{t('a.target', lang)}</th><th>{t('a.detail', lang)}</th><th></th></tr></thead>
        <tbody>
          {audit.map((e) => (
            <tr key={e.id}>
              <td className="mono">{new Date(e.at).toLocaleString()}</td>
              <td>{e.action}</td>
              <td className="mono">{e.target ?? '—'}</td>
              <td className="dim">{e.detail}</td>
              <td>{e.before && <button className="btn sm danger" onClick={() => doRevert(e.id)}><IconUndo size={13} /> {t('audit.revert', lang)}</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Settings ---------------- */
function SettingsTab({ data, projects }: { data: PlotCollection | null; projects: Record<string, ProjectInfo> }) {
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
      <div className="set-row"><span>اللغة / Language</span>
        <button className="btn" onClick={toggleLang}>{lang === 'ar' ? 'English' : 'العربية'}</button></div>
      <div className="set-row"><span>{t('a.excel', lang)}</span><button className="btn primary" onClick={doExcel}><IconExcel size={15} /> {t('a.excel', lang)} ({data?.features.length ?? 0})</button></div>
      <div className="set-row"><span>{t('a.export', lang)}</span><button className="btn" onClick={doExport}>⬇ {t('a.export', lang)}</button></div>
      <div className="set-row"><span>{t('a.import', lang)}</span><label className="btn">⬆ {t('a.import', lang)}<input type="file" accept="application/json" hidden onChange={doImport} /></label></div>
      <div className="set-row"><span>{t('a.reset', lang)}</span><button className="btn danger" onClick={async () => { if (await confirmDialog({ title: t('a.reset', lang), body: t('a.resetConfirm', lang), icon: <IconTrash size={24} />, confirmLabel: t('a.reset', lang), cancelLabel: t('a.cancel', lang), danger: true, dir: lang === 'ar' ? 'rtl' : 'ltr' })) reset(); }}>{t('a.reset', lang)}</button></div>
    </div>
  );
}
