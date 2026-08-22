/**
 * A lightweight reaction to a published story.
 *
 * The MVP spec fixes three, and gates them on an approved AND public story — an
 * unpublished draft has no audience, so a reaction to one would mean a guest saw
 * something they should not have.
 */

import {
  admin,
  callerKey,
  corsHeaders,
  fail,
  json,
  memoryByToken,
  rateLimit,
  validToken,
} from '../_shared/admin.ts';

const REACTIONS = new Set(['broughtBack', 'learned', 'wantToAdd']);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('Method not allowed.', 405);

  let payload: { token?: unknown; reaction?: unknown };
  try {
    payload = await req.json();
  } catch {
    return fail('Malformed request.');
  }

  if (!validToken(payload.token)) return fail('This link is not valid.', 404);
  if (typeof payload.reaction !== 'string' || !REACTIONS.has(payload.reaction)) {
    return fail('Unknown reaction.');
  }

  const db = admin();

  if (!(await rateLimit(db, `guest-react:${callerKey(req)}`, 30))) {
    return fail('Too many requests. Please wait a moment.', 429);
  }

  const memory = await memoryByToken(db, payload.token);
  if (!memory) return fail('This link is not valid.', 404);

  if (!memory.story_approved_at || memory.visibility !== 'public') {
    return fail('This story is not published yet.', 409);
  }

  const { error } = await db
    .from('reactions')
    .insert({ memory_id: memory.id, kind: payload.reaction });

  if (error) {
    console.error('reaction insert failed', error);
    return fail('That could not be saved.', 500);
  }

  return json({ ok: true });
});
