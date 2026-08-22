/**
 * Story composition and its guardrails.
 *
 * Provider is chosen by configuration, never by the caller:
 *   STORYIMAGE_COMPOSER_URL set -> POST to the team's existing composer
 *   unset                       -> deterministic composition
 *
 * Whichever runs, output passes through the same `enforceGuardrails`. A provider that
 * fabricates is rejected rather than trusted, because a fabricated family memory is
 * the one failure this product cannot recover from.
 */

export type Certainty = 'certain' | 'think' | 'unsure';

export const certaintyLabel: Record<Certainty, string> = {
  certain: 'certain',
  think: 'I think',
  unsure: 'not sure',
};

export interface RemarkRow {
  id: string;
  contributor_name: string;
  relationship: string | null;
  body: string;
  certainty: Certainty;
  date_hint: string | null;
  location_hint: string | null;
}

export interface MemoryRow {
  id: string;
  title: string;
  memory_type: string;
  original_remark: string;
  date_hint: string | null;
  location_hint: string | null;
}

export interface Composed {
  title: string;
  summary: string;
  ownerMemory: string;
  familyPerspectives: { contributorName: string; text: string; certainty: Certainty }[];
  imageObservations: string[];
  uncertainties: string[];
  story: string;
}

/* ------------------------------------------------------------- deterministic */

function norm(s: string | null): string | null {
  const t = s?.trim().toLowerCase();
  return t ? t : null;
}

function uniq(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))];
}

function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/**
 * Arranges prose people already wrote and derives uncertainty structurally. It does
 * not write sentences of its own beyond connective tissue, so invention is impossible
 * by construction.
 */
export function composeDeterministically(
  memory: MemoryRow,
  remarks: RemarkRow[]
): Composed {
  const names = uniq(remarks.map((r) => r.contributor_name.trim()));
  const uncertainties: string[] = [];

  const dateClaims = new Map<string, string[]>();
  for (const r of remarks) {
    const d = norm(r.date_hint);
    if (!d) continue;
    dateClaims.set(d, [...(dateClaims.get(d) ?? []), r.contributor_name.trim()]);
  }
  const ownerDate = norm(memory.date_hint);
  if (ownerDate) {
    dateClaims.set(ownerDate, [...(dateClaims.get(ownerDate) ?? []), 'the owner']);
  }
  if (dateClaims.size > 1) {
    // Attribute the disagreement. Never resolve it.
    const rendered = [...dateClaims.entries()].map(
      ([date, who]) => `${list(who)} remembers it as ${date}`
    );
    uncertainties.push(`Memories differ on when this was: ${list(rendered)}.`);
  }

  const places = uniq([
    norm(memory.location_hint),
    ...remarks.map((r) => norm(r.location_hint)),
  ]);
  if (places.length > 1) {
    uncertainties.push(`Memories differ on where this was: ${list(places)}.`);
  }

  for (const r of remarks.filter((x) => x.certainty !== 'certain')) {
    uncertainties.push(
      `${r.contributor_name.trim()} was ${certaintyLabel[r.certainty]} about their account.`
    );
  }

  if (remarks.length === 0) {
    uncertainties.push('Nobody else has added their memory yet, so this is one account.');
  }

  const paragraphs: string[] = [memory.original_remark.trim()];
  if (remarks.length > 0) {
    paragraphs.push(
      remarks
        .map((r) => {
          const who = r.contributor_name.trim();
          const rel = r.relationship?.trim();
          const attribution = rel ? `${who} (${rel})` : who;
          const hedge = r.certainty === 'certain' ? '' : ` — ${certaintyLabel[r.certainty]}`;
          return `${attribution} remembers${hedge}: ${r.body.trim()}`;
        })
        .join('\n\n')
    );
  }
  if (dateClaims.size > 1) {
    paragraphs.push(
      'These accounts do not agree on every detail, and both are kept here as they were given.'
    );
  }

  const voices = names.length + 1;

  return {
    title: memory.title,
    summary: voices === 1 ? 'One account so far.' : `${voices} people remember this.`,
    ownerMemory: memory.original_remark,
    familyPerspectives: remarks.map((r) => ({
      contributorName: r.contributor_name.trim(),
      text: r.body.trim(),
      certainty: r.certainty,
    })),
    // No vision here. Empty is the honest answer, not a placeholder.
    imageObservations: [],
    uncertainties,
    story: paragraphs.join('\n\n'),
  };
}

