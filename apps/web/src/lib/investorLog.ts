/**
 * Read-only connection to the SEPARATE "kec-investor-log" Firebase project, so the
 * plot card can automatically list the investors who registered interest in a plot.
 *
 * Second Firebase app (our main app stays on `interactive-master-plan`). Read only.
 *
 * Discovered schema (collection `kec_investors`): each investor is its own document
 * (system docs are prefixed `_` and skipped). Fields used here:
 *   company     → company name
 *   entry_date  → registration date ("YYYY-MM-DD")
 *   opportunity → investment type (array, e.g. ["Land Acquisition","Joint Development (JV)"])
 *   deal_value  → deal value (number)
 *   PLOT LINK   → `plot` (NOT YET in the register — add a field holding the plot code,
 *                 e.g. "S19", to each record for it to appear on that plot's card).
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getFirestore, collection, getDocs, query, where, type Firestore } from 'firebase/firestore';
import { useEffect, useState } from 'react';

const INVESTOR_LOG_CONFIG = {
  apiKey: 'AIzaSyBr88VCVXdDkQJdxJqwLJ_HutsFvZR-HJE',
  authDomain: 'kec-investor-log.firebaseapp.com',
  projectId: 'kec-investor-log',
  storageBucket: 'kec-investor-log.firebasestorage.app',
  messagingSenderId: '870716823065',
  appId: '1:870716823065:web:bde028421733f7d6febc88',
};

// App Check locks the investor data to registered apps/domains only. Once you enable
// App Check + reCAPTCHA v3 on the kec-investor-log project, paste the reCAPTCHA v3
// SITE key here; then enforce App Check on Cloud Firestore. Empty = App Check off.
const APPCHECK_SITE_KEY = '';

const COLLECTION = 'kec_investors';
const FIELDS = {
  plotCode: 'plot',          // add this field (plot code, e.g. "S19") to each record to link it
  company: 'company',
  date: 'entry_date',
  investType: 'opportunity', // array → joined for display
  dealValue: 'deal_value',
};

export const INVESTOR_LOG_ENABLED = INVESTOR_LOG_CONFIG.projectId !== '';

let cachedDb: Firestore | null = null;
function investorDb(): Firestore | null {
  if (!INVESTOR_LOG_ENABLED) return null;
  if (cachedDb) return cachedDb;
  const name = 'kec-investor-log';
  const app = getApps().some((a) => a.name === name) ? getApp(name) : initializeApp(INVESTOR_LOG_CONFIG, name);
  if (APPCHECK_SITE_KEY) {
    try { initializeAppCheck(app, { provider: new ReCaptchaV3Provider(APPCHECK_SITE_KEY), isTokenAutoRefreshEnabled: true }); }
    catch { /* already initialised */ }
  }
  cachedDb = getFirestore(app);
  return cachedDb;
}

export interface InterestedInvestor {
  id: string;
  company: string;
  date: string;
  investType: string;
  dealValue: number | null;
}

const toNum = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const toText = (v: unknown): string => (Array.isArray(v) ? v.filter(Boolean).join(' · ') : v == null ? '' : String(v)).trim();
const toDate = (v: any): string => {
  if (!v) return '';
  if (typeof v?.toDate === 'function') return v.toDate().toISOString().slice(0, 10); // Firestore Timestamp
  if (typeof v === 'number') return new Date(v).toISOString().slice(0, 10);
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10);
};

/** Fetch the investors who registered interest in `plotCode`. */
export function useInterestedInvestors(plotCode: string | undefined) {
  const [rows, setRows] = useState<InterestedInvestor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const db = investorDb();
    if (!db || !plotCode) { setRows([]); return; }
    let cancelled = false;
    setLoading(true); setError(false);
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, COLLECTION), where(FIELDS.plotCode, '==', plotCode)));
        const out: InterestedInvestor[] = snap.docs
          .filter((d) => !d.id.startsWith('_'))
          .map((d) => {
            const x = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              company: toText(x[FIELDS.company]) || '—',
              date: toDate(x[FIELDS.date]),
              investType: toText(x[FIELDS.investType]) || '—',
              dealValue: toNum(x[FIELDS.dealValue]),
            };
          });
        out.sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
        if (!cancelled) setRows(out);
      } catch (e) {
        console.warn('[investor-log] read failed — check config + Firestore rules', e);
        if (!cancelled) { setRows([]); setError(true); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [plotCode]);

  return { rows, loading, error };
}
