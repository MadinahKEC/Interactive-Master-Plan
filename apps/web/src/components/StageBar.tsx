import { PROGRESS_STAGES, type Lang } from '../lib/domain';

/** Horizontal construction-progress bar (Concrete → … → Completed). */
export function StageBar({ lang, stageKey }: { lang: Lang; stageKey?: string }) {
  const idx = PROGRESS_STAGES.findIndex((s) => s.key === stageKey);
  return (
    <div className="stagebar">
      {PROGRESS_STAGES.map((s, i) => {
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
