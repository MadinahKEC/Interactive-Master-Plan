import { useMemo, useState, type ReactNode } from 'react';
import { SECTORS, type PlotCollection } from '@kec/types';
import { PROJECT_TYPES, STATUS_META, OWNERSHIP_META, STANDARD_PHASES, PROGRESS_STAGES, LICENSE_STAGES, resolveProject, inferType, t, type ProjectInfo, type Phase } from '../lib/domain';
import { useApp } from '../store';
import { useOverrides } from '../lib/overrides';
import { uploadPlotImage } from '../lib/firebase';
import { DateField } from '../components/DateField';
import { EditableSelect } from '../components/EditableSelect';
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
    stage: overlay.stage ?? '',
    license: overlay.license ?? '',
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

  const [gallery, setGallery] = useState<string[]>(overlay.gallery ?? []);
  const [uploading, setUploading] = useState(false);
  const [imgErr, setImgErr] = useState('');
  const onFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true); setImgErr('');
    try {
      for (const file of Array.from(files)) {
        const url = await uploadPlotImage(code, file);
        setGallery((g) => [...g, url]);
      }
    } catch (e: any) {
      setImgErr(e?.code === 'storage/unauthorized' || e?.code === 'storage/unknown'
        ? (lang === 'ar' ? 'فعّل Firebase Storage وقواعده' : 'Enable Firebase Storage + rules')
        : (lang === 'ar' ? 'تعذّر رفع الصورة' : 'Upload failed'));
    } finally { setUploading(false); }
  };
  const removeImg = (i: number) => setGallery((g) => g.filter((_, j) => j !== i));

  const save = () => {
    setProject(code, {
      name_ar: f.name_ar || undefined, name_en: f.name_en || undefined,
      type: f.type, status: f.status, progress: Number(f.progress),
      summary_ar: f.summary_ar || undefined, summary_en: f.summary_en || undefined,
      stage: f.stage || undefined,
      license: f.license || undefined,
      gallery: gallery.length ? gallery : undefined,
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
            <Field label={t('d.purchase', lang)} full><DateField value={f.purchase_date} onChange={(v) => up('purchase_date', v)} /></Field>
          </div>

          <div className="ed-sec">{t('a.projectInfo', lang)}</div>
          <div className="ed-grid">
            <Field label={t('a.nameAr', lang)}><input value={f.name_ar} onChange={(e) => up('name_ar', e.target.value)} /></Field>
            <Field label={t('a.nameEn', lang)}><input value={f.name_en} onChange={(e) => up('name_en', e.target.value)} /></Field>
            <Field label={t('a.type', lang)}>
              <EditableSelect listKey="project_type" value={f.type} onChange={(v) => up('type', v)}
                options={Object.values(PROJECT_TYPES).map((x) => ({ value: x.key, label: lang === 'ar' ? x.ar : x.en }))} />
            </Field>
            <Field label={t('a.status', lang)}>
              <EditableSelect listKey="status" value={f.status} onChange={(v) => up('status', v)}
                options={Object.values(STATUS_META).map((x) => ({ value: x.key, label: lang === 'ar' ? x.ar : x.en }))} />
            </Field>
            <Field label={t('a.stage', lang)}>
              <EditableSelect listKey="stage" value={f.stage} onChange={(v) => up('stage', v)} allowNone noneLabel={t('a.stageNone', lang)}
                options={PROGRESS_STAGES.map((x) => ({ value: x.key, label: lang === 'ar' ? x.ar : x.en }))} />
            </Field>
            <Field label={t('sec.license', lang)}>
              <EditableSelect listKey="license" value={f.license} onChange={(v) => up('license', v)} allowNone noneLabel={t('a.stageNone', lang)}
                options={LICENSE_STAGES.map((x) => ({ value: x.key, label: lang === 'ar' ? x.ar : x.en }))} />
            </Field>
            <Field label={t('a.summaryAr', lang)} full><textarea rows={2} value={f.summary_ar} onChange={(e) => up('summary_ar', e.target.value)} /></Field>
            <Field label={t('a.summaryEn', lang)} full><textarea rows={2} value={f.summary_en} onChange={(e) => up('summary_en', e.target.value)} /></Field>
            <Field label={t('a.images', lang)} full>
              <div className="img-upload">
                <div className="img-thumbs">
                  {gallery.map((src, i) => (
                    <div className="img-thumb" key={i}><img src={src} alt="" /><button type="button" onClick={() => removeImg(i)}>×</button></div>
                  ))}
                  <label className="img-add">{uploading ? '…' : '＋'}<input type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} /></label>
                </div>
                {imgErr && <span className="img-err">{imgErr}</span>}
              </div>
            </Field>
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
                <DateField value={ph.start ?? ''} onChange={(v) => setPhase(i, { start: v })} title={t('dp.start', lang)} />
                <DateField value={ph.end ?? ''} onChange={(v) => setPhase(i, { end: v })} title={t('dp.end', lang)} />
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
              <EditableSelect listKey="land_use" value={f.land_use} onChange={(v) => up('land_use', v)}
                options={Object.keys(landUses).map((k) => ({ value: k, label: lang === 'ar' ? landUses[k].labelAr : landUses[k].labelEn }))} />
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
