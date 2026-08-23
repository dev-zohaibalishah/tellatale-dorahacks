/**
 * AsyncStorage adapter — no network, no Firebase project required.
 *
 * This is not a toy. It exists so the app is demoable the moment it installs, and so
 * a judge tapping through on a bad conference network sees the product rather than a
 * spinner. It implements the same contract as the Firebase adapter, including the
 * guardrail that the owner's original words are never displaced by composed output.
 *
 * What it cannot do: cross-device guest contribution. A token opened on another phone
 * has no server to ask. That path needs the Firebase adapter.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  Memory,
  Reaction,
  Remark,
  StoryDoc,
  type MemoryType,
  type Visibility,
} from '../../shared/story';
import { buildInviteUrl, INVITE_PROMPT } from '../lib/links';
import { localId, randomToken } from '../lib/id';
import { composeLocally } from './local-composer';
import type {
  CreateMemoryInput,
  GuestMemoryView,
  Profile,
  ProfilePatch,
  Repository,
  SubmitRemarkInput,
} from './repository';

const KEY = 'tellatale.local.v1';

interface StoredCollection {
  id: string;
  ownerUid: string;
  name: string;
  kind: MemoryType;
  createdAt: number;
}

interface Snapshot {
  /** Keyed by uid. Local mode only ever has one, but keying it keeps the shape honest. */
  profiles: Record<string, Profile>;
  memories: Memory[];
  remarks: Record<string, Remark[]>;
  stories: Record<string, StoryDoc>;
  reactions: Record<string, Reaction[]>;
  collections: StoredCollection[];
  /** memoryId -> collectionIds */
  memberships: Record<string, string[]>;
}

const empty: Snapshot = {
  profiles: {},
  memories: [],
  remarks: {},
  stories: {},
  reactions: {},
  collections: [],
  memberships: {},
};

let cache: Snapshot | null = null;
const listeners = new Set<() => void>();

async function load(): Promise<Snapshot> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Snapshot) : { ...empty };
  } catch {
    cache = { ...empty };
  }
  return cache;
}

async function save(next: Snapshot) {
  cache = next;
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

/** Subscribe helper — local writes are synchronous, so a broadcast is enough. */
function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  void fn();
  return () => listeners.delete(fn);
}

function findByToken(s: Snapshot, token: string): Memory | undefined {
  return s.memories.find((m) => m.inviteToken === token);
}

/**
 * Local mode has no signup step, so the first read of a profile has to invent one
 * rather than return null — otherwise the editor opens on an account that appears not
 * to exist. The uid doubles as the username here, exactly as `auth.tsx` treats it.
 */
function blankProfile(uid: string): Profile {
  return {
    uid,
    username: uid,
    displayName: null,
    bio: null,
    location: null,
    avatarPath: null,
    createdAt: Date.now(),
  };
}

