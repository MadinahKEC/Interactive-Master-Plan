import { type ReactNode } from 'react';
import { useApp } from '../store';
import { useOverrides } from '../lib/overrides';
import { t } from '../lib/domain';
import { IconText, IconArrow, IconRect, IconTrash } from './icons';

const COLORS = ['#B5462F', '#9A8A1E', '#2F6B3E', '#2E7D6B', '#1C6034', '#16221B'];

export function AnnotateToolbar() {
  const { lang, annotateMode, annotateColor, setAnnotateMode, setAnnotateColor } = useApp();
  const clearAnnotations = useOverrides((s) => s.clearAnnotations);
  if (annotateMode === 'off') return null;

  const tool = (m: 'text' | 'arrow' | 'rect', label: string, icon: ReactNode) => (
    <button className={`an-tool ${annotateMode === m ? 'on' : ''}`} onClick={() => setAnnotateMode(m)}>{icon}<span>{label}</span></button>
  );

  return (
    <div className="annot-bar">
      <div className="an-tools">
        {tool('text', t('an.text', lang), <IconText size={16} />)}
        {tool('arrow', t('an.arrow', lang), <IconArrow size={16} />)}
        {tool('rect', t('an.rect', lang), <IconRect size={16} />)}
      </div>
      <div className="an-colors">
        {COLORS.map((c) => (
          <button key={c} className={`an-swatch ${annotateColor === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setAnnotateColor(c)} aria-label={c} />
        ))}
      </div>
      <div className="an-hint">{t('an.hint', lang)}</div>
      <div className="an-actions">
        <button className="btn sm danger" onClick={() => clearAnnotations()}><IconTrash size={13} /> {t('an.clear', lang)}</button>
        <button className="btn sm primary" onClick={() => setAnnotateMode('off')}>{t('an.done', lang)}</button>
      </div>
    </div>
  );
}
