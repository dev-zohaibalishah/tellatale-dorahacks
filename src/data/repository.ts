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
  Certainty,
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
/**
 * One person's account, as a reader of a published story sees it.
 *
 * No author id and no way back to an account — a contributor is a name and some
 * words, which is all they ever agreed to be.
 */
export interface GuestAccount {
  id: string;
  contributorName: string;
  relationship: string | null;
  text: string;
  certainty: Certainty;
  createdAt: number;
}

export interface GuestMemoryView {
  memoryId: string;
  title: string;
  memoryType: MemoryType;
  imageUrl: string;
  /** The invitation prompt, verbatim from the MVP spec §2. */
  prompt: string;
  contributorCount: number;
  dateHint: string | null;
  locationHint: string | null;
  /** Present only once the owner has approved AND published. */
  publishedStory: StoryDoc | null;
  /**
   * The accounts woven into the published story. Empty until it is published —
   * holding a link must not reveal what the family said in private.
   */
  accounts: GuestAccount[];
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

/**
 * The account holder as they choose to appear.
 *
 * `username` is here but is not editable anywhere in the app. It is the identity Auth
 * is keyed by — through the synthetic address `<username>@tellatale.app` — so a
 * rename would leave the account unable to sign in. A database trigger refuses the
 * change too; this is one of the few places where the UI and the schema agree by
 * design rather than by accident.
 */
export interface Profile {
  uid: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  location: string | null;
  /** Storage path, not a URL. Resolve with `avatarUrl`. */
  avatarPath: string | null;
  createdAt: number;
}

/**
 * A patch, deliberately: `undefined` means "leave alone" and `null` means "clear it".
 * Passing the whole profile back would make the editor's stale copy authoritative and
 * silently undo anything changed elsewhere between load and save.
 */
export interface ProfilePatch {
  displayName?: string | null;
  bio?: string | null;
  location?: string | null;
}

/**
 * Something a person did to one of your memories.
 *
 * `actorName` is a copy, not a reference. Most contributors have no account, and even
 * for one who does, the name that belongs on this event is the name they used at the
 * time — not whatever they call themselves now.
 */
export interface AppNotification {
  id: string;
  memoryId: string;
  kind: 'remark_added' | 'reaction_added';
  actorName: string | null;
  /** A short quote of what they wrote, or the reaction they chose. */
  preview: string | null;
  readAt: number | null;
  createdAt: number;
}

export interface Repository {
  readonly kind: 'supabase' | 'local';

  /* ---- circles, requests, faces ---- */
  /** The circle this account owns or belongs to. Null until one is made. */
  getCircle(uid: string): Promise<Circle | null>;
  createCircle(uid: string, name: string): Promise<Circle>;
  listMembers(circleId: string): Promise<CircleMember[]>;
  addMember(circleId: string, displayName: string, relationship: string | null): Promise<CircleMember>;
  removeMember(memberId: string): Promise<void>;

  listRequests(circleId: string): Promise<MemoryRequest[]>;
  createRequest(circleId: string, question: string): Promise<MemoryRequest>;
  closeRequest(requestId: string): Promise<void>;
  listAnswers(requestId: string): Promise<RequestAnswer[]>;
  /** Links an existing memory to a question as its answer. */
  answerRequest(requestId: string, memoryId: string): Promise<void>;

  listFaceNames(memoryId: string): Promise<FaceName[]>;
  addFaceName(memoryId: string, name: string, relationship: string | null): Promise<FaceName>;
  removeFaceName(faceId: string): Promise<void>;

  /* ---- notifications ---- */
  watchNotifications(uid: string, cb: (n: AppNotification[]) => void): () => void;
  /** Marks every unread notification for the signed-in user read. */
  markNotificationsRead(): Promise<void>;

  /* ---- profile ---- */
  getProfile(uid: string): Promise<Profile | null>;
  updateProfile(uid: string, patch: ProfilePatch): Promise<Profile>;
  /** Uploads a local image, replaces any previous avatar, returns the saved profile. */
  setAvatar(uid: string, localImageUri: string): Promise<Profile>;
  removeAvatar(uid: string): Promise<Profile>;
  /** Resolves a stored avatar path to a short-lived, displayable URL. */
  avatarUrl(path: string): Promise<string>;

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

/* ------------------------------------------------------------------ circles */

/**
 * A family, and the people in it.
 *
 * `Member.uid` is nullable because a member need not have an account. "Zara — Cousin"
 * in the design is someone the family knows about and has not reached yet; a list that
 * can only hold accounts cannot say that she exists.
 */
export interface Circle {
  id: string;
  name: string;
  inviteToken: string;
  isOwner: boolean;
  createdAt: number;
}

export interface CircleMember {
  id: string;
  uid: string | null;
  displayName: string;
  relationship: string | null;
  /** Null until they actually join. */
  joinedAt: number | null;
}

/** A question somebody asked the family. */
export interface MemoryRequest {
  id: string;
  circleId: string;
  question: string;
  askedByName: string;
  askedByMe: boolean;
  answerCount: number;
  createdAt: number;
  closedAt: number | null;
}

/** One answer: a memory somebody posted in reply to a question. */
export interface RequestAnswer {
  id: string;
  title: string;
  imagePath: string;
  ownerName: string;
  ownedByMe: boolean;
  originalRemark: string;
  dateHint: string | null;
  locationHint: string | null;
  contributorCount: number;
  createdAt: number;
}

/** Someone named in a photograph. No detection, no coordinates — just the name. */
export interface FaceName {
  id: string;
  memoryId: string;
  name: string;
  relationship: string | null;
  createdAt: number;
}
