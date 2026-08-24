import { PROGRESS_STAGES, t, type Lang } from '../lib/domain';

/**
 * Progress visual. The default is a horizontal stepper (construction stages).
 * `variant='license'` renders a distinct vertical **permit ledger** — a stamped
 * checklist that reads like an official document, so it never mirrors the stepper
 * above it.
 */
export function StageBar({ lang, stageKey, stages = PROGRESS_STAGES, variant }: {
  lang: Lang; stageKey?: string; stages?: { key: string; ar: string; en: string }[]; variant?: 'license';
}) {
  const idx = stages.findIndex((s) => s.key === stageKey);

  if (variant === 'license') {
    return (
      <div className="permledger">
        {stages.map((s, i) => {
          const state = idx < 0 ? 'todo' : i < idx ? 'done' : i === idx ? 'current' : 'todo';
          const tag = state === 'done' ? t('perm.issued', lang) : state === 'current' ? t('perm.current', lang) : t('perm.pending', lang);
          return (
            <div className={`pl-row ${state}`} key={s.key}>
              <span className="pl-seal">{state === 'done' ? '✓' : state === 'current' ? '◔' : i + 1}</span>
              <span className="pl-name">{lang === 'ar' ? s.ar : s.en}</span>
              <span className="pl-tag">{tag}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="stagebar">
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
