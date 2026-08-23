/**
 * Session — username + password against Supabase Auth.
 *
 * Passwords are handled by Auth (bcrypt) and never touched by this app beyond being
 * passed straight through. Nothing here writes, caches, or logs one.
 *
 * Anonymous sign-in is deliberately no longer used. Real accounts make the owner's
 * memories portable across devices, which is the entire reason to have an account at
 * all — and the contributor path stays account-free regardless, so nothing is gated
 * that should not be.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { supabase } from '../supabase/client';
import { useLocalBackend } from '../data';
import { localId } from '../lib/id';
import { emailForUsername } from '../lib/username';
import { unregisterPush } from '../push/register';

const LOCAL_UID_KEY = 'tellatale.local.uid';
const LOCAL_NAME_KEY = 'tellatale.local.name';

export interface AuthResult {
  ok: boolean;
  /** Human-readable, safe to show. Never contains a raw provider error. */
  error?: string;
}

interface Session {
  uid: string | null;
  username: string | null;
  displayName: string | null;
  /** False until the stored session has been checked — screens wait on this. */
  ready: boolean;
  signIn: (username: string, password: string) => Promise<AuthResult>;
  signUp: (username: string, password: string, displayName?: string) => Promise<AuthResult>;
  signOutNow: () => Promise<void>;
}

const Ctx = createContext<Session | null>(null);

/**
 * Provider errors are mapped to something a person can act on. "Invalid login
 * credentials" is Supabase's wording for both a wrong password and a username that
 * was never registered — and it should stay ambiguous, because distinguishing them
 * turns sign-in into a username oracle.
 */
function readableAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) {
    return 'That username and password do not match.';
  }
  if (m.includes('email not confirmed')) {
    return 'This account is not confirmed yet.';
  }
  if (m.includes('network') || m.includes('fetch')) {
    return 'Could not reach the server. Check your connection.';
  }
  return message;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    /* ---- local mode: a device-scoped identity, no network ---- */
    if (useLocalBackend || !supabase) {
      void (async () => {
        const [storedId, storedName] = await Promise.all([
          AsyncStorage.getItem(LOCAL_UID_KEY),
          AsyncStorage.getItem(LOCAL_NAME_KEY),
        ]);
        if (cancelled) return;
        setUid(storedId);
        setUsername(storedName);
        setDisplayName(storedName);
        setReady(true);
      })();
      return () => {
        cancelled = true;
      };
    }

    /* ---- supabase ---- */
    const client = supabase;

    const apply = (user: { id: string; user_metadata?: Record<string, unknown> } | null) => {
      setUid(user?.id ?? null);
      setUsername((user?.user_metadata?.username as string) ?? null);
      setDisplayName(
        (user?.user_metadata?.display_name as string) ??
          (user?.user_metadata?.username as string) ??
          null
      );
    };

    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      apply(session?.user ?? null);
    });

    void (async () => {
      const { data } = await client.auth.getSession();
      if (cancelled) return;
      apply(data.session?.user ?? null);
      setReady(true);
    })();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  /* -------------------------------------------------------------- sign in */

  const signIn = useCallback(
    async (name: string, password: string): Promise<AuthResult> => {
      if (useLocalBackend || !supabase) {
        // Local mode has no credential store. Treat the username as the identity so
        // the flow is walkable end to end without a backend.
        const id = (await AsyncStorage.getItem(LOCAL_UID_KEY)) ?? localId('local');
        await AsyncStorage.multiSet([
          [LOCAL_UID_KEY, id],
          [LOCAL_NAME_KEY, name.trim()],
        ]);
        setUid(id);
        setUsername(name.trim());
        setDisplayName(name.trim());
        return { ok: true };
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: emailForUsername(name),
        password,
      });
      if (error) return { ok: false, error: readableAuthError(error.message) };
      return { ok: true };
    },
    []
  );

  /* -------------------------------------------------------------- sign up */

  const signUp = useCallback(
    async (name: string, password: string, display?: string): Promise<AuthResult> => {
      if (useLocalBackend || !supabase) {
        return signIn(name, password);
      }

      // Creation runs server-side: it needs to check the username, create the auth
      // user, and write the profile as one unit, and none of that is a client's job.
      const { data, error } = await supabase.functions.invoke('auth-signup', {
        body: { username: name.trim(), password, displayName: display?.trim() },
      });

      if (error) {
        const detail = await (error as any)?.context
          ?.json?.()
          .then((b: any) => b?.error)
          .catch(() => null);
        return { ok: false, error: detail || readableAuthError(error.message) };
      }
      if (data && typeof data === 'object' && 'error' in (data as any)) {
        return { ok: false, error: String((data as any).error) };
      }

      // One code path establishes a session, and this is not it.
      return signIn(name, password);
    },
    [signIn]
  );

  const signOutNow = useCallback(async () => {
    if (useLocalBackend || !supabase) {
      await AsyncStorage.multiRemove([LOCAL_UID_KEY, LOCAL_NAME_KEY]);
      setUid(null);
      setUsername(null);
      setDisplayName(null);
      return;
    }

    /**
     * Drop this device's push token before dropping the session — in that order,
     * because the delete is authorised by RLS against the row's `user_id`, and after
     * `signOut` there is no `auth.uid()` left to match it.
     *
     * `unregisterPush` existed, documented itself as "called on sign-out", and was
     * called by nothing. So signing out on a borrowed or shared phone left the token
     * registered: the next person to hold it kept receiving notifications naming
     * someone else's memories and the people contributing to them.
     */
    await unregisterPush();
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<Session>(
    () => ({ uid, username, displayName, ready, signIn, signUp, signOutNow }),
    [uid, username, displayName, ready, signIn, signUp, signOutNow]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession must be used inside <AuthProvider>');
  return v;
}