export function createLocalRepository(): Repository {
  return {
    kind: 'local',

    /* ----------------------------------------------------- notifications */

    watchNotifications(_uid, cb) {
      // Local mode is one device with no second person on it. A notification is by
      // definition news of somebody else, so there is never anything to report here —
      // and inventing a sample one would put fabricated family activity on the most
      // credulous screen in the app. The empty state explains itself.
      return subscribe(() => cb([]));
    },

    async markNotificationsRead() {
      // Nothing to mark.
    },

    /* ----------------------------------------------------------- profile */

    async getProfile(uid) {
      const s = await load();
      return s.profiles[uid] ?? blankProfile(uid);
    },

    async updateProfile(uid, patch: ProfilePatch) {
      const s = await load();
      const current = s.profiles[uid] ?? blankProfile(uid);
      // Same patch semantics as the Supabase adapter: a key that is absent is left
      // alone, a key set to null is cleared. Spreading `patch` directly would let an
      // undefined overwrite a real value and the two adapters would disagree.
      const next: Profile = {
        ...current,
        ...('displayName' in patch ? { displayName: patch.displayName ?? null } : null),
        ...('bio' in patch ? { bio: patch.bio ?? null } : null),
        ...('location' in patch ? { location: patch.location ?? null } : null),
      };
      await save({ ...s, profiles: { ...s.profiles, [uid]: next } });
      return next;
    },

    async setAvatar(uid, localImageUri) {
      const s = await load();
      const current = s.profiles[uid] ?? blankProfile(uid);
      // The picker URI is the "path". Device-local and lost on reinstall, which is
      // the same bargain the local adapter already makes for memory photos.
      const next: Profile = { ...current, avatarPath: localImageUri };
      await save({ ...s, profiles: { ...s.profiles, [uid]: next } });
      return next;
    },

    async removeAvatar(uid) {
      const s = await load();
      const current = s.profiles[uid] ?? blankProfile(uid);
      const next: Profile = { ...current, avatarPath: null };
      await save({ ...s, profiles: { ...s.profiles, [uid]: next } });
      return next;
    },

    async avatarUrl(path) {
      return path;
    },

    async listMemories(uid) {
      const s = await load();
      return s.memories.filter((m) => m.ownerUid === uid);
    },

    watchMemories(uid, cb) {
      return subscribe(async () => {
        const s = await load();
        cb(
          s.memories
            .filter((m) => m.ownerUid === uid)
            .sort((a, b) => b.createdAt - a.createdAt)
        );
      });
    },

    async getMemory(id) {
      const s = await load();
      return s.memories.find((m) => m.id === id) ?? null;
    },

    async createMemory(uid, input: CreateMemoryInput) {
      const s = await load();
      const now = Date.now();
      // Local mode keeps the picker URI as the "path". It is device-local and will not
      // survive a reinstall — acceptable for a local demo, never for the real adapter.
      const memory: Memory = {
        id: localId('mem'),
        ownerUid: uid,
        title: input.title,
        memoryType: input.memoryType,
        imagePath: input.localImageUri,
        imageWidth: input.imageWidth,
        imageHeight: input.imageHeight,
        originalRemark: input.originalRemark,
        dateHint: input.dateHint,
        locationHint: input.locationHint,
        creditedTo: input.creditedTo ?? null,
        visibility: 'private',
        inviteToken: randomToken(),
        contributorCount: 0,
        storyApprovedAt: null,
        permissionConfirmedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      await save({ ...s, memories: [memory, ...s.memories] });
      return memory;
    },

    async deleteMemory(id) {
      const s = await load();
      const { [id]: _r, ...remarks } = s.remarks;
      const { [id]: _s, ...stories } = s.stories;
      await save({
        ...s,
        memories: s.memories.filter((m) => m.id !== id),
        remarks,
        stories,
      });
    },

    async setVisibility(id, v: Visibility) {
      const s = await load();
      await save({
        ...s,
        memories: s.memories.map((m) =>
          m.id === id ? { ...m, visibility: v, updatedAt: Date.now() } : m
        ),
      });
    },

    async imageUrl(path) {
      return path;
    },

    inviteUrl(memory) {
      return buildInviteUrl(memory.inviteToken);
    },

    watchRemarks(memoryId, cb) {
      return subscribe(async () => {
        const s = await load();
        cb([...(s.remarks[memoryId] ?? [])].sort((a, b) => a.createdAt - b.createdAt));
      });
    },

    async setRemarkIncluded(memoryId, remarkId, included) {
      const s = await load();
      await save({
        ...s,
        remarks: {
          ...s.remarks,
          [memoryId]: (s.remarks[memoryId] ?? []).map((r) =>
            r.id === remarkId ? { ...r, included } : r
          ),
        },
      });
    },

    async deleteRemark(memoryId, remarkId) {
      const s = await load();
      const next = (s.remarks[memoryId] ?? []).filter((r) => r.id !== remarkId);
      await save({
        ...s,
        remarks: { ...s.remarks, [memoryId]: next },
        memories: s.memories.map((m) =>
          m.id === memoryId ? { ...m, contributorCount: next.length } : m
        ),
      });
    },

    async getGuestMemory(token): Promise<GuestMemoryView> {
      const s = await load();
      const memory = findByToken(s, token);
      if (!memory) throw new Error('This link is not valid.');
      const story = s.stories[memory.id];
      const published =
        story && story.approvedAt && memory.visibility === 'public' ? story : null;
      return {
        memoryId: memory.id,
        title: memory.title,
        memoryType: memory.memoryType,
        imageUrl: memory.imagePath,
        prompt: INVITE_PROMPT,
        contributorCount: memory.contributorCount,
        dateHint: memory.dateHint,
        locationHint: memory.locationHint,
        publishedStory: published ?? null,
        // Same gate as the server: the accounts appear only once the story does.
        accounts: published
          ? (s.remarks[memory.id] ?? [])
              .filter((r) => r.included)
              .map((r) => ({
                id: r.id,
                contributorName: r.contributorName,
                relationship: r.relationship,
                text: r.text,
                certainty: r.certainty,
                createdAt: r.createdAt,
              }))
          : [],
      };
    },

    async submitGuestRemark(token, input: SubmitRemarkInput) {
      const s = await load();
      const memory = findByToken(s, token);
      if (!memory) throw new Error('This link is not valid.');
      const remark: Remark = {
        id: localId('rem'),
        memoryId: memory.id,
        authorUid: null,
        contributorName: input.contributorName,
        relationship: input.relationship,
        text: input.text,
        certainty: input.certainty,
        dateHint: input.dateHint,
        locationHint: input.locationHint,
        included: true,
        createdAt: Date.now(),
      };
      const next = [...(s.remarks[memory.id] ?? []), remark];
      await save({
        ...s,
        remarks: { ...s.remarks, [memory.id]: next },
        memories: s.memories.map((m) =>
          m.id === memory.id ? { ...m, contributorCount: next.length } : m
        ),
      });
    },

    async addReaction(token, reaction) {
      const s = await load();
      const memory = findByToken(s, token);
      if (!memory) throw new Error('This link is not valid.');
      const story = s.stories[memory.id];
      // MVP spec: reactions require an approved, public story.
      if (!story?.approvedAt || memory.visibility !== 'public') {
        throw new Error('This story is not published yet.');
      }
      await save({
        ...s,
        reactions: {
          ...s.reactions,
          [memory.id]: [...(s.reactions[memory.id] ?? []), reaction],
        },
      });
    },

    /* --------------------------------------------------------- collections */

    async listCollections(uid) {
      const s = await load();
      return s.collections
        .filter((c) => c.ownerUid === uid)
        .map((c) => ({
          id: c.id,
          name: c.name,
          kind: c.kind,
          memoryCount: Object.values(s.memberships).filter((ids) => ids.includes(c.id))
            .length,
          createdAt: c.createdAt,
        }));
    },

    async createCollection(uid, name, kind) {
      const s = await load();
      const trimmed = name.trim();
      if (
        s.collections.some(
          (c) => c.ownerUid === uid && c.name.toLowerCase() === trimmed.toLowerCase()
        )
      ) {
        throw new Error('You already have a collection with that name.');
      }
      const record = {
        id: localId('col'),
        ownerUid: uid,
        name: trimmed,
        kind,
        createdAt: Date.now(),
      };
      await save({ ...s, collections: [record, ...s.collections] });
      return { id: record.id, name: record.name, kind, memoryCount: 0, createdAt: record.createdAt };
    },

    async renameCollection(id, name) {
      const s = await load();
      await save({
        ...s,
        collections: s.collections.map((c) =>
          c.id === id ? { ...c, name: name.trim() } : c
        ),
      });
    },

    async deleteCollection(id) {
      const s = await load();
      const memberships: Record<string, string[]> = {};
      // Drop the membership, never the memory.
      for (const [memoryId, ids] of Object.entries(s.memberships)) {
        memberships[memoryId] = ids.filter((c) => c !== id);
      }
      await save({
        ...s,
        collections: s.collections.filter((c) => c.id !== id),
        memberships,
      });
    },

    async collectionsForMemory(memoryId) {
      const s = await load();
      return s.memberships[memoryId] ?? [];
    },

    async setMemoryCollections(memoryId, collectionIds) {
      const s = await load();
      await save({
        ...s,
        memberships: { ...s.memberships, [memoryId]: [...collectionIds] },
      });
    },

    /* ----------------------------------------------------- shared with me */

    async listSharedWithMe() {
      // Local mode is single-device and has no notion of another person's account,
      // so nothing can genuinely be shared *with* you here. Returning an empty list
      // is the truthful answer; the dashboard explains why rather than looking broken.
      return [];
    },

    async dashboardSummary(uid) {
      const s = await load();
      const mine = s.memories.filter((m) => m.ownerUid === uid);
      return {
        memoriesOwned: mine.length,
        contributorsTotal: mine.reduce((n, m) => n + m.contributorCount, 0),
        storiesApproved: mine.filter((m) => m.storyApprovedAt).length,
        storiesPublished: mine.filter((m) => m.visibility === 'public').length,
        collectionsCount: s.collections.filter((c) => c.ownerUid === uid).length,
        sharedWithMe: 0,
      };
    },

    watchStory(memoryId, cb) {
      return subscribe(async () => {
        const s = await load();
        cb(s.stories[memoryId] ?? null);
      });
    },

    async composeStory(memoryId) {
      const s = await load();
      const memory = s.memories.find((m) => m.id === memoryId);
      if (!memory) throw new Error('Memory not found.');
      const included = (s.remarks[memoryId] ?? []).filter((r) => r.included);
      const composed = composeLocally(memory, included);
      const story: StoryDoc = {
        ...composed,
        memoryId,
        provider: 'local',
        aiAssisted: false,
        sourceRemarkIds: included.map((r) => r.id),
        approvedAt: null,
        ownerEditedTitle: null,
        ownerEditedStory: null,
        generatedAt: Date.now(),
      };
      await save({ ...s, stories: { ...s.stories, [memoryId]: story } });
      return story;
    },

    async saveOwnerEdits(memoryId, edits) {
      const s = await load();
      const story = s.stories[memoryId];
      if (!story) return;
      await save({
        ...s,
        stories: {
          ...s.stories,
          [memoryId]: {
            ...story,
            ownerEditedTitle: edits.title,
            ownerEditedStory: edits.story,
          },
        },
      });
    },

    async approveStory(memoryId) {
      const s = await load();
      const story = s.stories[memoryId];
      if (!story) return;
      const now = Date.now();
      await save({
        ...s,
        stories: { ...s.stories, [memoryId]: { ...story, approvedAt: now } },
        memories: s.memories.map((m) =>
          m.id === memoryId ? { ...m, storyApprovedAt: now, updatedAt: now } : m
        ),
      });
    },

    async unapproveStory(memoryId) {
      const s = await load();
      const story = s.stories[memoryId];
      if (!story) return;
      await save({
        ...s,
        stories: { ...s.stories, [memoryId]: { ...story, approvedAt: null } },
        memories: s.memories.map((m) =>
          m.id === memoryId
            ? { ...m, storyApprovedAt: null, visibility: 'private', updatedAt: Date.now() }
            : m
        ),
      });
    },
  };
}
