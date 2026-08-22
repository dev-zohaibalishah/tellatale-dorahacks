/**
 * The one interface every screen talks to. Two adapters implement it:
 *
 *   supabase-repo.ts  — Postgres + RLS + Storage + Edge Functions
 *   local-repo.ts     — AsyncStorage, no network, seeded
 *
 * Screens must never import a backend SDK directly. That is what keeps the backend
 * decision reversible: the Heirloom PRD and the shipped StoryImage POC specify
 * mutually exclusive stacks, and this seam is where that argument gets settled
 * without touching a single screen.
 */

import type {
  ComposedStory,
  Memory,
  MemoryType,
  Reaction,
  Remark,
  StoryDoc,
  Visibility,
} from '../../shared/story';

export interface CreateMemoryInput {
  title: string;
  memoryType: MemoryType;
  /** Local file URI from the picker; the adapter uploads and returns a stored path. */
  localImageUri: string;
  imageWidth: number | null;
  imageHeight: number | null;
  originalRemark: string;
  dateHint: string | null;
  locationHint: string | null;
  /** Whose memory this is, when the owner is only holding the phone. */
  creditedTo?: string | null;
  /** MVP spec privacy rule: the uploader confirms they may share this image. */
  permissionConfirmed: true;
}

export interface SubmitRemarkInput {
  contributorName: string;
  relationship: string | null;
  text: string;
  certainty: Remark['certainty'];
  dateHint: string | null;
  locationHint: string | null;
}

/** What a guest is allowed to see. Owner identity and the AI narrative are withheld
 *  from a draft, per the StoryImage privacy rule. */
export interface GuestMemoryView {
  memoryId: string;
  title: string;
  memoryType: MemoryType;
  imageUrl: string;
  /** The invitation prompt, verbatim from the MVP spec §2. */
  prompt: string;
  contributorCount: number;
  /** Present only once the owner has approved AND published. */
  publishedStory: StoryDoc | null;
}

export interface Collection {
  id: string;
  name: string;
  kind: MemoryType;
  /** Denormalised for the dashboard; the list query counts memberships. */
  memoryCount: number;
  createdAt: number;
}

/**
 * The subset of a memory a contributor is allowed to see. Deliberately NOT `Memory`:
 * that type carries `inviteToken`, and handing a contributor the token would hand
 * them write access to a memory they do not own.
 */
export interface SharedMemory {
  id: string;
  title: string;
  memoryType: MemoryType;
  imagePath: string;
  dateHint: string | null;
  locationHint: string | null;
  contributorCount: number;
  visibility: Visibility;
  storyApprovedAt: number | null;
  createdAt: number;
  /** How many of the accounts on this memory are yours. */
  myRemarks: number;
  lastContributedAt: number | null;
}

export interface DashboardSummary {
  memoriesOwned: number;
  contributorsTotal: number;
  storiesApproved: number;
  storiesPublished: number;
  collectionsCount: number;
  sharedWithMe: number;
}

export interface Repository {
  readonly kind: 'supabase' | 'local';

  /* ---- owner ---- */
  listMemories(uid: string): Promise<Memory[]>;
  watchMemories(uid: string, cb: (m: Memory[]) => void): () => void;
  getMemory(id: string): Promise<Memory | null>;
  createMemory(uid: string, input: CreateMemoryInput): Promise<Memory>;
  deleteMemory(id: string): Promise<void>;
  setVisibility(id: string, v: Visibility): Promise<void>;
  /** Resolves a stored image path to a short-lived, displayable URL. */
  imageUrl(path: string): Promise<string>;
  /** Absolute deep link a guest opens to contribute. */
  inviteUrl(memory: Memory): string;

  /* ---- remarks ---- */
  watchRemarks(memoryId: string, cb: (r: Remark[]) => void): () => void;
  setRemarkIncluded(memoryId: string, remarkId: string, included: boolean): Promise<void>;
  deleteRemark(memoryId: string, remarkId: string): Promise<void>;

  /* ---- guest (no account) ---- */
  getGuestMemory(token: string): Promise<GuestMemoryView>;
  submitGuestRemark(token: string, input: SubmitRemarkInput): Promise<void>;
  addReaction(token: string, reaction: Reaction): Promise<void>;

  /* ---- collections ---- */
  listCollections(uid: string): Promise<Collection[]>;
  createCollection(uid: string, name: string, kind: MemoryType): Promise<Collection>;
  renameCollection(id: string, name: string): Promise<void>;
  deleteCollection(id: string): Promise<void>;
  /** Collection ids a memory currently belongs to. */
  collectionsForMemory(memoryId: string): Promise<string[]>;
  setMemoryCollections(memoryId: string, collectionIds: string[]): Promise<void>;

  /* ---- shared with me ---- */
  /**
   * Memories somebody else owns that this account has contributed to. Empty for a
   * purely anonymous contributor — linkage only exists when they were signed in.
   */
  listSharedWithMe(uid: string): Promise<SharedMemory[]>;
  dashboardSummary(uid: string): Promise<DashboardSummary>;

  /* ---- story ---- */
  watchStory(memoryId: string, cb: (s: StoryDoc | null) => void): () => void;
  /** Server-side composition. The client never holds a model key or calls a model. */
  composeStory(memoryId: string): Promise<StoryDoc>;
  saveOwnerEdits(
    memoryId: string,
    edits: { title: string | null; story: string | null }
  ): Promise<void>;
  approveStory(memoryId: string): Promise<void>;
  unapproveStory(memoryId: string): Promise<void>;
}

/** Narrow helper used by both adapters when echoing the owner's words back. */
export function assertOwnerMemoryUnchanged(
  original: string,
  composed: ComposedStory
): ComposedStory {
  // The composer is instructed to echo `ownerMemory` verbatim. If it did not, the
  // stored original wins — the owner's account is never displaced by a model's
  // paraphrase of it, even a well-meaning one.
  if (composed.ownerMemory.trim() !== original.trim()) {
    return { ...composed, ownerMemory: original };
  }
  return composed;
}
