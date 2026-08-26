import { useMemo, useState, type ReactNode } from 'react';
import { SECTORS, type PlotCollection } from '@kec/types';
import { PROJECT_TYPES, STATUS_META, OWNERSHIP_META, STANDARD_PHASES, PHASE_STATUSES, PROGRESS_STAGES, LICENSE_STAGES, INVEST_FIELDS, resolveProject, inferType, t, type ProjectInfo, type Phase, type InvestmentInfo } from '../lib/domain';
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
  const { setProject, setPlotAttr, setLandUse } = useOverrides();
  const hiddenCards = useOverrides((s) => s.hiddenCards);
  const toggleHiddenCard = useOverrides((s) => s.toggleHiddenCard);
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
  const [inv, setInv] = useState<InvestmentInfo>(overlay.investment ?? {});
  const setInvField = (k: keyof InvestmentInfo, v: string) => setInv((s) => ({ ...s, [k]: v === '' ? undefined : Number(v) }));
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
      investment: Object.values(inv).some((v) => v != null) ? inv : undefined,
    });
    setPlotAttr(code, {
      land_use: f.land_use || null, sector: f.sector,
      floors: numOrNull(f.floors), height: numOrNull(f.height),
      area: numOrNull(f.area), gfa: numOrNull(f.gfa),
      coverage: numOrNull(f.coverage), far: numOrNull(f.far),
    });
    onClose();
  };

  // Which detail-card sections & fields are visible to viewers (display-only removal).
  const sectionItems = [
    { k: 's:ownership', label: t('sec.ownership', lang) }, { k: 's:investors', label: t('sec.investors', lang) }, { k: 's:summary', label: t('sec.summary', lang) },
    { k: 's:gallery', label: t('sec.gallery', lang) }, { k: 's:land', label: t('sec.land', lang) },
    { k: 's:analysis', label: t('sec.analysis', lang) }, { k: 's:devplan', label: t('sec.devplan', lang) },
    { k: 's:invest', label: t('sec.invest', lang) }, { k: 's:project', label: t('sec.project', lang) },
    { k: 's:comments', label: t('sec.comments', lang) },
  ];
  const landItems = [
    { k: 'f:landuse', label: t('d.landuse', lang) }, { k: 'f:sector', label: t('d.sector', lang) },
    { k: 'f:area', label: t('d.area', lang) }, { k: 'f:gfa', label: t('d.gfa', lang) },
    { k: 'f:floors', label: t('d.floors', lang) }, { k: 'f:height', label: t('d.height', lang) },
    { k: 'f:coverage', label: t('d.coverage', lang) }, { k: 'f:far', label: t('d.far', lang) },
  ];
  const invItems = INVEST_FIELDS.map((fld) => ({ k: `f:inv:${fld.key}`, label: lang === 'ar' ? fld.ar : fld.en }));

  if (!p) return null;
  return (
    <div className="editor-wrap" onClick={onClose}>
      <div className="editor" onClick={(e) => e.stopPropagation()}>
        <div className="editor-head">
          <div><span className="mono ecode">{code}</span></div>
          <button className="ic-btn" onClick={onClose}>×</button>
        </div>
        <div className="editor-body">
          {/* Ownership — first, matching the card */}
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

          {/* Overview — matches the card's Summary + Gallery */}
          <div className="ed-sec">{t('a.projectInfo', lang)}</div>
          <div className="ed-grid">
            <Field label={t('a.nameAr', lang)}><input value={f.name_ar} onChange={(e) => up('name_ar', e.target.value)} /></Field>
            <Field label={t('a.nameEn', lang)}><input value={f.name_en} onChange={(e) => up('name_en', e.target.value)} /></Field>
            <Field label={t('a.type', lang)} full>
              <EditableSelect listKey="project_type" value={f.type} onChange={(v) => up('type', v)}
                options={Object.values(PROJECT_TYPES).map((x) => ({ value: x.key, label: lang === 'ar' ? x.ar : x.en }))} />
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

          {/* Land data */}
          <div className="ed-sec">{t('a.plotAttrs', lang)}</div>
          <div className="ed-grid">
            <Field label={t('a.landuse', lang)}>
              <EditableSelect listKey="land_use" value={f.land_use} onChange={(v) => up('land_use', v)}
                options={Object.keys(landUses).map((k) => ({ value: k, label: lang === 'ar' ? landUses[k].labelAr : landUses[k].labelEn }))}
                addColor onCreate={(val, ar, en, extra) => setLandUse(val, { labelAr: ar || val, labelEn: en || val, color: extra.color || '#2F6B3E' })} />
            </Field>
            <Field label={t('a.sector', lang)}>
              <select value={f.sector} onChange={(e) => up('sector', e.target.value)}>
                {Object.values(SECTORS).map((s) => <option key={s.key} value={s.key}>{lang === 'ar' ? s.labelAr : s.key}</option>)}
              </select>
            </Field>
            <Field label={t('d.floors', lang)}><NumberField value={f.floors} onChange={(v) => up('floors', v)} /></Field>
            <Field label={t('d.height', lang)}><NumberField value={f.height} onChange={(v) => up('height', v)} /></Field>
            <Field label={t('d.area', lang)}><NumberField value={f.area} onChange={(v) => up('area', v)} /></Field>
            <Field label={t('d.gfa', lang)}><NumberField value={f.gfa} onChange={(v) => up('gfa', v)} /></Field>
            <Field label={t('d.coverage', lang)}><NumberField value={f.coverage} onChange={(v) => up('coverage', v)} /></Field>
            <Field label={t('d.far', lang)}><NumberField value={f.far} onChange={(v) => up('far', v)} /></Field>
          </div>

          {/* Development plan */}
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
                  {PHASE_STATUSES.map((x) => <option key={x.key} value={x.key}>{lang === 'ar' ? x.ar : x.en}</option>)}
                </select>
                <button className="mini-btn danger" onClick={() => removePhase(i)}><IconTrash size={13} /></button>
              </div>
            ))}
          </div>

          {/* Investment highlights */}
          <div className="ed-sec">{t('a.invest', lang)}</div>
          <div className="ed-grid">
            {INVEST_FIELDS.map((fld) => (
              <Field key={fld.key} label={lang === 'ar' ? fld.ar : fld.en}>
                <NumberField value={inv[fld.key] ?? ''} onChange={(v) => setInvField(fld.key, v)} />
              </Field>
            ))}
          </div>

          {/* Status & permits */}
          <div className="ed-sec">{t('sec.project', lang)}</div>
          <div className="ed-grid">
            <Field label={t('a.status', lang)}>
              <EditableSelect listKey="status" value={f.status} onChange={(v) => up('status', v)}
                options={Object.values(STATUS_META).map((x) => ({ value: x.key, label: lang === 'ar' ? x.ar : x.en }))} />
            </Field>
            <Field label={t('a.stage', lang)}>
              <EditableSelect listKey="stage" value={f.stage} onChange={(v) => up('stage', v)} allowNone noneLabel={t('a.stageNone', lang)}
                options={PROGRESS_STAGES.map((x) => ({ value: x.key, label: lang === 'ar' ? x.ar : x.en }))} />
            </Field>
            <Field label={t('sec.license', lang)} full>
              <EditableSelect listKey="license" value={f.license} onChange={(v) => up('license', v)} allowNone noneLabel={t('a.stageNone', lang)}
                options={LICENSE_STAGES.map((x) => ({ value: x.key, label: lang === 'ar' ? x.ar : x.en }))} />
            </Field>
          </div>

          {/* Show / hide plot card fields & sections (display-only, for all viewers) */}
          <div className="ed-sec">{t('a.cardLayout', lang)}</div>
          <p className="vis-hint">{t('a.cardLayoutHint', lang)}</p>
          <div className="vis-grouplabel">{t('a.grpSections', lang)}</div>
          <div className="vis-grid">
            {sectionItems.map((it) => <VisChip key={it.k} label={it.label} on={!hiddenCards.includes(it.k)} onToggle={() => toggleHiddenCard(it.k)} />)}
          </div>
          <div className="vis-grouplabel">{t('a.grpLandFields', lang)}</div>
          <div className="vis-grid">
            {landItems.map((it) => <VisChip key={it.k} label={it.label} on={!hiddenCards.includes(it.k)} onToggle={() => toggleHiddenCard(it.k)} />)}
          </div>
          <div className="vis-grouplabel">{t('a.grpInvFields', lang)}</div>
          <div className="vis-grid">
            {invItems.map((it) => <VisChip key={it.k} label={it.label} on={!hiddenCards.includes(it.k)} onToggle={() => toggleHiddenCard(it.k)} />)}
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

