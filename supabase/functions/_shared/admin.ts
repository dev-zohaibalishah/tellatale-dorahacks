/**
 * Service-role client and the pieces every guest endpoint needs.
 *
 * Guest endpoints run with `verify_jwt: false` because contributors have no account —
 * that is the product's central friction removal, not an oversight. The invite token
 * IS the credential, so every one of them must: validate the token shape, rate-limit
 * the caller, and resolve the token server-side. None of that can be skipped.
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export function admin(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

export function fail(message: string, status = 400): Response {
  return json({ error: message }, status);
}

/** Matches src/lib/id.ts — 20 chars of unambiguous base32. */
const TOKEN_RE = /^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{20}$/;

export function validToken(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_RE.test(token);
}

export function callerKey(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('cf-connecting-ip') ??
    'unknown'
  );
}

export async function rateLimit(
  db: SupabaseClient,
  bucket: string,
  limit: number,
  window = '1 minute'
): Promise<boolean> {
  const { data, error } = await db.rpc('consume_rate_limit', {
    p_bucket: bucket,
    p_limit: limit,
    p_window: window,
  });
  // Fail closed. If the limiter is broken, the public write endpoint is not open.
  if (error) {
    console.error('rate limit check failed', error);
    return false;
  }
  return data === true;
}

/**
 * Resolves an invite token to its memory.
 *
 * Returns null for both "no such token" and "revoked token" so a caller cannot
 * distinguish a real-but-dead token from a guess.
 */
export async function memoryByToken(db: SupabaseClient, token: string) {
  const { data, error } = await db
    .from('memories')
    .select('*')
    .eq('invite_token', token)
    .maybeSingle();
  if (error) {
    console.error('token lookup failed', error);
    return null;
  }
  return data;
}

/**
 * Resolves the caller's uid IF they happen to be signed in. Returns null otherwise,
 * and never fails the request — an anonymous contributor is the normal case, not an
 * error, and this must not become a soft authentication requirement.
 */
export async function optionalUserId(req: Request): Promise<string | null> {
  const header = req.headers.get('Authorization');
  if (!header) return null;

  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  // The client always sends the publishable key as a bearer token; that is not a user.
  if (header === `Bearer ${anonKey}`) return null;

  try {
    const asUser = createClient(Deno.env.get('SUPABASE_URL')!, anonKey, {
      global: { headers: { Authorization: header } },
      auth: { persistSession: false },
    });
    const { data, error } = await asUser.auth.getUser();
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

/** Short-lived signed URL. No client ever holds a permanent media URL. */
export async function signedImageUrl(
  db: SupabaseClient,
  path: string,
  ttlSeconds = 900
): Promise<string | null> {
  const { data, error } = await db.storage
    .from('memories')
    .createSignedUrl(path, ttlSeconds);
  if (error) {
    console.error('sign url failed', error);
    return null;
  }
  return data.signedUrl;
}
