import { useEffect, useMemo, useRef, useState } from 'react';
import { STAGES, t, type Lang, type ProjectType, type StatusMeta } from '../lib/domain';
import { TypeIcon } from './icons';

/**
 * Elegant auto-advancing carousel showing project progress. If real photos exist
 * (`gallery`), it cycles them; otherwise it renders four branded stage scenes and
 * highlights the current construction stage from the progress %.
 */
export function ProgressGallery({
  lang, type, status, progress, gallery,
}: {
  lang: Lang; type: ProjectType; status: StatusMeta; progress: number; gallery?: string[];
}) {
  const usingPhotos = Boolean(gallery && gallery.length);
  const slides = useMemo(
    () => (usingPhotos ? gallery!.map((src, i) => ({ src, i })) : STAGES.map((s, i) => ({ stage: s, i }))),
    [usingPhotos, gallery],
  );
  const [idx, setIdx] = useState(0);
  const paused = useRef(false);
  const currentStage = Math.min(3, Math.floor(progress / 25.0001));

  useEffect(() => {
    setIdx(0);
  }, [type.key, status.key, progress]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!paused.current) setIdx((i) => (i + 1) % slides.length);
    }, 3400);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="gallery" onMouseEnter={() => (paused.current = true)} onMouseLeave={() => (paused.current = false)}>
      <div className="g-stage-caption">{t('d.gallery', lang)}</div>
      <div className="g-frame">
        {slides.map((s, i) => {
          const active = i === idx;
          if (usingPhotos && 'src' in s) {
            return (
              <div key={i} className={`g-slide ${active ? 'on' : ''}`} style={{ backgroundImage: `url(${s.src})` }} />
            );
          }
          const stageKey = (s as { stage: (typeof STAGES)[number] }).stage;
          const state = i < currentStage ? 'done' : i === currentStage ? 'current' : 'upcoming';
          return (
            <div key={i} className={`g-slide scene ${state} ${active ? 'on' : ''}`}>
              <div className="g-icon"><TypeIcon typeKey={type.key} size={38} /></div>
              <div className="g-stage-name">{t(stageKey, lang)}</div>
              <div className={`g-stage-badge ${state}`}>
                {state === 'done' ? (lang === 'ar' ? 'منجز' : 'Done')
                  : state === 'current' ? (lang === 'ar' ? 'قيد التنفيذ' : 'In progress')
                  : (lang === 'ar' ? 'قادم' : 'Upcoming')}
              </div>
            </div>
          );
        })}
        <div className="g-progress"><span style={{ width: `${Math.max(2, progress)}%`, background: status.color }} /></div>
        <div className="g-pct mono">{progress}%</div>
      </div>
      <div className="g-dots">
        {slides.map((_, i) => (
          <button key={i} className={i === idx ? 'on' : ''} onClick={() => setIdx(i)} aria-label={`slide ${i + 1}`} />
        ))}
      </div>
    </div>
  );
}
