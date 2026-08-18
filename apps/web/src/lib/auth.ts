import { create } from 'zustand';
import type { Role } from '@kec/types';
import { useOverrides, SUPER_ADMIN_EMAIL } from './overrides';
import { FIREBASE_ENABLED, watchAuth, signIn, signOutFb, bootstrapAccount, startFirestoreSync } from './firebase';

export { SUPER_ADMIN_EMAIL };

export interface CurrentUser { email: string; name: string; role: Role }
export type AuthStatus = 'loading' | 'in' | 'out';
export type AuthErr = null | 'invalid' | 'toomany' | 'network' | 'failed' | 'noaccount' | 'setup';

interface AuthState {
  status: AuthStatus;
  user: CurrentUser | null;
  error: AuthErr;
  busy: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  logout: () => void;
  setError: (e: AuthErr) => void;
}

/** Resolve a signed-in email to a role using the (synced) users map. */
function roleFor(email: string): { role: Role; name: string } {
  const e = email.toLowerCase();
  if (e === SUPER_ADMIN_EMAIL) return { role: 'administrator', name: 'Administrator' };
  const u = useOverrides.getState().users.find((x) => (x.email ?? '').toLowerCase() === e && x.active !== false);
  if (u) return { role: u.role as Role, name: u.name || e.split('@')[0] };
  return { role: 'viewer', name: e.split('@')[0] };
}

function mapErr(code: string): AuthErr {
  if (code === 'auth/configuration-not-found' || code === 'auth/operation-not-allowed') return 'setup';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found' || code === 'auth/invalid-email') return 'invalid';
  if (code === 'auth/too-many-requests') return 'toomany';
  if (code === 'auth/network-request-failed') return 'network';
  return 'failed';
}

export const useAuth = create<AuthState>((set) => ({
  status: FIREBASE_ENABLED ? 'loading' : 'out',
  user: null,
  error: null,
  busy: false,
  setError: (error) => set({ error }),
  login: async (email, password, remember) => {
    const e = email.trim().toLowerCase();
    set({ error: null, busy: true });
    try {
      await signIn(e, password, remember);
      // onAuthStateChanged sets the user
    } catch (ex: any) {
      const code = ex?.code || '';
      // first-run: create the super-admin account, then it signs in
      if (e === SUPER_ADMIN_EMAIL && (code === 'auth/user-not-found' || code === 'auth/invalid-credential')) {
        try { await bootstrapAccount(e, password); return; }
        catch (ex2: any) {
          const c2 = ex2?.code || '';
          set({ error: c2 === 'auth/email-already-in-use' ? 'invalid' : mapErr(c2) });
          return;
        } finally { set({ busy: false }); }
      }
      set({ error: mapErr(code) });
    } finally {
      set({ busy: false });
    }
  },
  logout: () => { signOutFb().catch(() => {}); set({ user: null, status: 'out' }); },
}));

let syncStarted = false;
if (FIREBASE_ENABLED) {
  watchAuth((u) => {
    if (u && u.email) {
      const { role, name } = roleFor(u.email);
      useAuth.setState({ user: { email: u.email, name, role }, status: 'in', error: null, busy: false });
      // start cloud sync now that we're authenticated (works with auth-required Firestore rules)
      if (!syncStarted) { syncStarted = true; try { startFirestoreSync(useOverrides as any); } catch (e) { console.warn('[firestore] sync init failed', e); } }
    } else {
      useAuth.setState({ user: null, status: 'out' });
    }
  });
  // when the users map syncs in (e.g. on a fresh device), re-resolve the current role
  useOverrides.subscribe(() => {
    const u = useAuth.getState().user;
    if (!u) return;
    const { role, name } = roleFor(u.email);
    if (role !== u.role || name !== u.name) useAuth.setState({ user: { ...u, role, name } });
  });
}
