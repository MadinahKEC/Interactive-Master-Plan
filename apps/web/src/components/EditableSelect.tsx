import { useApp } from '../store';
import { useOverrides } from '../lib/overrides';
import { useDialog } from '../lib/dialog';
import { t } from '../lib/domain';

/**
 * A <select> whose choices admins can extend on the fly. Extra options are stored
 * per `listKey` in the overrides store, so they persist and reappear next session.
 * Picking "➕ add" opens a themed dialog for the Arabic/English label.
 */
export function EditableSelect({ listKey, value, onChange, options, allowNone, noneLabel, addColor, onCreate }: {
  listKey: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allowNone?: boolean;
  noneLabel?: string;
  /** Also ask for a colour when adding (e.g. land uses). */
  addColor?: boolean;
  /** Persist a brand-new item to its own store (instead of the generic option list). */
  onCreate?: (val: string, ar: string, en: string, extra: Record<string, string>) => void;
}) {
  const { lang } = useApp();
  const custom = useOverrides((s) => s.optionLists[listKey]) ?? [];
  const addOption = useOverrides((s) => s.addOption);

  const known = new Set(options.map((o) => o.value));
  const all = [
    ...options,
    ...custom.filter((o) => !known.has(o.value)).map((o) => ({ value: o.value, label: (lang === 'ar' ? o.ar || o.en : o.en || o.ar) || o.value })),
  ];

  const onSel = async (v: string) => {
    if (v !== '__add__') { onChange(v); return; }
    const r = await useDialog.getState().open({
      title: t('opt.addTitle', lang),
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      fields: [
        { key: 'ar', label: t('opt.ar', lang), value: '' },
        { key: 'en', label: t('opt.en', lang), value: '' },
        ...(addColor ? [{ key: 'color', label: t('opt.color', lang), value: '#2F6B3E', type: 'color' as const }] : []),
      ],
      buttons: [{ label: t('a.cancel', lang), value: 'cancel' }, { label: t('opt.add', lang), value: 'ok', variant: 'primary' }],
    });
    if (r.value !== 'ok') return;
    const ar = (r.fields.ar || '').trim(), en = (r.fields.en || '').trim();
    const val = (en || ar).trim();
    if (!val) return;
    if (onCreate) onCreate(val, ar, en, r.fields);
    else addOption(listKey, { value: val, ar: ar || undefined, en: en || undefined });
    onChange(val);
  };

  return (
    <select value={value} onChange={(e) => onSel(e.target.value)}>
      {allowNone && <option value="">{noneLabel ?? '—'}</option>}
      {all.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      <option value="__add__">➕ {t('opt.add', lang)}</option>
    </select>
  );
}
