import { useMemo, useState, type ReactNode } from 'react';
import { SECTORS, type PlotCollection } from '@kec/types';
import { PROJECT_TYPES, STATUS_META, OWNERSHIP_META, STANDARD_PHASES, resolveProject, inferType, t, type ProjectInfo, type Phase } from '../lib/domain';
import { useApp } from '../store';
import { useOverrides } from '../lib/overrides';
import { IconPlus, IconTrash } from '../components/icons';
import type { EffLandUse } from '../lib/effective';

/** Slide-over editor: project info + plot attributes. Persists to the overrides store. */
export function PlotEditor({
  code, data, projects, landUses, onClose,
}: {
  code: string; data: PlotCollection; projects: Record<string, ProjectInfo>;
  landUses: Record<string, EffLandUse>; onClose: () => void;
}) {
  const { lang } = useApp();
  const { setProject, setPlotAttr } = useOverrides();
  const feature = useMemo(() => data.features.find((f) => f.properties.code === code), [data, code]);
  const p = feature?.properties;
  const overlay = projects[code] ?? {};
  const pr = resolveProject(code, p?.land_use ?? null, projects);

  const [f, setF] = useState({
    name_ar: overlay.name_ar ?? '',
    name_en: overlay.name_en ?? '',
    type: overlay.type ?? inferType(p?.land_use).key,
    status: overlay.status ?? pr.status.key,
    progress: overlay.progress ?? pr.progress,
    summary_ar: overlay.summary_ar ?? '',
    summary_en: overlay.summary_en ?? '',
    gallery: (overlay.gallery ?? []).join(', '),
    owner: overlay.owner ?? '',
    ownership: overlay.ownership ?? pr.ownership.key,
    purchase_date: overlay.purchase_date ?? '',
    land_use: p?.land_use ?? '',
    sector: p?.sector ?? 'Other',
    floors: p?.floors ?? '',
    height: p?.height ?? '',
    area: p?.area ?? '',
    gfa: p?.gfa ?? '',
    coverage: p?.coverage ?? '',
    far: p?.far ?? '',
  });
  const up = (k: keyof typeof f, v: any) => setF((s) => ({ ...s, [k]: v }));
  const numOrNull = (v: any) => (v === '' || v === null ? null : Number(v));
  const [phases, setPhases] = useState<Phase[]>(overlay.phases ?? []);
  const setPhase = (i: number, patch: Partial<Phase>) => setPhases((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const addPhase = () => setPhases((ps) => [...ps, { name_ar: '', start: '', end: '', status: 'Future' }]);
  const removePhase = (i: number) => setPhases((ps) => ps.filter((_, j) => j !== i));

  const save = () => {
    setProject(code, {
      name_ar: f.name_ar || undefined, name_en: f.name_en || undefined,
      type: f.type, status: f.status, progress: Number(f.progress),
      summary_ar: f.summary_ar || undefined, summary_en: f.summary_en || undefined,
      gallery: f.gallery.trim() ? f.gallery.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      owner: f.owner || undefined, ownership: f.ownership, purchase_date: f.purchase_date || undefined,
      phases: phases.length ? phases : undefined,
    });
    setPlotAttr(code, {
      land_use: f.land_use || null, sector: f.sector,
      floors: numOrNull(f.floors), height: numOrNull(f.height),
      area: numOrNull(f.area), gfa: numOrNull(f.gfa),
      coverage: numOrNull(f.coverage), far: numOrNull(f.far),
    });
    onClose();
  };

  if (!p) return null;
  return (
    <div className="editor-wrap" onClick={onClose}>
      <div className="editor" onClick={(e) => e.stopPropagation()}>
        <div className="editor-head">
          <div><span className="mono ecode">{code}</span></div>
          <button className="ic-btn" onClick={onClose}>×</button>
        </div>
        <div className="editor-body">
          <div className="ed-sec">{t('a.ownership', lang)}</div>
          <div className="ed-grid">
            <Field label={t('a.owner', lang)}><input value={f.owner} onChange={(e) => up('owner', e.target.value)} /></Field>
            <Field label={t('d.ownership', lang)}>
              <select value={f.ownership} onChange={(e) => up('ownership', e.target.value)}>
                {Object.values(OWNERSHIP_META).map((x) => <option key={x.key} value={x.key}>{lang === 'ar' ? x.ar : x.en}</option>)}
              </select>
            </Field>
            <Field label={t('d.purchase', lang)} full><input type="date" value={f.purchase_date} onChange={(e) => up('purchase_date', e.target.value)} /></Field>
          </div>

          <div className="ed-sec">{t('a.projectInfo', lang)}</div>
          <div className="ed-grid">
            <Field label={t('a.nameAr', lang)}><input value={f.name_ar} onChange={(e) => up('name_ar', e.target.value)} /></Field>
            <Field label={t('a.nameEn', lang)}><input value={f.name_en} onChange={(e) => up('name_en', e.target.value)} /></Field>
            <Field label={t('a.type', lang)}>
              <select value={f.type} onChange={(e) => up('type', e.target.value)}>
                {Object.values(PROJECT_TYPES).map((x) => <option key={x.key} value={x.key}>{lang === 'ar' ? x.ar : x.en}</option>)}
              </select>
            </Field>
            <Field label={t('a.status', lang)}>
              <select value={f.status} onChange={(e) => up('status', e.target.value)}>
                {Object.values(STATUS_META).map((x) => <option key={x.key} value={x.key}>{lang === 'ar' ? x.ar : x.en}</option>)}
              </select>
            </Field>
            <Field label={`${t('a.progress', lang)} — ${f.progress}%`} full>
              <input type="range" min={0} max={100} value={f.progress} onChange={(e) => up('progress', Number(e.target.value))} />
            </Field>
            <Field label={t('a.summaryAr', lang)} full><textarea rows={2} value={f.summary_ar} onChange={(e) => up('summary_ar', e.target.value)} /></Field>
            <Field label={t('a.summaryEn', lang)} full><textarea rows={2} value={f.summary_en} onChange={(e) => up('summary_en', e.target.value)} /></Field>
            <Field label={t('a.gallery', lang)} full><input value={f.gallery} onChange={(e) => up('gallery', e.target.value)} placeholder="https://…, https://…" /></Field>
          </div>

          <div className="ed-sec ed-sec-row">{t('sec.devplan', lang)}
            <button className="mini-btn" onClick={addPhase}><IconPlus size={13} /> {t('dp.addPhase', lang)}</button>
          </div>
          <div className="phases-edit">
            {phases.length === 0 && <div className="ph-empty">{t('dp.noPlan', lang)}</div>}
            {phases.map((ph, i) => (
              <div className="ph-row" key={i}>
                <select className="ph-name" value={STANDARD_PHASES.find((sp) => sp.en === ph.name_en || sp.ar === ph.name_ar)?.key ?? ''}
                  onChange={(e) => { const sp = STANDARD_PHASES.find((x) => x.key === e.target.value); if (sp) setPhase(i, { name_ar: sp.ar, name_en: sp.en }); }}>
                  <option value="">{t('dp.phaseName', lang)}…</option>
                  {STANDARD_PHASES.map((sp) => <option key={sp.key} value={sp.key}>{lang === 'ar' ? sp.ar : sp.en}</option>)}
                </select>
                <input type="date" value={ph.start ?? ''} onChange={(e) => setPhase(i, { start: e.target.value })} title={t('dp.start', lang)} />
                <input type="date" value={ph.end ?? ''} onChange={(e) => setPhase(i, { end: e.target.value })} title={t('dp.end', lang)} />
                <select value={ph.status ?? 'Future'} onChange={(e) => setPhase(i, { status: e.target.value })}>
                  {Object.values(STATUS_META).map((x) => <option key={x.key} value={x.key}>{lang === 'ar' ? x.ar : x.en}</option>)}
                </select>
                <button className="mini-btn danger" onClick={() => removePhase(i)}><IconTrash size={13} /></button>
              </div>
            ))}
          </div>

          <div className="ed-sec">{t('a.plotAttrs', lang)}</div>
          <div className="ed-grid">
            <Field label={t('a.landuse', lang)}>
              <select value={f.land_use} onChange={(e) => up('land_use', e.target.value)}>
                {Object.keys(landUses).map((k) => <option key={k} value={k}>{lang === 'ar' ? landUses[k].labelAr : landUses[k].labelEn}</option>)}
              </select>
            </Field>
            <Field label={t('a.sector', lang)}>
              <select value={f.sector} onChange={(e) => up('sector', e.target.value)}>
                {Object.values(SECTORS).map((s) => <option key={s.key} value={s.key}>{lang === 'ar' ? s.labelAr : s.key}</option>)}
              </select>
            </Field>
            <Field label={t('d.floors', lang)}><input type="number" value={f.floors} onChange={(e) => up('floors', e.target.value)} /></Field>
            <Field label={t('d.height', lang)}><input type="number" value={f.height} onChange={(e) => up('height', e.target.value)} /></Field>
            <Field label={t('d.area', lang)}><input type="number" value={f.area} onChange={(e) => up('area', e.target.value)} /></Field>
            <Field label={t('d.gfa', lang)}><input type="number" value={f.gfa} onChange={(e) => up('gfa', e.target.value)} /></Field>
            <Field label={t('d.coverage', lang)}><input type="number" step="0.01" value={f.coverage} onChange={(e) => up('coverage', e.target.value)} /></Field>
            <Field label={t('d.far', lang)}><input type="number" step="0.01" value={f.far} onChange={(e) => up('far', e.target.value)} /></Field>
          </div>
        </div>
        <div className="editor-foot">
          <button className="btn" onClick={onClose}>{t('a.cancel', lang)}</button>
          <button className="btn primary" onClick={save}>{t('a.save', lang)}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (<label className={`field ${full ? 'full' : ''}`}><span>{label}</span>{children}</label>);
}
