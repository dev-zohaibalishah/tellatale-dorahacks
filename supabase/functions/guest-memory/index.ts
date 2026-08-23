/**
 * What a guest is allowed to see.
 *
 * Runs without a JWT — contributors have no account, by design. The invite token is
 * the credential, and it is resolved here under the service role so it is never
 * exposed to a reader who does not already hold it.
 *
 * The withholding is the point: a guest gets the photo and the question. They do not
 * get the owner's identity, the other contributors, the remark list, or the composed
 * narrative — the last of those only once the owner has BOTH approved and published.
 */

import {
  admin,
  callerKey,
  corsHeaders,
  fail,
  json,
  memoryByToken,
  rateLimit,
  signedImageUrl,
  validToken,
} from '../_shared/admin.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('Method not allowed.', 405);

  let token: unknown;
  try {
    ({ token } = await req.json());
  } catch {
    return fail('Malformed request.');
  }

  if (!validToken(token)) return fail('This link is not valid.', 404);

  const db = admin();

  if (!(await rateLimit(db, `guest-read:${callerKey(req)}`, 60))) {
    return fail('Too many requests. Please wait a moment.', 429);
  }

  const memory = await memoryByToken(db, token);
  if (!memory) return fail('This link is not valid.', 404);

  let publishedStory = null;
  if (memory.story_approved_at && memory.visibility === 'public') {
    const { data } = await db
      .from('stories')
      .select('*')
      .eq('memory_id', memory.id)
      .maybeSingle();
    if (data) {
      publishedStory = {
        memoryId: memory.id,
        title: data.title,
        summary: data.summary,
        ownerMemory: data.owner_memory,
        familyPerspectives: data.perspectives ?? [],
        imageObservations: data.image_observations ?? [],
        uncertainties: data.uncertainties ?? [],
        story: data.story,
        provider: data.provider,
        aiAssisted: data.ai_assisted,
        sourceRemarkIds: data.source_remark_ids ?? [],
        approvedAt: data.approved_at ? Date.parse(data.approved_at) : null,
        ownerEditedTitle: data.owner_edited_title,
        ownerEditedStory: data.owner_edited_story,
        generatedAt: Date.parse(data.generated_at),
      };
    }
  }

  /**
   * The accounts behind a published story.
   *
   * Withheld until the owner publishes, and that gate is the whole argument. Before
   * publication a contributor sees only the photo and the question — they must not be
   * able to read the family's private recollections just by holding a link.
   *
   * Once the owner approves and publishes, the woven story already names these people
   * and quotes their disagreements out loud: "Sara remembers it as 1994; Abbu places
   * it a year earlier." Showing the originals underneath reveals nothing the story has
   * not already said, and it is the difference between reading a summary about your
   * family and reading your family.
   *
   * Only `included` remarks. The owner curates by exception, and a remark they left
   * out of the story must not reappear below it.
   */
  let accounts: unknown[] = [];
  if (publishedStory) {
    const { data } = await db
      .from('remarks')
      // An explicit column list, not `*`: author_id must never leave this function.
      .select('id, contributor_name, relationship, body, certainty, created_at')
      .eq('memory_id', memory.id)
      .eq('included', true)
      .order('created_at', { ascending: true });

    accounts = (data ?? []).map((r) => ({
      id: r.id,
      contributorName: r.contributor_name,
      relationship: r.relationship,
      text: r.body,
      certainty: r.certainty,
      createdAt: Date.parse(r.created_at),
    }));
  }

  return json({
    memoryId: memory.id,
    title: memory.title,
    memoryType: memory.memory_type,
    imageUrl: await signedImageUrl(db, memory.image_path),
    prompt: 'What do you remember about this photo?',
    contributorCount: memory.contributor_count,
    dateHint: memory.date_hint,
    locationHint: memory.location_hint,
    publishedStory,
    accounts,
  });
});
