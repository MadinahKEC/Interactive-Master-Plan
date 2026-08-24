import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { useApp } from '../store';
import { t } from '../lib/domain';
import { IconClose, IconCopy, IconDownload } from './icons';

/** Themed share sheet: shareable link + KEC-coloured QR code for the current view. */
export function ShareModal({ url, title, onClose }: { url: string; title?: string; onClose: () => void }) {
  const { lang } = useApp();
  const [svg, setSvg] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toString(url, { type: 'svg', margin: 1, width: 220, color: { dark: '#143D1E', light: '#00000000' } })
      .then(setSvg)
      .catch(() => setSvg(''));
  }, [url]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ }
  };
  const downloadQr = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${title || 'kec'}-qr.svg`; a.click();
  };

  return createPortal(
    <div className="modal-wrap dlg-wrap" onClick={onClose}>
      <div className="modal dlg share-modal" dir={lang === 'ar' ? 'rtl' : 'ltr'} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <b>{t('share.title', lang)}{title ? ` — ${title}` : ''}</b>
          <button className="ic-btn" onClick={onClose}><IconClose size={17} /></button>
        </div>
        <div className="modal-body share-body">
          <div className="share-qr" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="share-hint">{t('share.hint', lang)}</p>
          <div className="share-link">
            <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
            <button className="btn sm primary" onClick={copy}><IconCopy size={13} /> {copied ? t('share.copied', lang) : t('share.copy', lang)}</button>
          </div>
          <button className="btn sm share-dl" onClick={downloadQr}><IconDownload size={13} /> {t('share.qr', lang)}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
