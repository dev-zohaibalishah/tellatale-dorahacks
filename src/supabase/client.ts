/**
 * Supabase client — the main backend.
 *
 * Firebase is no longer the database. It does exactly one job now: delivering push
 * notifications. Everything else — identity, rows, media, server logic — is Supabase.
 *
 * The publishable key is safe in the bundle by design; access is decided by RLS, not
 * by hiding a string. The service role key must never appear in this file or any
 * EXPO_PUBLIC_ variable.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && key);

/**
 * Null when unconfigured rather than throwing at import time. A missing .env should
 * drop the app into local mode, not crash it on launch — which is exactly when
 * someone is watching.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, key!, {
      auth: {
        // AsyncStorage on device; localStorage on web. Without this the owner is
        // signed out on every reload and their memories look deleted.
        storage: Platform.OS === 'web' ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // No URL-fragment session parsing on native; there is no browser redirect.
        detectSessionInUrl: Platform.OS === 'web',
      },
    })
  : null;

/**
 * The project this bundle is talking to — for showing a developer, never a user.
 *
 * `EXPO_PUBLIC_*` values are inlined into the JavaScript bundle when Metro builds it,
 * not read at runtime. So editing `.env` changes nothing on a phone already connected
 * to a running Metro: it keeps serving the bundle it built earlier, pointed at
 * whatever project was configured then.
 *
 * That failure is invisible and it lies. Sign-in against the wrong project returns
 * "Invalid login credentials" — the same thing a wrong password returns — so the app
 * tells someone their password is wrong when the real answer is that it is asking a
 * different database. Printing the ref on the auth screen in development makes the
 * mismatch obvious in one glance.
 */
export const projectRef: string | null = url
  ? (/^https:\/\/([^.]+)\.supabase\./.exec(url)?.[1] ?? url)
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }
  return supabase;
}

/** Bucket holding memory originals. Private; reads go through signed URLs. */
export const MEDIA_BUCKET = 'memories';

/**
 * Bucket holding profile pictures. Also private — a person's face is not less
 * sensitive than their photographs, and this app's whole claim is that nothing is
 * public until they say so.
 */
export const AVATAR_BUCKET = 'avatars';
