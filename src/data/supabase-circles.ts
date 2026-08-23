/**
 * Circles, requests and face names — the Supabase half.
 *
 * Split out of `supabase-repo.ts` because that file had grown past the point where a
 * reader could hold it, and because these three tables are one idea: a family exists,
 * it asks each other questions, and it knows who is in the photographs. They arrived
 * together and they will change together.
 *
 * The read boundary lives in the migration, not here. A circle member can see a memory
 * only when it was posted as an answer to a question asked in their circle — so these
 * queries do not filter by owner and do not need to. RLS answers "whose is this"; this
 * file answers "what shape is it".
 */

import { requireSupabase } from '../supabase/client';
import { randomToken } from '../lib/id';
import type {
  Circle,
  CircleMember,
  FaceName,
  MemoryRequest,
  RequestAnswer,
} from './repository';

type Row = Record<string, any>;

const ms = (v: string | null | undefined): number | null => (v ? Date.parse(v) : null);

const CIRCLE_COLUMNS = 'id, name, invite_token, owner_id, created_at';
const MEMBER_COLUMNS = 'id, user_id, display_name, relationship, joined_at';
const REQUEST_COLUMNS = 'id, circle_id, question, asked_by, created_at, closed_at';
const FACE_COLUMNS = 'id, memory_id, name, relationship, created_at';

function toCircle(r: Row, uid: string): Circle {
  return {
    id: r.id,
    name: r.name,
    inviteToken: r.invite_token,
    isOwner: r.owner_id === uid,
    createdAt: ms(r.created_at) ?? Date.now(),
  };
}

function toMember(r: Row): CircleMember {
  return {
    id: r.id,
    uid: r.user_id ?? null,
    displayName: r.display_name,
    relationship: r.relationship ?? null,
    joinedAt: ms(r.joined_at),
  };
}

function toFaceName(r: Row): FaceName {
  return {
    id: r.id,
    memoryId: r.memory_id,
    name: r.name,
    relationship: r.relationship ?? null,
    createdAt: ms(r.created_at) ?? Date.now(),
  };
}

/**
 * Resolves display names for a set of account ids in one query.
 *
 * Every list on these screens needs "who asked" or "who answered", and doing that per
 * row is an N+1 on a screen reached straight from the home page. A family is small, so
 * one `in` query covers the whole list.
 */
async function namesFor(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  const out = new Map<string, string>();
  if (unique.length === 0) return out;

  const { data } = await requireSupabase()
    .from('profiles')
    .select('id, display_name, username')
    .in('id', unique);

  for (const p of data ?? []) out.set(p.id, p.display_name ?? p.username);
  return out;
}

async function currentUserId(): Promise<string | null> {
  const { data } = await requireSupabase().auth.getUser();
  return data.user?.id ?? null;
}

/* ------------------------------------------------------------------ circles */

export async function getCircle(uid: string): Promise<Circle | null> {
  // RLS already limits this to circles the caller owns or has joined, so no filter is
  // needed — and adding one would silently hide a circle they were invited into.
  const { data, error } = await requireSupabase()
    .from('circles')
    .select(CIRCLE_COLUMNS)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toCircle(data, uid) : null;
}

