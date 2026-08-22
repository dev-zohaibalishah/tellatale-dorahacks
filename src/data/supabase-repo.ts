/**
 * Supabase adapter — Postgres + RLS + Storage + Edge Functions.
 *
 * Guest paths (read by token, submit a remark, react) go through Edge Functions
 * rather than PostgREST. RLS cannot validate an opaque invite token without a policy
 * that lets an anonymous caller read rows to test it, which would turn the token into
 * an oracle. So the token is resolved server-side under the service role and guests
 * get no table access at all.
 *
 * Realtime is used for the owner's own views. It is what makes a remark arriving from
 * someone else's phone appear without a refresh — the moment the demo turns on.
 */


import { MEDIA_BUCKET, requireSupabase } from '../supabase/client';
import {
  Memory,
  Remark,
  StoryDoc,
  type Reaction,
  type Visibility,
} from '../../shared/story';
import { readImageBytes } from '../lib/image-bytes';
import { buildInviteUrl } from '../lib/links';
import { randomToken } from '../lib/id';
import type {
  CreateMemoryInput,
  GuestMemoryView,
  Repository,
  SubmitRemarkInput,
} from './repository';

/* ------------------------------------------------------------------ mapping */

type Row = Record<string, any>;

const ms = (v: string | null | undefined): number | null =>
  v ? Date.parse(v) : null;

function toMemory(r: Row): Memory {
  return Memory.parse({
    id: r.id,
    ownerUid: r.owner_id,
    title: r.title,
    memoryType: r.memory_type,
    imagePath: r.image_path,
    imageWidth: r.image_width,
    imageHeight: r.image_height,
    originalRemark: r.original_remark,
    dateHint: r.date_hint,
    locationHint: r.location_hint,
    creditedTo: r.credited_to ?? null,
    visibility: r.visibility,
    inviteToken: r.invite_token,
    contributorCount: r.contributor_count,
    storyApprovedAt: ms(r.story_approved_at),
    permissionConfirmedAt: ms(r.permission_confirmed_at) ?? Date.now(),
    createdAt: ms(r.created_at) ?? Date.now(),
    updatedAt: ms(r.updated_at) ?? Date.now(),
  });
}

function toRemark(r: Row): Remark {
  return Remark.parse({
    id: r.id,
    memoryId: r.memory_id,
    authorUid: r.author_id,
    contributorName: r.contributor_name,
    relationship: r.relationship,
    text: r.body,
    certainty: r.certainty,
    dateHint: r.date_hint,
    locationHint: r.location_hint,
    included: r.included,
    createdAt: ms(r.created_at) ?? Date.now(),
  });
}

function toStory(r: Row): StoryDoc {
  return StoryDoc.parse({
    memoryId: r.memory_id,
    title: r.title,
    summary: r.summary,
    ownerMemory: r.owner_memory,
    familyPerspectives: r.perspectives ?? [],
    imageObservations: r.image_observations ?? [],
    uncertainties: r.uncertainties ?? [],
    story: r.story,
    provider: r.provider,
    aiAssisted: r.ai_assisted,
    sourceRemarkIds: r.source_remark_ids ?? [],
    approvedAt: ms(r.approved_at),
    ownerEditedTitle: r.owner_edited_title,
    ownerEditedStory: r.owner_edited_story,
    generatedAt: ms(r.generated_at) ?? Date.now(),
  });
}

/** Edge Function invoke with a uniform error surface. */
async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireSupabase().functions.invoke(name, { body });
  if (error) {
    // FunctionsHttpError carries the endpoint's own message; prefer it over the
    // generic "Edge Function returned a non-2xx status code".
    const detail = await (error as any)?.context
      ?.json?.()
      .then((b: any) => b?.error)
      .catch(() => null);
    throw new Error(detail || error.message);
  }
  if (data && typeof data === 'object' && 'error' in (data as any)) {
    throw new Error(String((data as any).error));
  }
  return data as T;
}

