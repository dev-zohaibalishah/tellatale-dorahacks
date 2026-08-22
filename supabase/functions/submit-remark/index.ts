/**
 * A guest adds their account.
 *
 * The single write endpoint reachable without an account, which makes it the one that
 * has to be hardest: token validated, caller rate-limited, every field length-checked
 * server-side. The client's validation is a courtesy; this is the boundary.
 *
 * The owner is notified afterwards, best-effort. A failed push must never fail the
 * write — someone's memory landing matters, the notification about it does not.
 */

import {
  admin,
  callerKey,
  corsHeaders,
  fail,
  json,
  memoryByToken,
  optionalUserId,
  rateLimit,
  validToken,
} from '../_shared/admin.ts';
import { sendPush } from '../_shared/fcm.ts';

const CERTAINTIES = new Set(['certain', 'think', 'unsure']);

function clean(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
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

  const { token, remark } = payload as { token?: unknown; remark?: Record<string, unknown> };
  if (!validToken(token)) return fail('This link is not valid.', 404);
  if (!remark || typeof remark !== 'object') return fail('Nothing to add.');

  const contributorName = clean(remark.contributorName, 60);
  const body = clean(remark.text, 2000);
  const certainty = typeof remark.certainty === 'string' ? remark.certainty : 'certain';

  if (!contributorName) return fail('Please add your name.');
  if (!body) return fail('Please write what you remember.');
  if (!CERTAINTIES.has(certainty)) return fail('Unknown confidence level.');

  const db = admin();

  // Tighter than the read limit: this is the abuse surface if a link leaks.
  if (!(await rateLimit(db, `guest-write:${callerKey(req)}`, 10))) {
    return fail('Too many submissions. Please wait a moment.', 429);
  }

  const memory = await memoryByToken(db, token);
  if (!memory) return fail('This link is not valid.', 404);

  const authorId = await optionalUserId(req);

  const { error } = await db.from('remarks').insert({
    memory_id: memory.id,
    // Null for a true guest. Set only when they were already signed in, so the
    // memory can appear under their "Shared with me" later.
    author_id: authorId,
    contributor_name: contributorName,
    relationship: clean(remark.relationship, 60),
    body,
    certainty,
    date_hint: clean(remark.dateHint, 80),
    location_hint: clean(remark.locationHint, 120),
    // Included by default — the owner curates by exception, not by opting each one in.
    included: true,
  });

  if (error) {
    console.error('remark insert failed', error);
    return fail('That could not be saved.', 500);
  }

  // --- notify the owner, best effort -----------------------------------------
  try {
    const { data: tokens } = await db
      .from('push_tokens')
      .select('fcm_token')
      .eq('user_id', memory.owner_id);

    if (tokens?.length) {
      const { invalid } = await sendPush(
        tokens.map((t) => t.fcm_token),
        {
          title: 'Someone remembered too',
          body: `${contributorName} added their side of "${memory.title}".`,
          route: `/memory/${memory.id}`,
        }
      );
      // Prune tokens FCM rejected as permanently dead rather than retrying forever.
      if (invalid.length) {
        await db.from('push_tokens').delete().in('fcm_token', invalid);
      }
    }
  } catch (err) {
    console.error('owner notification failed (non-fatal)', err);
  }

  // `linked` lets the client offer "keep track of what you added" only when it would
  // actually work, instead of promising something anonymous contributors cannot have.
  return json({ ok: true, memoryId: memory.id, linked: authorId !== null });
});