export async function createCircle(uid: string, name: string): Promise<Circle> {
  const { data, error } = await requireSupabase()
    .from('circles')
    .insert({ owner_id: uid, name: name.trim(), invite_token: randomToken() })
    .select(CIRCLE_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return toCircle(data, uid);
}

export async function listMembers(circleId: string): Promise<CircleMember[]> {
  const { data, error } = await requireSupabase()
    .from('circle_members')
    .select(MEMBER_COLUMNS)
    .eq('circle_id', circleId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toMember);
}

export async function addMember(
  circleId: string,
  displayName: string,
  relationship: string | null
): Promise<CircleMember> {
  const { data, error } = await requireSupabase()
    .from('circle_members')
    .insert({
      circle_id: circleId,
      display_name: displayName.trim(),
      relationship: relationship?.trim() || null,
    })
    .select(MEMBER_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return toMember(data);
}

export async function removeMember(memberId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('circle_members')
    .delete()
    .eq('id', memberId);
  if (error) throw new Error(error.message);
}

/* ----------------------------------------------------------------- requests */

export async function listRequests(circleId: string): Promise<MemoryRequest[]> {
  const db = requireSupabase();
  const { data, error } = await db
    .from('memory_requests')
    .select(REQUEST_COLUMNS)
    .eq('circle_id', circleId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((r: Row) => r.id);
  const [answers, names, myId] = await Promise.all([
    db.from('memories').select('request_id').in('request_id', ids),
    namesFor(rows.map((r: Row) => r.asked_by)),
    currentUserId(),
  ]);

  const counts = new Map<string, number>();
  for (const a of answers.data ?? []) {
    counts.set(a.request_id, (counts.get(a.request_id) ?? 0) + 1);
  }

  return rows.map((r: Row) => ({
    id: r.id,
    circleId: r.circle_id,
    question: r.question,
    askedByName: names.get(r.asked_by) ?? 'Someone',
    askedByMe: r.asked_by === myId,
    answerCount: counts.get(r.id) ?? 0,
    createdAt: ms(r.created_at) ?? Date.now(),
    closedAt: ms(r.closed_at),
  }));
}

export async function createRequest(
  circleId: string,
  question: string
): Promise<MemoryRequest> {
  const db = requireSupabase();
  const myId = await currentUserId();
  if (!myId) throw new Error('You are not signed in.');

  const { data, error } = await db
    .from('memory_requests')
    .insert({ circle_id: circleId, asked_by: myId, question: question.trim() })
    .select(REQUEST_COLUMNS)
    .single();
  if (error) throw new Error(error.message);

  return {
    id: data.id,
    circleId: data.circle_id,
    question: data.question,
    askedByName: 'You',
    askedByMe: true,
    answerCount: 0,
    createdAt: ms(data.created_at) ?? Date.now(),
    closedAt: ms(data.closed_at),
  };
}

export async function closeRequest(requestId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('memory_requests')
    .update({ closed_at: new Date().toISOString() })
    .eq('id', requestId);
  if (error) throw new Error(error.message);
}

export async function listAnswers(requestId: string): Promise<RequestAnswer[]> {
  const db = requireSupabase();
  const { data, error } = await db
    .from('memories')
    .select(
      'id, owner_id, title, image_path, original_remark, date_hint, location_hint, contributor_count, created_at'
    )
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const [names, myId] = await Promise.all([
    namesFor(rows.map((r: Row) => r.owner_id)),
    currentUserId(),
  ]);

  return rows.map((r: Row) => ({
    id: r.id,
    title: r.title,
    imagePath: r.image_path,
    ownerName: names.get(r.owner_id) ?? 'Someone',
    ownedByMe: r.owner_id === myId,
    originalRemark: r.original_remark,
    dateHint: r.date_hint,
    locationHint: r.location_hint,
    contributorCount: r.contributor_count,
    createdAt: ms(r.created_at) ?? Date.now(),
  }));
}

export async function answerRequest(
  requestId: string,
  memoryId: string
): Promise<void> {
  const { error } = await requireSupabase()
    .from('memories')
    .update({ request_id: requestId })
    .eq('id', memoryId);
  if (error) throw new Error(error.message);
}

/* --------------------------------------------------------------- face names */

export async function listFaceNames(memoryId: string): Promise<FaceName[]> {
  const { data, error } = await requireSupabase()
    .from('face_names')
    .select(FACE_COLUMNS)
    .eq('memory_id', memoryId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toFaceName);
}

export async function addFaceName(
  memoryId: string,
  name: string,
  relationship: string | null
): Promise<FaceName> {
  const { data, error } = await requireSupabase()
    .from('face_names')
    .insert({
      memory_id: memoryId,
      name: name.trim(),
      relationship: relationship?.trim() || null,
    })
    .select(FACE_COLUMNS)
    .single();
  if (error) {
    // The unique constraint is a feature, not a failure: naming the same person twice
    // on one photograph makes the list stop being useful. Say so in words.
    if (error.code === '23505') {
      throw new Error(`${name.trim()} is already named in this photo.`);
    }
    throw new Error(error.message);
  }
  return toFaceName(data);
}

export async function removeFaceName(faceId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('face_names')
    .delete()
    .eq('id', faceId);
  if (error) throw new Error(error.message);
}
