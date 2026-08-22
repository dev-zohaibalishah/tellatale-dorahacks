/**
 * Canonical domain + AI contract. Imported by BOTH the Expo app and the Cloud
 * Functions, so it cannot import from either side.
 *
 * The composed-story shape is the MVP spec's "AI output requirements" block, field
 * for field. Wire names are frozen to that spec so an existing composer endpoint can
 * be dropped in without a translation layer.
 *
 * One deliberate split: the wire field stays `familyPerspectives` (spec-mandated),
 * but the label rendered above it is derived from the memory type — see
 * `perspectivesLabel`. The product is not family-only, and hardcoding "family" into
 * the UI is the exact regression the Heirloom prototype already shipped.
 */

import { z } from 'zod';

/* ------------------------------------------------------------------ certainty */

export const Certainty = z.enum(['certain', 'think', 'unsure']);
export type Certainty = z.infer<typeof Certainty>;

/** Verbatim user-facing wording from the MVP spec §3. */
export const certaintyLabel: Record<Certainty, string> = {
  certain: 'certain',
  think: 'I think',
  unsure: 'not sure',
};

/* ------------------------------------------------------------- memory + remark */

export const MemoryType = z.enum([
  'family',
  'friendship',
  'travel',
  'celebration',
  'community',
  'work',
]);
export type MemoryType = z.infer<typeof MemoryType>;

export const memoryTypeLabel: Record<MemoryType, string> = {
  family: 'Family',
  friendship: 'Friendship',
  travel: 'Travel',
  celebration: 'Celebration',
  community: 'Community',
  work: 'Work',
};

/**
 * Section heading for the synthesised perspectives block. Reads from the memory's
 * type instead of assuming a family. Never hardcode "family" downstream.
 */
export function perspectivesLabel(t: MemoryType): string {
  switch (t) {
    case 'family':
      return 'What the family remembers';
    case 'friendship':
      return 'What friends remember';
    case 'travel':
      return 'What the group remembers';
    case 'celebration':
      return 'What everyone remembers';
    case 'community':
      return 'What the community remembers';
    case 'work':
      return 'What the team remembers';
  }
}

export const Visibility = z.enum(['private', 'public']);
export type Visibility = z.infer<typeof Visibility>;

export const Remark = z.object({
  id: z.string(),
  memoryId: z.string(),
  /** Guests contribute without an account; uid is absent for them. */
  authorUid: z.string().nullable(),
  contributorName: z.string().min(1).max(60),
  relationship: z.string().max(60).nullable(),
  text: z.string().min(1).max(2000),
  certainty: Certainty,
  dateHint: z.string().max(80).nullable(),
  locationHint: z.string().max(120).nullable(),
  /** Owner's inclusion control — excluded remarks are never sent to the composer. */
  included: z.boolean(),
  createdAt: z.number(),
});
export type Remark = z.infer<typeof Remark>;

export const Memory = z.object({
  id: z.string(),
  ownerUid: z.string(),
  title: z.string().min(1).max(120),
  memoryType: MemoryType,
  /** Storage path, not a URL. Clients resolve to a short-lived download URL. */
  imagePath: z.string(),
  imageWidth: z.number().nullable(),
  imageHeight: z.number().nullable(),
  /** The owner's words. Never rewritten by AI, never edited by anyone else. */
  originalRemark: z.string().min(1).max(2000),
  dateHint: z.string().max(80).nullable(),
  locationHint: z.string().max(120).nullable(),
  /** Whose memory this is, when that is not the owner. Null = the owner is telling it. */
  creditedTo: z.string().max(60).nullable().default(null),
  visibility: Visibility,
  /** Opaque invite token. Present on the doc but withheld from guest reads. */
  inviteToken: z.string(),
  contributorCount: z.number(),
  storyApprovedAt: z.number().nullable(),
  /** The uploader's §"Privacy and safety" attestation. Required before create. */
  permissionConfirmedAt: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type Memory = z.infer<typeof Memory>;

/* ---------------------------------------------------------------- composed story */

export const ComposedStory = z.object({
  title: z.string(),
  summary: z.string(),
  /** Echoed back unchanged. Verified against the stored original before save. */
  ownerMemory: z.string(),
  familyPerspectives: z.array(
    z.object({
      contributorName: z.string(),
      text: z.string(),
      certainty: Certainty,
    })
  ),
  imageObservations: z.array(z.string()),
  uncertainties: z.array(z.string()),
  story: z.string(),
});
export type ComposedStory = z.infer<typeof ComposedStory>;

export const StoryDoc = ComposedStory.extend({
  memoryId: z.string(),
  /** 'existing' = the team's StoryImage composer; 'local' = deterministic fallback. */
  provider: z.enum(['existing', 'local']),
  aiAssisted: z.boolean(),
  /** Remark ids actually fed to the composer, for auditability. */
  sourceRemarkIds: z.array(z.string()),
  /** Set only when the owner has approved. Publishing requires this. */
  approvedAt: z.number().nullable(),
  /** Owner edits after composition, kept separate from the AI's output. */
  ownerEditedTitle: z.string().nullable(),
  ownerEditedStory: z.string().nullable(),
  generatedAt: z.number(),
});
export type StoryDoc = z.infer<typeof StoryDoc>;

/* -------------------------------------------------------------------- reactions */

/** MVP spec §7 — exactly three, no free-text comments. */
export const Reaction = z.enum(['broughtBack', 'learned', 'wantToAdd']);
export type Reaction = z.infer<typeof Reaction>;

export const reactionLabel: Record<Reaction, string> = {
  broughtBack: 'That brought back a memory',
  learned: 'I learned something new',
  wantToAdd: 'I want to add more',
};

/* --------------------------------------------------------------- source labels */

export type SourceLabel =
  | { kind: 'owner' }
  | { kind: 'contributor'; name: string }
  | { kind: 'imageObservation' }
  | { kind: 'aiAssisted' };

export function sourceLabelText(s: SourceLabel): string {
  switch (s.kind) {
    case 'owner':
      return 'Owner';
    case 'contributor':
      return s.name;
    case 'imageObservation':
      return 'Image observation';
    case 'aiAssisted':
      return 'AI-assisted';
  }
}

/* ------------------------------------------------------- composer request shape */

/**
 * Exactly what the composer is allowed to see. Nothing else about the owner, the
 * other memories, or the account reaches the model.
 */
export const ComposeRequest = z.object({
  memoryId: z.string(),
  title: z.string(),
  memoryType: MemoryType,
  ownerRemark: z.string(),
  dateHint: z.string().nullable(),
  locationHint: z.string().nullable(),
  remarks: z.array(
    z.object({
      contributorName: z.string(),
      relationship: z.string().nullable(),
      text: z.string(),
      certainty: Certainty,
      dateHint: z.string().nullable(),
      locationHint: z.string().nullable(),
    })
  ),
  /** Short-lived signed URL. The composer never receives a permanent media URL. */
  imageUrl: z.string(),
});
export type ComposeRequest = z.infer<typeof ComposeRequest>;
