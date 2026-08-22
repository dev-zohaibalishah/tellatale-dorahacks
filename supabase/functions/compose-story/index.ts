/**
 * Composition. Owner-only, authenticated, server-side.
 *
 * The client never holds a model key, never calls a model, and never receives a
 * permanent media URL. Excluded remarks are not filtered out of the model's output —
 * they are never sent to it at all, because the owner's exclusion is a privacy act,
 * not a display preference.
 *
 * A regenerated story is always an unapproved story. Approval attaches to the exact
 * words the owner read.
 */

import { admin, corsHeaders, fail, json, rateLimit, signedImageUrl } from '../_shared/admin.ts';
import { compose, type RemarkRow } from '../_shared/compose.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('Method not allowed.', 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return fail('Sign in to compose a story.', 401);

  // Resolve the caller from their own JWT rather than trusting a uid in the body.
  const asUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
  );
  const { data: userData, error: userError } = await asUser.auth.getUser();
  if (userError || !userData.user) return fail('Sign in to compose a story.', 401);
  const uid = userData.user.id;

  let memoryId: unknown;
  try {
    ({ memoryId } = await req.json());
  } catch {
    return fail('Malformed request.');
  }
  if (typeof memoryId !== 'string' || !memoryId) return fail('memoryId is required.');

  const db = admin();

  // Quota, per the PRD's AI budget. Stops cost blowout and stops the endpoint being
  // used as a free general-purpose model.
  if (!(await rateLimit(db, `compose:${uid}`, 30, '24 hours'))) {
    return fail('You have reached today’s composition limit.', 429);
  }

  const { data: memory, error: memErr } = await db
    .from('memories')
    .select('*')
    .eq('id', memoryId)
    .maybeSingle();

  if (memErr || !memory) return fail('Memory not found.', 404);
  if (memory.owner_id !== uid) {
    return fail('Only the owner can compose this story.', 403);
  }

  const { data: remarkRows } = await db
    .from('remarks')
    .select('*')
    .eq('memory_id', memoryId)
    .eq('included', true)
    .order('created_at', { ascending: true });

  const remarks = (remarkRows ?? []) as RemarkRow[];
  const imageUrl = await signedImageUrl(db, memory.image_path);

  const { story, provider } = await compose(memory, remarks, imageUrl);

  const row = {
    memory_id: memoryId,
    title: story.title,
    summary: story.summary,
    owner_memory: story.ownerMemory,
    perspectives: story.familyPerspectives,
    image_observations: story.imageObservations,
    uncertainties: story.uncertainties,
    story: story.story,
    provider,
    ai_assisted: provider !== 'local',
    source_remark_ids: remarks.map((r) => r.id),
    approved_at: null,
    owner_edited_title: null,
    owner_edited_story: null,
    generated_at: new Date().toISOString(),
  };

  const { error: upsertErr } = await db.from('stories').upsert(row, { onConflict: 'memory_id' });
  if (upsertErr) {
    console.error('story upsert failed', upsertErr);
    return fail('The story could not be saved.', 500);
  }

  return json({
    memoryId,
    title: row.title,
    summary: row.summary,
    ownerMemory: row.owner_memory,
    familyPerspectives: row.perspectives,
    imageObservations: row.image_observations,
    uncertainties: row.uncertainties,
    story: row.story,
    provider: row.provider,
    aiAssisted: row.ai_assisted,
    sourceRemarkIds: row.source_remark_ids,
    approvedAt: null,
    ownerEditedTitle: null,
    ownerEditedStory: null,
    generatedAt: Date.parse(row.generated_at),
  });
});
