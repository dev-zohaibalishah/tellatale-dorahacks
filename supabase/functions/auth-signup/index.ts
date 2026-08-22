/**
 * Account creation.
 *
 * Runs without a JWT — by definition, someone signing up has no session yet. It is
 * therefore rate-limited per IP and validates everything server-side.
 *
 * The password is handed straight to Supabase Auth, which bcrypts it. It is never
 * written to a table, never logged, and never returned. The profile row carries only
 * the username and display name.
 *
 * Account creation goes through the admin API rather than public signUp so it works
 * regardless of whether email confirmations are on — there is no real inbox behind a
 * synthetic address, so a confirmation mail would strand every new user.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });

const fail = (message: string, status = 400) => json({ error: message }, status);

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

/** Must match src/lib/username.ts on the client. */
function emailFor(username: string): string {
  return `${username.toLowerCase()}@tellatale.app`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('Method not allowed.', 405);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return fail('Malformed request.');
  }

  const username = typeof payload.username === 'string' ? payload.username.trim() : '';
  const password = typeof payload.password === 'string' ? payload.password : '';
  const displayName =
    typeof payload.displayName === 'string' ? payload.displayName.trim().slice(0, 60) : '';

  if (!USERNAME_RE.test(username)) {
    return fail('Usernames are 3-24 characters: letters, numbers and underscores.');
  }
  // Deliberately modest. The account guards one person's photo album, and a long
  // requirement on a phone keyboard costs more signups than it prevents attacks —
  // rate limiting does that job better.
  if (password.length < 8) {
    return fail('Passwords need at least 8 characters.');
  }
  if (password.length > 200) {
    return fail('That password is too long.');
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('cf-connecting-ip') ??
    'unknown';

  const { data: allowed } = await db.rpc('consume_rate_limit', {
    p_bucket: `signup:${ip}`,
    p_limit: 5,
    p_window: '1 hour',
  });
  if (allowed !== true) {
    return fail('Too many sign-ups from here. Please try again later.', 429);
  }

  // Check the profile table first so a taken username fails before an auth user is
  // created, rather than leaving an orphan behind.
  const { data: existing } = await db
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (existing) return fail('That username is taken.', 409);

  const { data: created, error: createErr } = await db.auth.admin.createUser({
    email: emailFor(username),
    password,
    // No real inbox exists behind a synthetic address; confirming here is what makes
    // the account immediately usable.
    email_confirm: true,
    user_metadata: { username, display_name: displayName || username },
  });

  if (createErr || !created?.user) {
    const message = createErr?.message ?? 'That account could not be created.';
    if (message.toLowerCase().includes('already')) {
      return fail('That username is taken.', 409);
    }
    console.error('createUser failed', createErr);
    return fail(message, 400);
  }

  const { error: profileErr } = await db.from('profiles').insert({
    id: created.user.id,
    username,
    display_name: displayName || username,
  });

  if (profileErr) {
    // Roll the auth user back. A user without a profile can never sign in usefully
    // and would permanently hold the username.
    await db.auth.admin.deleteUser(created.user.id).catch(() => {});
    console.error('profile insert failed', profileErr);
    return fail('That account could not be created.', 500);
  }

  // No session is returned. The client signs in with the credentials it already has,
  // so there is exactly one code path that establishes a session.
  return json({ ok: true, username, userId: created.user.id });
});
