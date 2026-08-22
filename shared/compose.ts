/**
 * Deterministic composer — the fallback when no model endpoint is configured.
 *
 * It does not write prose. It *arranges* prose that people already wrote, and it
 * derives uncertainty from structural facts (conflicting date hints, non-certain
 * confidence levels) rather than from judgement. That is a feature: it makes the
 * product's central claim — "the AI does not invent a family's past" — literally
 * enforceable in the one code path where invention is impossible by construction.
 *
 * Invariants, which the model-backed path is held to as well:
 *   • Every sentence traces to owner text, contributor text, or a derived count.
 *   • No proper noun appears that was not in the input.
 *   • `imageObservations` is empty — this composer cannot see the image, and an
 *     empty list is the honest answer. It never guesses at content.
 */

import type { Certainty, ComposedStory, Memory, Remark } from './story';
import { certaintyLabel } from './story';

/** Normalises a hint for comparison: "1987" and " 1987 " are the same claim. */
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

export function composeDeterministically(memory: Memory, remarks: Remark[]): ComposedStory {
  const names = uniq(remarks.map((r) => r.contributorName.trim()));

  /* ---- uncertainty, derived structurally ---- */

  const uncertainties: string[] = [];

  const dateClaims = new Map<string, string[]>();
  for (const r of remarks) {
    const d = norm(r.dateHint);
    if (!d) continue;
    dateClaims.set(d, [...(dateClaims.get(d) ?? []), r.contributorName.trim()]);
  }
  const ownerDate = norm(memory.dateHint);
  if (ownerDate) {
    dateClaims.set(ownerDate, [...(dateClaims.get(ownerDate) ?? []), 'the owner']);
  }
  if (dateClaims.size > 1) {
    const rendered = [...dateClaims.entries()].map(
      ([date, who]) => `${list(who)} remembers it as ${date}`
    );
    // Attribute the disagreement. Never resolve it — PRD §7.5 aiMerge guardrail.
    uncertainties.push(`Memories differ on when this was: ${list(rendered)}.`);
  }

  const placeClaims = uniq([
    norm(memory.locationHint),
    ...remarks.map((r) => norm(r.locationHint)),
  ]);
  if (placeClaims.length > 1) {
    uncertainties.push(`Memories differ on where this was: ${list(placeClaims)}.`);
  }

  // `certaintyLabel` is first-person UI wording ("I think"), which does not survive
  // being dropped into a third-person sentence — "Bilal was I think about their
  // account". The hedge gets its own phrasing rather than reusing the chip's.
  const hedgeNote: Record<Exclude<Certainty, 'certain'>, (name: string) => string> = {
    think: (name) => `${name} said "I think" rather than being certain.`,
    unsure: (name) => `${name} was not sure about their account.`,
  };

  for (const r of remarks) {
    if (r.certainty === 'certain') continue;
    uncertainties.push(hedgeNote[r.certainty](r.contributorName.trim()));
  }

  if (remarks.length === 0) {
    uncertainties.push('Nobody else has added their memory yet, so this is one account.');
  }

  /* ---- narrative, assembled from what was actually said ---- */

  const paragraphs: string[] = [memory.originalRemark.trim()];

  if (remarks.length > 0) {
    paragraphs.push(
      remarks
        .map((r) => {
          const who = r.contributorName.trim();
          const rel = r.relationship?.trim();
          const attribution = rel ? `${who} (${rel})` : who;
          const hedge = r.certainty === 'certain' ? '' : ` — ${certaintyLabel[r.certainty]}`;
          return `${attribution} remembers${hedge}: ${r.text.trim()}`;
        })
        .join('\n\n')
    );
  }

  if (dateClaims.size > 1) {
    paragraphs.push(
      'These accounts do not agree on every detail, and both are kept here as they were given.'
    );
  }

  const contributorLine =
    names.length === 0
      ? 'One account so far.'
      : `${names.length + 1} ${names.length + 1 === 2 ? 'person remembers' : 'people remember'} this.`;

  return {
    title: memory.title,
    summary: contributorLine,
    // Verbatim. This is the whole product.
    ownerMemory: memory.originalRemark,
    familyPerspectives: remarks.map((r) => ({
      contributorName: r.contributorName.trim(),
      text: r.text.trim(),
      certainty: r.certainty,
    })),
    // No vision here. An empty list is the honest answer, not a placeholder.
    imageObservations: [],
    uncertainties,
    story: paragraphs.join('\n\n'),
  };
}