/* ---------------------------------------------------------------- guardrails */

function collectProperNouns(text: string): string[] {
  const found = new Set<string>();
  for (const sentence of text.split(/(?<=[.!?\n])\s+/)) {
    sentence
      .trim()
      .split(/\s+/)
      .forEach((raw, i) => {
        const word = raw.replace(/[^\p{L}\p{N}'-]/gu, '');
        if (word.length < 2) return;
        if (i === 0) return; // sentence-initial capitalisation is not a signal
        if (!/^\p{Lu}/u.test(word)) return;
        found.add(word.toLowerCase());
      });
  }
  return [...found];
}

const IDENTITY_CLAIM =
  /\b(this is|that is|appears to be|looks like|identified as|resembles|must be)\b.*\b(mother|father|grandmother|grandfather|sister|brother|aunt|uncle|cousin|son|daughter|wife|husband)\b/i;

export function enforceGuardrails(
  candidate: Composed,
  memory: MemoryRow,
  remarks: RemarkRow[]
): Composed {
  const out: Composed = { ...candidate };

  // 1. The stored original always wins. The owner's account is never displaced by a
  //    model's paraphrase of it, however well-meaning.
  out.ownerMemory = memory.original_remark;

  // 2. A perspective attributed to someone who did not contribute is a fabricated
  //    witness. Drop it.
  const byName = new Map(remarks.map((r) => [r.contributor_name.trim().toLowerCase(), r]));
  out.familyPerspectives = (candidate.familyPerspectives ?? [])
    .filter((p) => byName.has(p.contributorName.trim().toLowerCase()))
    // 3. Certainty is the contributor's claim about their own memory. Restore theirs.
    .map((p) => {
      const src = byName.get(p.contributorName.trim().toLowerCase())!;
      return { ...p, certainty: src.certainty };
    });

  // 4. No proper noun may appear that was not in the input. This catches the
  //    highest-frequency hallucination: naming an unnamed person in the photo.
  const permitted = collectProperNouns(
    [
      memory.title,
      memory.original_remark,
      memory.date_hint ?? '',
      memory.location_hint ?? '',
      ...remarks.flatMap((r) => [
        r.contributor_name,
        r.relationship ?? '',
        r.body,
        r.date_hint ?? '',
        r.location_hint ?? '',
      ]),
    ].join(' ')
  );
  const introduced = collectProperNouns(out.story ?? '').filter((n) => !permitted.includes(n));
  if (introduced.length > 0) {
    console.warn('composer introduced unseen proper nouns; falling back', introduced);
    return composeDeterministically(memory, remarks);
  }

  // 5. Identification is forbidden outright, so offending observations are dropped
  //    rather than softened.
  out.imageObservations = (candidate.imageObservations ?? []).filter(
    (o) => !IDENTITY_CLAIM.test(o)
  );

  return out;
}

/* ------------------------------------------------------------------ provider */

export async function compose(
  memory: MemoryRow,
  remarks: RemarkRow[],
  imageUrl: string | null
): Promise<{ story: Composed; provider: 'existing' | 'local' }> {
  const url = Deno.env.get('STORYIMAGE_COMPOSER_URL');
  if (!url) {
    return { story: composeDeterministically(memory, remarks), provider: 'local' };
  }

  const token = Deno.env.get('STORYIMAGE_COMPOSER_TOKEN');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
      body: JSON.stringify({
        memoryId: memory.id,
        title: memory.title,
        memoryType: memory.memory_type,
        ownerRemark: memory.original_remark,
        dateHint: memory.date_hint,
        locationHint: memory.location_hint,
        imageUrl,
        remarks: remarks.map((r) => ({
          contributorName: r.contributor_name,
          relationship: r.relationship,
          text: r.body,
          certainty: r.certainty,
          dateHint: r.date_hint,
          locationHint: r.location_hint,
        })),
      }),
    });

    if (!res.ok) throw new Error(`composer returned ${res.status}`);
    const body = (await res.json()) as Composed;
    if (typeof body?.story !== 'string') throw new Error('composer returned an unexpected shape');

    return { story: enforceGuardrails(body, memory, remarks), provider: 'existing' };
  } catch (err) {
    // Do not repair a malformed composition. Fall back to output that cannot be wrong.
    console.error('composer failed, using deterministic composition', err);
    return { story: composeDeterministically(memory, remarks), provider: 'local' };
  } finally {
    clearTimeout(timer);
  }
}
