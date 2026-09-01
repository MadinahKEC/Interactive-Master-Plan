/**
 * Firebase (Firestore) sync for the KEC overrides store.
 *
 * The whole editable state (plot attrs, projects, ownership, dev-plan phases,
 * land-use colours, geometry edits, merges, users, audit) is mirrored to a single
 * Firestore document as a JSON string — this sidesteps Firestore's no-nested-arrays
 * and no-undefined constraints (plot geometry is arrays-of-arrays).
 *
 * localStorage stays as an offline cache; Firestore is the shared source of truth,
 * so several people see each other's edits live. No Docker, no admin rights needed.
 *
 * NOTE: set Firestore security rules to allow access, e.g. (test/dev):
 *   rules_version = '2';
 *   service cloud.firestore { match /databases/{db}/documents {
 *     match /{doc=**} { allow read, write: if true; } } }
 */
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, runTransaction, getDoc, collection, addDoc, updateDoc, query, orderBy, limit } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import LZString from 'lz-string';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, setPersistence,
  browserLocalPersistence, browserSessionPersistence, createUserWithEmailAndPassword,
  type User,
} from 'firebase/auth';
import type { StoreApi } from 'zustand';

const firebaseConfig = {
  apiKey: 'AIzaSyAhwGtgylvsY51wIyhg5y8MI85mVfAjWkI',
  authDomain: 'interactive-master-plan.firebaseapp.com',
  projectId: 'interactive-master-plan',
  storageBucket: 'interactive-master-plan.firebasestorage.app',
  messagingSenderId: '645026717873',
  appId: '1:645026717873:web:b17f7e76b26bcc6975c290',
};

export const FIREBASE_ENABLED = true;

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const overridesDoc = doc(db, 'kec', 'overrides');

// ---------- Storage (plot images) ----------
/** Downscale an image file to keep uploads light. */
function resizeImage(file: File, maxDim = 1400, quality = 0.72): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.naturalWidth, h = img.naturalHeight;
      const scale = Math.min(1, maxDim / Math.max(w, h));
      w = Math.round(w * scale); h = Math.round(h * scale);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d')!.drawImage(img, 0, 0, w, h);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', quality);
    };
    img.onerror = () => reject(new Error('image load failed'));
    img.src = url;
  });
}

/** Upload a plot image to Firebase Storage; returns its download URL. */
export async function uploadPlotImage(code: string, file: File): Promise<string> {
  const blob = await resizeImage(file);
  const path = `plots/${code}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.jpg`;
  const r = storageRef(storage, path);
  await uploadBytes(r, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(r);
}

// ---------- Auth ----------
export function watchAuth(cb: (u: User | null) => void) { return onAuthStateChanged(auth, cb); }

// ---------- Access log (who signed in, from where, for how long) ----------
export interface AccessSession {
  id?: string; email: string; name?: string; role?: string;
  ip?: string; city?: string; country?: string; org?: string; ua?: string;
  loginAt: number; lastSeen: number;
}
const sessionsCol = collection(db, 'sessions');
/** Best-effort public IP + coarse geolocation (free, no key). */
export async function fetchGeo(): Promise<{ ip?: string; city?: string; country?: string; org?: string }> {
  try {
    const r = await fetch('https://ipwho.is/');
    const j: any = await r.json();
    if (j && j.success !== false) return { ip: j.ip, city: j.city, country: j.country, org: j.connection?.org || j.org };
  } catch { /* offline / blocked */ }
  return {};
}
export async function logAccess(s: Omit<AccessSession, 'id'>): Promise<string | null> {
  try { const ref = await addDoc(sessionsCol, s as any); return ref.id; } catch { return null; }
}
export async function touchAccess(id: string): Promise<void> {
  try { await updateDoc(doc(db, 'sessions', id), { lastSeen: Date.now() }); } catch { /* */ }
}
export function watchAccessLog(cb: (rows: AccessSession[]) => void) {
  const q = query(sessionsCol, orderBy('loginAt', 'desc'), limit(300));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))), () => cb([]));
}

export async function signIn(email: string, password: string, remember: boolean) {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence).catch(() => {});
  return signInWithEmailAndPassword(auth, email, password);
}
export function signOutFb() { return signOut(auth); }

