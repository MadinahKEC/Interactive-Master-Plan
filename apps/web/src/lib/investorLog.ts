/**
 * Read-only connection to the SEPARATE "kec-investor-log" Firebase project, so the
 * plot card can automatically list the investors who registered interest in a plot.
 *
 * This is a second Firebase app (our main app stays on `interactive-master-plan`).
 * Nothing here writes — it only reads the investor register.
 *
 * ┌─ TO ACTIVATE ────────────────────────────────────────────────────────────────┐
 * │ 1. Paste the kec-investor-log web config below (Firebase console →            │
 * │    Project settings → General → Your apps → SDK setup → Config).              │
 * │ 2. Set COLLECTION to the Firestore collection that holds investor records.    │
 * │ 3. Map FIELDS to the document field names used in that collection.            │
 * │ 4. The investor-log Firestore rules must allow reads of that collection.      │
 * └──────────────────────────────────────────────────────────────────────────────┘
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, type Firestore } from 'firebase/firestore';
import { useEffect, useState } from 'react';

// ─── 1) kec-investor-log web config ──────────────────────────────────────────────
const INVESTOR_LOG_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',            // e.g. 'kec-investor-log'
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

// ─── 2) collection that stores investor records ─────────────────────────────────
const COLLECTION = 'records';

// ─── 3) document field names in that collection ─────────────────────────────────
const FIELDS = {
  plotCode: 'plot',       // links a record to a plot — MUST match our codes (e.g. "S19")
  company: 'company',     // investor / company name
  date: 'createdAt',      // registration date (Firestore Timestamp or ISO string)
  investType: 'type',     // investment type
  pricePerM: 'pricePerM', // price per m²
  dealValue: 'dealValue', // deal value
};
// ────────────────────────────────────────────────────────────────────────────────

export const INVESTOR_LOG_ENABLED = INVESTOR_LOG_CONFIG.projectId !== '';

let cachedDb: Firestore | null = null;
function investorDb(): Firestore | null {
  if (!INVESTOR_LOG_ENABLED) return null;
  if (cachedDb) return cachedDb;
  const name = 'kec-investor-log';
  const app = getApps().some((a) => a.name === name) ? getApp(name) : initializeApp(INVESTOR_LOG_CONFIG, name);
  cachedDb = getFirestore(app);
  return cachedDb;
}

export interface InterestedInvestor {
  id: string;
  company: string;
  date: string;
  investType: string;
  pricePerM: number | null;
  dealValue: number | null;
}

const toNum = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const toDate = (v: any): string => {
  if (!v) return '';
  if (typeof v?.toDate === 'function') return v.toDate().toISOString().slice(0, 10); // Firestore Timestamp
  if (typeof v === 'number') return new Date(v).toISOString().slice(0, 10);
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10);
};

/** Live-ish read: fetch the investors who registered interest in `plotCode`. */
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
        const out: InterestedInvestor[] = snap.docs.map((d) => {
          const x = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            company: String(x[FIELDS.company] ?? '—'),
            date: toDate(x[FIELDS.date]),
            investType: String(x[FIELDS.investType] ?? '—'),
            pricePerM: toNum(x[FIELDS.pricePerM]),
            dealValue: toNum(x[FIELDS.dealValue]),
          };
        });
        // newest first
        out.sort((a, b) => (a.date < b.date ? 1 : -1));
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
