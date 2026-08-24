import { PROGRESS_STAGES, type Lang } from '../lib/domain';

/** Horizontal stepper bar. Defaults to construction progress; pass `stages` for
 *  other pipelines (e.g. the regulatory permit lifecycle). */
export function StageBar({ lang, stageKey, stages = PROGRESS_STAGES, variant }: {
  lang: Lang; stageKey?: string; stages?: { key: string; ar: string; en: string }[]; variant?: 'license';
}) {
  const idx = stages.findIndex((s) => s.key === stageKey);
  return (
    <div className={`stagebar ${variant === 'license' ? 'stagebar-license' : ''}`}>
      {stages.map((s, i) => {
        const state = idx < 0 ? 'todo' : i < idx ? 'done' : i === idx ? 'current' : 'todo';
        return (
          <div className={`sb-step ${state}`} key={s.key}>
            <span className="sb-line" />
            <span className="sb-node">{state === 'done' ? '✓' : i + 1}</span>
            <span className="sb-label">{lang === 'ar' ? s.ar : s.en}</span>
          </div>
        );
      })}
    </div>
  );
}