/** A toggle chip: green = shown on the card, muted/struck = hidden from viewers. */
function VisChip({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={`vis-chip ${on ? 'on' : 'off'}`} onClick={onToggle}>
      <span className="vis-mark">{on ? '✓' : '✕'}</span>{label}
    </button>
  );
}

/** Show the raw number with thousands separators as the user types (stores a clean string). */
function fmtNum(raw: string): string {
  if (raw === '' || raw === '-' || raw === '.') return raw;
  const neg = raw.startsWith('-');
  const s = neg ? raw.slice(1) : raw;
  const dot = s.indexOf('.');
  const intPart = dot >= 0 ? s.slice(0, dot) : s;
  const decPart = dot >= 0 ? s.slice(dot + 1) : null;
  const intF = intPart === '' ? '' : Number(intPart).toLocaleString('en-US');
  const body = decPart !== null ? `${intF === '' ? '0' : intF}.${decPart}` : intF;
  return (neg ? '-' : '') + body;
}
function NumberField({ value, onChange }: { value: string | number | ''; onChange: (raw: string) => void }) {
  const raw = value === '' || value == null ? '' : String(value);
  const onIn = (e: { target: { value: string } }) => {
    let s = e.target.value.replace(/,/g, '').replace(/[^0-9.\-]/g, '');
    s = s.replace(/(?!^)-/g, '');           // only a leading minus
    const i = s.indexOf('.');
    if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, ''); // only one dot
    onChange(s);
  };
  return <input type="text" inputMode="decimal" value={fmtNum(raw)} onChange={onIn} />;
}
