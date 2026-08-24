import type { PlotCollection } from '@kec/types';
import { useApp } from '../store';
import { useShortlist } from '../lib/shortlist';
import { resolveProject, t, type ProjectInfo } from '../lib/domain';
import type { EffLandUse } from '../lib/effective';
import { CompareModal } from './CompareModal';
import { IconStar, IconCompare, IconClose, IconTrash } from './icons';

/** Floating shortlist tray + entry point to the side-by-side comparison. */
export function ShortlistBar({ data, projects, landUses }: {
  data: PlotCollection; projects: Record<string, ProjectInfo>; landUses: Record<string, EffLandUse>;
}) {
  const { lang, select, requestZoom } = useApp();
  const { codes, toggle, clear, compareOpen, setCompareOpen } = useShortlist();
  if (!codes.length) return null;

  const chips = codes.map((c) => {
    const p = data.features.find((f) => f.properties.code === c)?.properties;
    const pr = p ? resolveProject(c, p.land_use, projects) : null;
    const name = pr?.named ? (lang === 'ar' ? pr.overlay.name_ar || pr.overlay.name_en : pr.overlay.name_en || pr.overlay.name_ar) : c;
    return { code: c, name: name || c, ok: !!p, props: p };
  });

  return (
    <>
      <div className="sl-bar" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="sl-title"><IconStar size={15} /> {t('sl.title', lang)} <span className="sl-count">{codes.length}</span></div>
        <div className="sl-chips">
          {chips.map((c) => (
            <span className="sl-chip" key={c.code} title={c.name}>
              <button className="sl-chip-name" onClick={() => { if (c.props) { select(c.props); requestZoom(c.code); } }}>{c.name}</button>
              <button className="sl-chip-x" onClick={() => toggle(c.code)} aria-label="remove">×</button>
            </span>
          ))}
        </div>
        <div className="sl-actions">
          <button className="btn sm primary" disabled={codes.length < 2} onClick={() => setCompareOpen(true)}><IconCompare size={14} /> {t('sl.compare', lang)}</button>
          <button className="btn sm" onClick={clear} title={t('sl.clear', lang)}><IconTrash size={13} /></button>
          <button className="sl-close" onClick={clear} aria-label="close"><IconClose size={15} /></button>
        </div>
      </div>
      {compareOpen && <CompareModal codes={codes} data={data} projects={projects} landUses={landUses} onClose={() => setCompareOpen(false)} />}
    </>
  );
}
