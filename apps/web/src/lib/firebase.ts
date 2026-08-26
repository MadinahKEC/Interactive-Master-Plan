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
import { getFirestore, doc, onSnapshot, runTransaction, collection, addDoc, updateDoc, query, orderBy, limit } from 'firebase/firestore';
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
const packBlob = (obj: unknown): string => 'LZ:' + LZString.compressToBase64(JSON.stringify(obj));
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

/** Bidirectional sync: Firestore <-> overrides store. Call once at startup. */
// Maps the admin edits directly. After a local change these WIN over any incoming
// remote snapshot for a grace window, so a stale/concurrent write from another tab
// or device can never make a just-made add/edit/delete "appear then vanish".
const SHIELDED_MAPS = ['landUses', 'projects', 'plotAttrs', 'hiddenCards', 'hiddenLandUses'] as const;
const SHIELD_MS = 12000;

export function startFirestoreSync(store: StoreApi<SyncableStore>) {
  let applyingRemote = false;
  let lastNonce = '';
  let protectUntil = 0;   // local edits to SHIELDED_MAPS win until this timestamp
  let writeTimer: ReturnType<typeof setTimeout> | undefined;

  // remote -> local
  onSnapshot(
    overridesDoc,
    (snap) => {
      const d = snap.data() as { blob?: string; nonce?: string } | undefined;
      if (!d?.blob || d.nonce === lastNonce) return; // ignore our own echo
      const remoteObj = parseBlob(d.blob);
      if (Date.now() < protectUntil) {
        // A recent local edit is still authoritative — keep our copy of the shielded
        // maps so an older remote blob can't roll it back.
        const local = store.getState() as unknown as Record<string, any>;
        for (const k of SHIELDED_MAPS) remoteObj[k] = local[k];
      }
      try {
        applyingRemote = true; store.getState().importAll(JSON.stringify(remoteObj));
        const luN = Object.keys((store.getState() as any).landUses || {}).length;
        emitSync('remote', `applied · LU=${luN}${Date.now() < protectUntil ? ' (shielded)' : ''}`);
      } finally { applyingRemote = false; }
    },
    (err) => { emitSync('write-err', 'snapshot: ' + ((err as any)?.code || (err as any)?.message)); console.warn('[firestore] snapshot error — check security rules', err); },
  );

  // local -> remote (debounced)
  store.subscribe(() => {
    if (applyingRemote) return;
    protectUntil = Date.now() + SHIELD_MS;
    clearTimeout(writeTimer);
    writeTimer = setTimeout(() => {
      const st = store.getState() as unknown as Record<string, any>;
      const localBlob: Record<string, any> = {
        plotAttrs: st.plotAttrs, projects: st.projects, landUses: st.landUses,
        plotGeom: st.plotGeom, merges: st.merges, users: st.users, audit: st.audit,
        hiddenCards: st.hiddenCards, hiddenLandUses: st.hiddenLandUses,
      };
      lastNonce = Math.random().toString(36).slice(2) + Date.now();
      // MERGE-ON-WRITE: read the current remote inside a transaction and UNION our
      // maps onto it, so a concurrent write from another tab/device/session can never
      // erase an addition (the root cause of "new land use appears then vanishes").
      let outKB = 0;
      runTransaction(db, async (tx) => {
        const snap = await tx.get(overridesDoc);
        const remote = parseBlob((snap.data() as any)?.blob);
        const merged: Record<string, any> = { ...remote, ...localBlob };
        // object maps → union (local wins on key conflicts); nothing gets dropped
        for (const k of ['landUses', 'projects', 'plotAttrs', 'plotGeom']) merged[k] = { ...(remote[k] || {}), ...(localBlob[k] || {}) };
        // string arrays (tombstones/removals) → union so deletes stick and adds survive
        for (const k of ['hiddenCards', 'hiddenLandUses']) merged[k] = Array.from(new Set([...(remote[k] || []), ...(localBlob[k] || [])]));
        const packed = packBlob(merged);
        outKB = Math.round(packed.length / 1024);
        tx.set(overridesDoc, { blob: packed, nonce: lastNonce, updatedAt: Date.now() });
      })
        .then(() => emitSync('write-ok', `saved · ${outKB}KB · LU=${Object.keys(localBlob.landUses || {}).length} · attrs=${Object.keys(localBlob.plotAttrs || {}).length}`))
        .catch((e) => { emitSync('write-err', `${e?.code || e?.message || 'failed'} · ${outKB}KB`); console.warn('[firestore] write error — check security rules', e); });
    }, 500);
  });
}
