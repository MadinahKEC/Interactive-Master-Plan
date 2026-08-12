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
import { getFirestore, doc, onSnapshot, setDoc } from 'firebase/firestore';
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
const overridesDoc = doc(db, 'kec', 'overrides');

// ---------- Auth ----------
export function watchAuth(cb: (u: User | null) => void) { return onAuthStateChanged(auth, cb); }

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
  merges: unknown; users: unknown; audit: unknown;
  importAll: (json: string) => boolean;
}

/** Bidirectional sync: Firestore <-> overrides store. Call once at startup. */
export function startFirestoreSync(store: StoreApi<SyncableStore>) {
  let applyingRemote = false;
  let lastNonce = '';
  let writeTimer: ReturnType<typeof setTimeout> | undefined;

  // remote -> local
  onSnapshot(
    overridesDoc,
    (snap) => {
      const d = snap.data() as { blob?: string; nonce?: string } | undefined;
      if (!d?.blob || d.nonce === lastNonce) return; // ignore our own echo
      try { applyingRemote = true; store.getState().importAll(d.blob); }
      finally { applyingRemote = false; }
    },
    (err) => console.warn('[firestore] snapshot error — check security rules', err),
  );

  // local -> remote (debounced)
  store.subscribe(() => {
    if (applyingRemote) return;
    clearTimeout(writeTimer);
    writeTimer = setTimeout(() => {
      const st = store.getState();
      const blob = JSON.stringify({
        plotAttrs: st.plotAttrs, projects: st.projects, landUses: st.landUses,
        plotGeom: st.plotGeom, merges: st.merges, users: st.users, audit: st.audit,
      });
      lastNonce = Math.random().toString(36).slice(2) + Date.now();
      setDoc(overridesDoc, { blob, nonce: lastNonce, updatedAt: Date.now() })
        .catch((e) => console.warn('[firestore] write error — check security rules', e));
    }, 700);
  });
}