export function createSupabaseRepository(): Repository {
  return {
    kind: 'supabase',

    /* ------------------------------------------------------------- owner */

    async listMemories(uid) {
      const { data, error } = await requireSupabase()
        .from('memories')
        .select('*')
        .eq('owner_id', uid)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map(toMemory);
    },

    watchMemories(uid, cb) {
      const db = requireSupabase();

      const load = async () => {
        const { data } = await db
          .from('memories')
          .select('*')
          .eq('owner_id', uid)
          .order('created_at', { ascending: false });
        cb((data ?? []).map(toMemory));
      };

      void load();

      // contributor_count changes when someone else contributes, so the library
      // reacts to a guest on another device without a pull-to-refresh.
      const channel = db
        .channel(`memories:${uid}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'memories', filter: `owner_id=eq.${uid}` },
          () => void load()
        )
        .subscribe();

      return () => {
        void db.removeChannel(channel);
      };
    },

    async getMemory(id) {
      const { data, error } = await requireSupabase()
        .from('memories')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toMemory(data) : null;
    },

    async createMemory(uid, input: CreateMemoryInput) {
      const db = requireSupabase();

      // Upload first. A row pointing at a missing object is worse than no row.
      const memoryId = globalThis.crypto.randomUUID();
      const path = `${uid}/${memoryId}/original.jpg`;

      // Platform-aware: a Blob in the browser, raw bytes on device. See lib/image-bytes.
      const image = await readImageBytes(input.localImageUri);

      const { error: uploadError } = await db.storage
        .from(MEDIA_BUCKET)
        .upload(path, image.body, { contentType: image.contentType, upsert: true });
      if (uploadError) throw new Error(uploadError.message);

      const { data, error } = await db
        .from('memories')
        .insert({
          id: memoryId,
          owner_id: uid,
          title: input.title,
          memory_type: input.memoryType,
          image_path: path,
          image_width: input.imageWidth,
          image_height: input.imageHeight,
          original_remark: input.originalRemark,
          date_hint: input.dateHint,
          location_hint: input.locationHint,
          credited_to: input.creditedTo ?? null,
          invite_token: randomToken(),
        })
        .select()
        .single();

      if (error) {
        // Do not leave an orphaned object behind if the row failed.
        await db.storage.from(MEDIA_BUCKET).remove([path]).catch(() => {});
        throw new Error(error.message);
      }
      return toMemory(data);
    },

    async deleteMemory(id) {
      const db = requireSupabase();
      const { data: row } = await db
        .from('memories')
        .select('image_path')
        .eq('id', id)
        .maybeSingle();

      const { error } = await db.from('memories').delete().eq('id', id);
      if (error) throw new Error(error.message);

      // Rows cascade in Postgres; the object does not. "Users must be able to delete
      // their image" is a stated privacy rule, so the file goes too.
      if (row?.image_path) {
        await db.storage.from(MEDIA_BUCKET).remove([row.image_path]).catch(() => {});
      }
    },

    async setVisibility(id, v: Visibility) {
      const { error } = await requireSupabase()
        .from('memories')
        .update({ visibility: v })
        .eq('id', id);
      // The DB refuses `public` without an approved story; surface that plainly.
      if (error) throw new Error(error.message);
    },

    async imageUrl(path) {
      const { data, error } = await requireSupabase()
        .storage.from(MEDIA_BUCKET)
        .createSignedUrl(path, 900);
      if (error) throw new Error(error.message);
      return data.signedUrl;
    },

    inviteUrl(memory) {
      return buildInviteUrl(memory.inviteToken);
    },

    /* ----------------------------------------------------------- remarks */

    watchRemarks(memoryId, cb) {
      const db = requireSupabase();

      const load = async () => {
        const { data } = await db
          .from('remarks')
          .select('*')
          .eq('memory_id', memoryId)
          .order('created_at', { ascending: true });
        cb((data ?? []).map(toRemark));
      };

      void load();

      const channel = db
        .channel(`remarks:${memoryId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'remarks',
            filter: `memory_id=eq.${memoryId}`,
          },
          () => void load()
        )
        .subscribe();

      return () => {
        void db.removeChannel(channel);
      };
    },

    async setRemarkIncluded(memoryId, remarkId, included) {
      const { error } = await requireSupabase()
        .from('remarks')
        .update({ included })
        .eq('id', remarkId);
      if (error) throw new Error(error.message);
    },

    async deleteRemark(memoryId, remarkId) {
      const { error } = await requireSupabase().from('remarks').delete().eq('id', remarkId);
      if (error) throw new Error(error.message);
    },

    /* ------------------------------------------------------------- guest */

    async getGuestMemory(token): Promise<GuestMemoryView> {
      return callFunction<GuestMemoryView>('guest-memory', { token });
    },

    async submitGuestRemark(token, input: SubmitRemarkInput) {
      await callFunction('submit-remark', { token, remark: input });
    },

    async addReaction(token, reaction: Reaction) {
      await callFunction('add-reaction', { token, reaction });
    },

    /* ------------------------------------------------------- collections */

    async listCollections(uid) {
      const { data, error } = await requireSupabase()
        .from('collections')
        // The embedded count is what makes "4 memories" on a collection card cheap.
        .select('*, memory_collections(count)')
        .eq('owner_id', uid)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r: Row) => ({
        id: r.id,
        name: r.name,
        kind: r.kind,
        memoryCount: r.memory_collections?.[0]?.count ?? 0,
        createdAt: ms(r.created_at) ?? Date.now(),
      }));
    },

    async createCollection(uid, name, kind) {
      const { data, error } = await requireSupabase()
        .from('collections')
        .insert({ owner_id: uid, name: name.trim(), kind })
        .select()
        .single();
      if (error) {
        // The unique (owner_id, name) index is the real guard; translate it.
        if (error.code === '23505') throw new Error('You already have a collection with that name.');
        throw new Error(error.message);
      }
      return {
        id: data.id,
        name: data.name,
        kind: data.kind,
        memoryCount: 0,
        createdAt: ms(data.created_at) ?? Date.now(),
      };
    },

    async renameCollection(id, name) {
      const { error } = await requireSupabase()
        .from('collections')
        .update({ name: name.trim() })
        .eq('id', id);
      if (error) {
        if (error.code === '23505') throw new Error('You already have a collection with that name.');
        throw new Error(error.message);
      }
    },

    async deleteCollection(id) {
      // Memberships cascade; the memories themselves are untouched. Deleting a
      // collection must never delete photographs.
      const { error } = await requireSupabase().from('collections').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },

    async collectionsForMemory(memoryId) {
      const { data, error } = await requireSupabase()
        .from('memory_collections')
        .select('collection_id')
        .eq('memory_id', memoryId);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r: Row) => r.collection_id as string);
    },

    async setMemoryCollections(memoryId, collectionIds) {
      const db = requireSupabase();
      const { data: current } = await db
        .from('memory_collections')
        .select('collection_id')
        .eq('memory_id', memoryId);

      const before = new Set((current ?? []).map((r: Row) => r.collection_id as string));
      const after = new Set(collectionIds);

      const toAdd = collectionIds.filter((id) => !before.has(id));
      const toRemove = [...before].filter((id) => !after.has(id));

      // Diff rather than delete-all-then-insert, so `added_at` survives on
      // memberships that did not change.
      if (toRemove.length) {
        const { error } = await db
          .from('memory_collections')
          .delete()
          .eq('memory_id', memoryId)
          .in('collection_id', toRemove);
        if (error) throw new Error(error.message);
      }
      if (toAdd.length) {
        const { error } = await db
          .from('memory_collections')
          .insert(toAdd.map((collection_id) => ({ memory_id: memoryId, collection_id })));
        if (error) throw new Error(error.message);
      }
    },

    /* --------------------------------------------------- shared with me */

    async listSharedWithMe() {
      // Security-definer RPC: returns an explicit column list that excludes
      // invite_token and owner_id. See the migration for why this cannot be RLS.
      const { data, error } = await requireSupabase().rpc('memories_shared_with_me');
      if (error) throw new Error(error.message);
      return (data ?? []).map((r: Row) => ({
        id: r.id,
        title: r.title,
        memoryType: r.memory_type,
        imagePath: r.image_path,
        dateHint: r.date_hint,
        locationHint: r.location_hint,
        contributorCount: r.contributor_count,
        visibility: r.visibility,
        storyApprovedAt: ms(r.story_approved_at),
        createdAt: ms(r.created_at) ?? Date.now(),
        myRemarks: r.my_remarks ?? 0,
        lastContributedAt: ms(r.last_contributed),
      }));
    },

    async dashboardSummary() {
      const { data, error } = await requireSupabase().rpc('dashboard_summary');
      if (error) throw new Error(error.message);
      const row = (Array.isArray(data) ? data[0] : data) as Row | undefined;
      return {
        memoriesOwned: row?.memories_owned ?? 0,
        contributorsTotal: row?.contributors_total ?? 0,
        storiesApproved: row?.stories_approved ?? 0,
        storiesPublished: row?.stories_published ?? 0,
        collectionsCount: row?.collections_count ?? 0,
        sharedWithMe: row?.shared_with_me ?? 0,
      };
    },

    /* ------------------------------------------------------------- story */

    watchStory(memoryId, cb) {
      const db = requireSupabase();

      const load = async () => {
        const { data } = await db
          .from('stories')
          .select('*')
          .eq('memory_id', memoryId)
          .maybeSingle();
        cb(data ? toStory(data) : null);
      };

      void load();

      const channel = db
        .channel(`story:${memoryId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'stories',
            filter: `memory_id=eq.${memoryId}`,
          },
          () => void load()
        )
        .subscribe();

      return () => {
        void db.removeChannel(channel);
      };
    },

    async composeStory(memoryId) {
      const composed = await callFunction<Record<string, unknown>>('compose-story', {
        memoryId,
      });
      return StoryDoc.parse(composed);
    },

    async saveOwnerEdits(memoryId, edits) {
      const { error } = await requireSupabase()
        .from('stories')
        .update({ owner_edited_title: edits.title, owner_edited_story: edits.story })
        .eq('memory_id', memoryId);
      if (error) throw new Error(error.message);
    },

    async approveStory(memoryId) {
      // A trigger mirrors this onto the memory. Approval has one source of truth.
      const { error } = await requireSupabase()
        .from('stories')
        .update({ approved_at: new Date().toISOString() })
        .eq('memory_id', memoryId);
      if (error) throw new Error(error.message);
    },

    async unapproveStory(memoryId) {
      // The same trigger forces the memory private, so a published card cannot
      // outlive the approval it was published under.
      const { error } = await requireSupabase()
        .from('stories')
        .update({ approved_at: null })
        .eq('memory_id', memoryId);
      if (error) throw new Error(error.message);
    },
  };
}