/** Bootstrap the super-admin account on first run (main auth, then signs in as it). */
export function bootstrapAccount(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

/** Create a Firebase account WITHOUT disturbing the admin's session (throwaway app). */
export async function createUserSecondary(email: string, password: string) {
  const secApp = initializeApp(firebaseConfig, 'kec-provision-' + Date.now());
  const secAuth = getAuth(secApp);
  try {
    const cred = await createUserWithEmailAndPassword(secAuth, email, password);
    await signOut(secAuth).catch(() => {});
    return cred.user.uid;
  } finally {
    try { await deleteApp(secApp); } catch { /* */ }
  }
}

interface SyncableStore {
  plotAttrs: unknown; projects: unknown; landUses: unknown; plotGeom: unknown;
  merges: unknown; users: unknown; audit: unknown; hiddenCards: unknown; hiddenLandUses: unknown;
  importAll: (json: string) => boolean;
}

// The whole overrides state is one JSON blob. Uncompressed it can exceed Firestore's
// 1 MB per-document limit (geometry edits especially) → writes fail with
// `invalid-argument` and nothing persists. Compress it (LZ marker for back-compat).
// Small slices are stored as raw JSON (instant, no CPU); only large ones are
// compressed (to stay under the 1 MB doc limit). parseBlob handles both.
const packBlob = (obj: unknown): string => {
  const raw = JSON.stringify(obj);
  return raw.length > 120000 ? 'LZ:' + LZString.compressToBase64(raw) : raw;
};

// Drop empty values (''/null/undefined/[]/{}) so per-plot records stay lean as the
// plan grows — smaller writes, faster compression, more headroom. In this data model
// an absent field means the same as an empty one, so this is loss-less. Keeps 0/false.
function compactVal(v: any): any {
  if (Array.isArray(v)) { const a = v.map(compactVal).filter((x) => x !== undefined); return a.length ? a : undefined; }
  if (v && typeof v === 'object') { const o: any = {}; for (const k in v) { const c = compactVal(v[k]); if (c !== undefined) o[k] = c; } return Object.keys(o).length ? o : undefined; }
  return (v === '' || v == null) ? undefined : v;
}
/** Compact every record in a per-plot map (keeps the plot key even if it empties out). */
function compactMap(m: Record<string, any> | undefined): Record<string, any> {
  const out: Record<string, any> = {};
  for (const code in (m || {})) out[code] = compactVal(m![code]) ?? {};
  return out;
}
const parseBlob = (s: string | undefined): Record<string, any> => {
  if (!s) return {};
  try {
    if (s.startsWith('LZ:')) { const d = LZString.decompressFromBase64(s.slice(3)); return d ? JSON.parse(d) : {}; }
    return JSON.parse(s); // legacy uncompressed doc
  } catch { return {}; }
};

/** Lightweight sync-event bus so an on-screen readout can show write/read status. */
export type SyncEvt = { at: number; kind: 'write-ok' | 'write-err' | 'remote'; msg: string };
const syncEvtListeners = new Set<(e: SyncEvt) => void>();
export const syncLog: SyncEvt[] = [];
export function onSyncEvent(cb: (e: SyncEvt) => void) { syncEvtListeners.add(cb); return () => { syncEvtListeners.delete(cb); }; }
function emitSync(kind: SyncEvt['kind'], msg: string) {
  const e = { at: Date.now(), kind, msg };
  syncLog.unshift(e); if (syncLog.length > 30) syncLog.pop();
  console.log('[sync]', kind, msg);
  syncEvtListeners.forEach((l) => { try { l(e); } catch { /* */ } });
}

/** Bidirectional sync: Firestore <-> overrides store. Call once at startup.
 *
 *  SHARDED STORAGE: the state is split across several documents in the `kec_state`
 *  collection, each with its own 1 MB budget, so the store can grow far beyond a
 *  single document's limit. Big per-plot data (attrs / projects / geometry) each get
 *  their own doc; shared data (land uses, users, …) sits in `_core`. Each write is a
 *  transaction that UNIONs onto the current remote, so no writer erases another's
 *  data. A missing slice never wipes local state (importAll only touches present
 *  keys), so a partial write is always safe. Migrates the old single doc on first run.
 *  (Plot images live in Firebase Storage — only their URLs are stored here.)
 */
// After a local edit these maps WIN over any incoming remote for a grace window,
// so a stale/concurrent snapshot can't make a just-made change "appear then vanish".
const SHIELDED_MAPS = ['landUses', 'projects', 'plotAttrs', 'hiddenCards', 'hiddenLandUses'] as const;
const SHIELD_MS = 12000;

// slice name → { keys stored in it; which are object-maps / string-arrays to union }
const SLICES: Record<string, { keys: string[]; maps: string[]; arrays: string[] }> = {
  _core: { keys: ['landUses', 'users', 'merges', 'hiddenCards', 'hiddenLandUses', 'audit'], maps: ['landUses'], arrays: ['hiddenCards', 'hiddenLandUses'] },
  attrs: { keys: ['plotAttrs'], maps: ['plotAttrs'], arrays: [] },
  projects: { keys: ['projects'], maps: ['projects'], arrays: [] },
  geom: { keys: ['plotGeom'], maps: ['plotGeom'], arrays: [] },
};

export function startFirestoreSync(store: StoreApi<SyncableStore>) {
  let applyingRemote = false;
  let protectUntil = 0;
  let writeTimer: ReturnType<typeof setTimeout> | undefined;
  const pending = new Set<string>();
  const sliceRef = (name: string) => doc(db, 'kec_state', name);

  // ---- remote -> local (one listener per slice; a missing slice is simply skipped) ----
  for (const name of Object.keys(SLICES)) {
    onSnapshot(
      sliceRef(name),
      (snap) => {
        if (!snap.exists()) return;
        const data = parseBlob((snap.data() as any)?.b);
        const slice: Record<string, any> = {};
        for (const k of SLICES[name].keys) if (k in data) slice[k] = data[k];
        if (Date.now() < protectUntil) {
          const local = store.getState() as unknown as Record<string, any>;
          for (const k of SHIELDED_MAPS) if (k in slice) slice[k] = local[k];
        }
        try { applyingRemote = true; store.getState().importAll(JSON.stringify(slice)); }
        finally { applyingRemote = false; }
        emitSync('remote', `${name} applied${Date.now() < protectUntil ? ' (shielded)' : ''}`);
      },
      (err) => { emitSync('write-err', `snapshot ${name}: ` + ((err as any)?.code || '')); console.warn('[firestore] snapshot error', err); },
    );
  }

  // ---- local -> remote (write only the slices that actually changed) ----
  store.subscribe((state: any, prev: any) => {
    if (applyingRemote) return;
    protectUntil = Date.now() + SHIELD_MS;
    for (const name of Object.keys(SLICES)) if (SLICES[name].keys.some((k) => state[k] !== prev[k])) pending.add(name);
    clearTimeout(writeTimer);
    writeTimer = setTimeout(flush, 500);
  });

  async function writeSlice(name: string): Promise<number> {
    const st = store.getState() as unknown as Record<string, any>;
    const spec = SLICES[name];
    let kb = 0;
    await runTransaction(db, async (tx) => {
      const remote = parseBlob((await tx.get(sliceRef(name))).data()?.b as any);
      const merged: Record<string, any> = {};
      for (const k of spec.keys) merged[k] = st[k];                                   // last-write-wins for plain keys
      for (const k of spec.maps) merged[k] = { ...(remote[k] || {}), ...(st[k] || {}) }; // maps → union
      for (const k of spec.arrays) merged[k] = Array.from(new Set([...(remote[k] || []), ...(st[k] || [])])); // arrays → union
      // Drop the legacy full-state `before` snapshots entirely, and keep the compact
      // per-edit `prev` (undo image) only for the most recent 40 entries so the change
      // log stays small while cross-session undo still works for recent edits.
      if (Array.isArray(merged.audit)) merged.audit = merged.audit.map((e: any, i: number) => {
        const { before, prev, ...rest } = e;
        return i < 40 && prev ? { ...rest, prev } : rest;
      });
      // strip empty per-plot fields so records stay lean as the plan grows
      for (const k of spec.maps) if (k === 'projects' || k === 'plotAttrs') merged[k] = compactMap(merged[k]);
      const packed = packBlob(merged); kb = Math.round(packed.length / 1024);
      // Early warning well before the 1 MB ceiling, so we can shard proactively.
      if (packed.length > 750000) { emitSync('write-err', `slice "${name}" is ${kb}KB — nearing the 1MB limit`); console.warn(`[firestore] slice "${name}" ${kb}KB approaching 1MB — consider per-plot sharding`); }
      tx.set(sliceRef(name), { b: packed, at: Date.now() });
    });
    return kb;
  }

  // Serialised so two edits in quick succession never run overlapping transactions
  // on the same slice doc (that contention is what made a save occasionally fail).
  let flushing = false;
  async function flush() {
    if (flushing) return;                 // a flush is running; it re-checks pending when it ends
    flushing = true;
    const names = [...pending]; pending.clear();
    let kb = 0; const failed: string[] = [];
    for (const name of names) {
      try { kb = Math.max(kb, await writeSlice(name)); }
      catch (e: any) { failed.push(name); console.warn('[firestore] slice write failed', name, e); }
    }
    flushing = false;
    if (failed.length) {
      for (const n of failed) pending.add(n);                 // keep them queued and retry shortly
      emitSync('write-err', `retrying [${failed.join(',')}]`);
      clearTimeout(writeTimer); writeTimer = setTimeout(flush, 1500);
    } else {
      emitSync('write-ok', `saved · [${names.join(',')}] · ${kb}KB`);
      if (pending.size) { clearTimeout(writeTimer); writeTimer = setTimeout(flush, 250); } // changes that arrived mid-flush
    }
  }

  // ---- one-time migration from the legacy single `kec/overrides` doc ----
  (async () => {
    try {
      const core = await getDoc(sliceRef('_core'));
      if (core.exists()) return;                               // already sharded
      const legacy = await getDoc(overridesDoc);
      const data = parseBlob((legacy.data() as any)?.blob);
      if (!data || Object.keys(data).length === 0) return;     // nothing to migrate
      try { applyingRemote = true; store.getState().importAll(JSON.stringify(data)); }
      finally { applyingRemote = false; }
      for (const name of Object.keys(SLICES)) await writeSlice(name);
      emitSync('write-ok', 'migrated to sharded storage');
    } catch (e: any) { emitSync('write-err', 'migrate: ' + (e?.code || e?.message)); }
  })();
}
