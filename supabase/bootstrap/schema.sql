-- ============================================================================
-- TellaTale — complete database bootstrap
--
-- Every migration, concatenated in order, so a brand-new Supabase project can be
-- brought up in one paste into the SQL editor. Use this when you cannot run the
-- Supabase CLI; use `supabase db push` against supabase/migrations otherwise.
--
-- Safe to run once on an EMPTY project. It is not idempotent: re-running against
-- a project that already has these tables will error on the first CREATE TABLE,
-- which is the intended behaviour rather than silently altering live data.
--
-- After this completes there are three things the SQL editor cannot do:
--   1. Deploy the five Edge Functions (supabase functions deploy).
--   2. Set the function secrets (supabase secrets set).
--   3. Nothing else — auth needs no toggles; the app uses username + password.
-- ============================================================================

begin;

-- --------------------------------------------------------------------------
-- 20260821215526_core_schema.sql
-- --------------------------------------------------------------------------

-- TellaTale core schema.
--
-- Shape mirrors shared/story.ts. Postgres uses snake_case; the repository adapter
-- maps to the camelCase domain types, and that mapping is the only place the two
-- vocabularies meet.
--
-- Two structural decisions worth stating:
--
--   * `stories` is keyed by memory_id, not its own id. There is exactly one current
--     story per memory. Regeneration replaces it; history is not kept, because an
--     un-approved older draft has no meaning to anyone.
--   * `invite_token` is unique and indexed. Guest access is a token lookup performed
--     by an Edge Function under the service role — never by a client — so the token
--     is never exposed to a reader who does not already hold it.

create extension if not exists pgcrypto;

/* ----------------------------------------------------------------- enums */

create type memory_type as enum (
  'family', 'friendship', 'travel', 'celebration', 'community', 'work'
);

-- The contributor's own claim about their memory. 'think' renders as "I think",
-- 'unsure' as "not sure" — wording fixed by the MVP spec.
create type certainty as enum ('certain', 'think', 'unsure');

create type visibility as enum ('private', 'public');

create type reaction_kind as enum ('broughtBack', 'learned', 'wantToAdd');

/* -------------------------------------------------------------- memories */

create table public.memories (
  id                      uuid primary key default gen_random_uuid(),
  owner_id                uuid not null references auth.users (id) on delete cascade,
  title                   text not null check (char_length(title) between 1 and 120),
  memory_type             memory_type not null,
  image_path              text not null,
  image_width             integer,
  image_height            integer,
  -- The owner's words. Immutable through the client; see the guard trigger.
  original_remark         text not null check (char_length(original_remark) between 1 and 2000),
  date_hint               text check (char_length(date_hint) <= 80),
  location_hint           text check (char_length(location_hint) <= 120),
  visibility              visibility not null default 'private',
  invite_token            text not null unique check (invite_token ~ '^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{20}$'),
  contributor_count       integer not null default 0 check (contributor_count >= 0),
  story_approved_at       timestamptz,
  -- The uploader's attestation that they may share this image. Required at insert.
  permission_confirmed_at timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  -- A memory cannot be public without an approved story. Enforced as data, not as a
  -- code path, so no future endpoint can route around it.
  constraint public_requires_approval
    check (visibility = 'private' or story_approved_at is not null)
);

create index memories_owner_created_idx
  on public.memories (owner_id, created_at desc);

/* --------------------------------------------------------------- remarks */

create table public.remarks (
  id               uuid primary key default gen_random_uuid(),
  memory_id        uuid not null references public.memories (id) on delete cascade,
  -- Null for guests. Contributing without an account is the point.
  author_id        uuid references auth.users (id) on delete set null,
  contributor_name text not null check (char_length(contributor_name) between 1 and 60),
  relationship     text check (char_length(relationship) <= 60),
  body             text not null check (char_length(body) between 1 and 2000),
  certainty        certainty not null,
  date_hint        text check (char_length(date_hint) <= 80),
  location_hint    text check (char_length(location_hint) <= 120),
  -- The owner curates by exception: included by default, excluded deliberately.
  included         boolean not null default true,
  created_at       timestamptz not null default now()
);

create index remarks_memory_created_idx
  on public.remarks (memory_id, created_at);

/* --------------------------------------------------------------- stories */

create table public.stories (
  memory_id          uuid primary key references public.memories (id) on delete cascade,
  title              text not null,
  summary            text not null default '',
  -- Echo of the owner's account. Written server-side from the stored original, never
  -- from whatever the composer returned.
  owner_memory       text not null,
  -- [{ contributorName, text, certainty }] — wire names frozen to the MVP spec.
  perspectives       jsonb not null default '[]'::jsonb,
  image_observations text[] not null default '{}',
  uncertainties      text[] not null default '{}',
  story              text not null,
  provider           text not null check (provider in ('existing', 'local')),
  ai_assisted        boolean not null default false,
  source_remark_ids  uuid[] not null default '{}',
  -- Set only by the approve path. Publishing depends on it.
  approved_at        timestamptz,
  -- Owner edits live beside the composed fields, never on top of them, so
  -- regeneration is non-destructive and the card can mark itself edited honestly.
  owner_edited_title text,
  owner_edited_story text,
  generated_at       timestamptz not null default now()
);

/* ------------------------------------------------------------- reactions */

create table public.reactions (
  id         uuid primary key default gen_random_uuid(),
  memory_id  uuid not null references public.memories (id) on delete cascade,
  kind       reaction_kind not null,
  created_at timestamptz not null default now()
);

create index reactions_memory_idx on public.reactions (memory_id);

/* ------------------------------------------------------------ push tokens */

-- Firebase is used for exactly one thing: delivering pushes. The token lives here,
-- next to the user it belongs to, so revocation follows account deletion for free.
create table public.push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  fcm_token  text not null unique,
  platform   text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);

/* ----------------------------------------------------------- rate limits */

-- Guest endpoints are reachable by anyone holding a link. Without a ceiling a leaked
-- link is an open write endpoint.
create table public.rate_limits (
  bucket     text primary key,
  count      integer not null default 0,
  expires_at timestamptz not null
);

create index rate_limits_expires_idx on public.rate_limits (expires_at);

-- --------------------------------------------------------------------------
-- 20260821215639_guards_and_triggers.sql
-- --------------------------------------------------------------------------

-- Invariants that must hold no matter which endpoint is calling.
--
-- RLS decides *who* may touch a row. These triggers decide *what* may change on it,
-- which RLS cannot express at column granularity. Together they are where the
-- product's trust claims are actually enforced — not in the prompt, and not in the
-- client.

/* --------------------------------------------------------------- helpers */

-- Edge Functions run under the service role and legitimately write the fields a
-- client may not (contributor_count, composed stories, guest remarks). Everything
-- below exempts them and constrains everyone else.
create or replace function public.is_service_role()
returns boolean
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  ) = 'service_role';
$$;

/* ------------------------------------------------- memories: what may change */

create or replace function public.guard_memory_update()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();

  if public.is_service_role() then
    return new;
  end if;

  -- The owner's own words are immutable through the client. Whether editing them
  -- should ever be possible is an open product question; until it is answered the
  -- field cannot drift.
  if new.original_remark is distinct from old.original_remark then
    raise exception 'The original memory cannot be edited.' using errcode = '42501';
  end if;

  -- Rotating an invite token is a revocation, which needs a server-side path.
  if new.invite_token is distinct from old.invite_token then
    raise exception 'Invite tokens cannot be changed from the client.' using errcode = '42501';
  end if;

  if new.owner_id is distinct from old.owner_id then
    raise exception 'Ownership cannot be transferred.' using errcode = '42501';
  end if;

  if new.image_path is distinct from old.image_path then
    raise exception 'The image cannot be swapped after creation.' using errcode = '42501';
  end if;

  if new.permission_confirmed_at is distinct from old.permission_confirmed_at then
    raise exception 'The permission attestation cannot be rewritten.' using errcode = '42501';
  end if;

  -- Derived server-side. A client that could set these could fake a contributor
  -- count or an approval.
  if new.contributor_count is distinct from old.contributor_count then
    raise exception 'contributor_count is derived.' using errcode = '42501';
  end if;

  if new.story_approved_at is distinct from old.story_approved_at then
    raise exception 'Approve the story itself, not the memory.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger memories_guard_update
  before update on public.memories
  for each row execute function public.guard_memory_update();

-- On insert a client may not pre-set derived or privileged fields.
create or replace function public.guard_memory_insert()
returns trigger
language plpgsql
as $$
begin
  if public.is_service_role() then
    return new;
  end if;

  new.contributor_count := 0;
  new.story_approved_at := null;
  new.visibility := 'private';
  new.permission_confirmed_at := now();
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

create trigger memories_guard_insert
  before insert on public.memories
  for each row execute function public.guard_memory_insert();

/* ------------------------------------------- remarks: count + immutability */

create or replace function public.sync_contributor_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.memories
       set contributor_count = contributor_count + 1,
           updated_at = now()
     where id = new.memory_id;
    return new;
  else
    update public.memories
       set contributor_count = greatest(contributor_count - 1, 0),
           updated_at = now()
     where id = old.memory_id;
    return old;
  end if;
end;
$$;

create trigger remarks_count_insert
  after insert on public.remarks
  for each row execute function public.sync_contributor_count();

create trigger remarks_count_delete
  after delete on public.remarks
  for each row execute function public.sync_contributor_count();

-- "Admins can remove content, never edit it." The owner may flip `included` and may
-- delete a remark. They may not rewrite what somebody else said.
create or replace function public.guard_remark_update()
returns trigger
language plpgsql
as $$
begin
  if public.is_service_role() then
    return new;
  end if;

  if new.body is distinct from old.body
     or new.contributor_name is distinct from old.contributor_name
     or new.relationship is distinct from old.relationship
     or new.certainty is distinct from old.certainty
     or new.date_hint is distinct from old.date_hint
     or new.location_hint is distinct from old.location_hint
     or new.memory_id is distinct from old.memory_id
     or new.author_id is distinct from old.author_id then
    raise exception 'A contributor''s words cannot be edited. You can exclude or remove them.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger remarks_guard_update
  before update on public.remarks
  for each row execute function public.guard_remark_update();

/* ------------------------------------------------- stories: approval sync */

create or replace function public.guard_story_update()
returns trigger
language plpgsql
as $$
begin
  if public.is_service_role() then
    return new;
  end if;

  -- The composed record is the model's output plus the server's guardrails. From the
  -- client, only the owner's own edits and the approval flag may move.
  if new.title is distinct from old.title
     or new.summary is distinct from old.summary
     or new.owner_memory is distinct from old.owner_memory
     or new.perspectives is distinct from old.perspectives
     or new.image_observations is distinct from old.image_observations
     or new.uncertainties is distinct from old.uncertainties
     or new.story is distinct from old.story
     or new.provider is distinct from old.provider
     or new.ai_assisted is distinct from old.ai_assisted
     or new.source_remark_ids is distinct from old.source_remark_ids
     or new.generated_at is distinct from old.generated_at then
    raise exception 'Composed fields are server-owned. Edit ownerEdited* instead.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger stories_guard_update
  before update on public.stories
  for each row execute function public.guard_story_update();

-- Approval lives on the story; the memory mirrors it. Withdrawing approval also
-- forces the memory private, so a published card can never outlive the approval it
-- was published under.
create or replace function public.sync_story_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.approved_at is null then
    update public.memories
       set story_approved_at = null,
           visibility = 'private',
           updated_at = now()
     where id = new.memory_id;
  else
    update public.memories
       set story_approved_at = new.approved_at,
           updated_at = now()
     where id = new.memory_id;
  end if;
  return new;
end;
$$;

create trigger stories_sync_approval
  after insert or update of approved_at on public.stories
  for each row execute function public.sync_story_approval();

/* ------------------------------------------------------- rate limiting */

-- Fixed-window counter. Coarse, but it is the difference between an abusable public
-- endpoint and a survivable one, and it needs no extra infrastructure.
create or replace function public.consume_rate_limit(
  p_bucket text,
  p_limit  integer,
  p_window interval
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.rate_limits where expires_at < now();

  insert into public.rate_limits as rl (bucket, count, expires_at)
  values (p_bucket, 1, now() + p_window)
  on conflict (bucket) do update
    set count = rl.count + 1
  returning rl.count into v_count;

  return v_count <= p_limit;
end;
$$;

-- --------------------------------------------------------------------------
-- 20260821215706_row_level_security.sql
-- --------------------------------------------------------------------------

alter table public.memories    enable row level security;
alter table public.remarks     enable row level security;
alter table public.stories     enable row level security;
alter table public.reactions   enable row level security;
alter table public.push_tokens enable row level security;
alter table public.rate_limits enable row level security;

-- memories -------------------------------------------------------------------
-- Owner-only, in every direction. Guests never read this table directly: their
-- access is an invite-token lookup performed by an Edge Function under the service
-- role, which bypasses RLS. That is deliberate — a policy that could match on a
-- token would have to let an anonymous caller read rows to test it.

create policy memories_select_own on public.memories
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy memories_insert_own on public.memories
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy memories_update_own on public.memories
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy memories_delete_own on public.memories
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- remarks --------------------------------------------------------------------
-- The owner reads and curates. Inserts come from the guest Edge Function only, so
-- there is no client insert policy at all: a contributor cannot write here directly
-- even if they hold a valid token.

create policy remarks_select_owner on public.remarks
  for select to authenticated
  using (exists (
    select 1 from public.memories m
     where m.id = remarks.memory_id
       and m.owner_id = (select auth.uid())
  ));

create policy remarks_update_owner on public.remarks
  for update to authenticated
  using (exists (
    select 1 from public.memories m
     where m.id = remarks.memory_id
       and m.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.memories m
     where m.id = remarks.memory_id
       and m.owner_id = (select auth.uid())
  ));

create policy remarks_delete_owner on public.remarks
  for delete to authenticated
  using (exists (
    select 1 from public.memories m
     where m.id = remarks.memory_id
       and m.owner_id = (select auth.uid())
  ));

-- stories --------------------------------------------------------------------
-- Composition is server-side, so no client insert. The owner reads, edits their own
-- fields, and approves; the column guard trigger constrains which fields move.

create policy stories_select_owner on public.stories
  for select to authenticated
  using (exists (
    select 1 from public.memories m
     where m.id = stories.memory_id
       and m.owner_id = (select auth.uid())
  ));

create policy stories_update_owner on public.stories
  for update to authenticated
  using (exists (
    select 1 from public.memories m
     where m.id = stories.memory_id
       and m.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.memories m
     where m.id = stories.memory_id
       and m.owner_id = (select auth.uid())
  ));

-- reactions ------------------------------------------------------------------
-- Written by the guest Edge Function; the owner may read the tally.

create policy reactions_select_owner on public.reactions
  for select to authenticated
  using (exists (
    select 1 from public.memories m
     where m.id = reactions.memory_id
       and m.owner_id = (select auth.uid())
  ));

-- push tokens ----------------------------------------------------------------
-- A device registers its own token and may replace or revoke it. Nobody reads
-- anyone else's; the sender runs under the service role.

create policy push_tokens_select_own on public.push_tokens
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy push_tokens_insert_own on public.push_tokens
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy push_tokens_update_own on public.push_tokens
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy push_tokens_delete_own on public.push_tokens
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- rate_limits ----------------------------------------------------------------
-- Server-side bookkeeping. RLS is enabled with no policies, so every client role is
-- denied and only the service role (which bypasses RLS) can touch it.

-- --------------------------------------------------------------------------
-- 20260821215721_storage_bucket.sql
-- --------------------------------------------------------------------------

-- Private bucket. Owners read and write only under their own uid prefix; guests
-- never get a storage policy at all and instead receive a short-lived signed URL
-- minted by the guest Edge Function. No client ever holds a permanent media URL.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'memories',
  'memories',
  false,
  12582912,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Object paths are `<uid>/<memory_id>/original.jpg`, so the first path segment is
-- the ownership check.
create policy memories_objects_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy memories_objects_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy memories_objects_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy memories_objects_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- --------------------------------------------------------------------------
-- 20260821215746_harden_functions.sql
-- --------------------------------------------------------------------------

-- Pin search_path on every guard so a caller cannot shadow `public` and neuter them.
alter function public.is_service_role()      set search_path = public, pg_temp;
alter function public.guard_memory_update()  set search_path = public, pg_temp;
alter function public.guard_memory_insert()  set search_path = public, pg_temp;
alter function public.guard_remark_update()  set search_path = public, pg_temp;
alter function public.guard_story_update()   set search_path = public, pg_temp;

-- These are reachable at /rest/v1/rpc/... by default. consume_rate_limit is the one
-- that matters: an anonymous caller could otherwise inflate a bucket and lock a
-- legitimate guest out, or probe bucket names. Trigger functions are revoked too —
-- nothing should be able to invoke them outside the triggers that own them.
--
-- NOTE: revoking is_service_role() here was a mistake, corrected in
-- 20260821230559_fix_is_service_role_execute.sql. It is called by the guard
-- TRIGGERS, which run as the invoking user, so revoking it broke every client
-- insert and update with "permission denied for function is_service_role". The
-- revoke is left in place rather than edited out so the history stays honest and
-- the fix migration explains itself.
revoke all on function public.consume_rate_limit(text, integer, interval) from public, anon, authenticated;
revoke all on function public.sync_contributor_count()                    from public, anon, authenticated;
revoke all on function public.sync_story_approval()                       from public, anon, authenticated;
revoke all on function public.is_service_role()                           from public, anon, authenticated;

-- Only the service role, which is what the Edge Functions run as.
grant execute on function public.consume_rate_limit(text, integer, interval) to service_role;

-- --------------------------------------------------------------------------
-- 20260821221509_profiles_and_usernames.sql
-- --------------------------------------------------------------------------

-- Usernames.
--
-- Supabase Auth is email-keyed, and the product wants usernames. Rather than build a
-- second credential store — which would mean holding passwords ourselves, and we are
-- not doing that — a username maps deterministically onto a synthetic address:
--
--     abc  ->  abc@tellatale.app
--
-- Auth keeps the bcrypt hash. This table keeps the identity. The mapping is pure, so
-- sign-in needs no lookup and there is no endpoint that confirms whether a username
-- exists.

create extension if not exists citext;

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  -- citext: usernames are case-insensitive for matching, but the chosen casing is
  -- preserved for display.
  username     citext not null unique
                 check (username ~ '^[a-zA-Z0-9_]{3,24}$'),
  display_name text check (char_length(display_name) <= 60),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A signed-in user reads and edits their own profile. Nobody enumerates the table:
-- there is no policy that exposes another person's row, because contributor names on
-- a memory are free text, not account references.
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Inserts come from the signup Edge Function under the service role, in the same
-- step that creates the auth user. No client insert policy: a profile without a
-- matching auth user, or vice versa, is a broken account.

create or replace function public.touch_profile()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  -- The username is the account's identity and is referenced by the synthetic email
  -- already issued to Auth. Changing it here would silently break sign-in.
  if new.username is distinct from old.username then
    raise exception 'Usernames cannot be changed.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_profile();

-- --------------------------------------------------------------------------
-- 20260821224724_collections_and_shared.sql
-- --------------------------------------------------------------------------

/* ------------------------------------------------------------- collections */

-- Groups a memory can belong to. The Heirloom prototype called these "circles" and
-- fixed them to four types; the StoryImage POC called them groups and collections.
-- This is the reconciliation: a free-form named collection with a type attribute,
-- which is what the prototype's own open question proposed.
create table public.collections (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  -- Reuses memory_type so a collection and a memory speak the same vocabulary.
  kind        memory_type not null default 'family',
  created_at  timestamptz not null default now(),
  unique (owner_id, name)
);

create index collections_owner_idx on public.collections (owner_id, created_at desc);

-- Many-to-many: a photograph can belong to "Nani's house" and "Murree 1987" at once.
create table public.memory_collections (
  memory_id     uuid not null references public.memories (id) on delete cascade,
  collection_id uuid not null references public.collections (id) on delete cascade,
  added_at      timestamptz not null default now(),
  primary key (memory_id, collection_id)
);

create index memory_collections_collection_idx
  on public.memory_collections (collection_id);

alter table public.collections        enable row level security;
alter table public.memory_collections enable row level security;

create policy collections_own on public.collections
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Membership follows the memory's owner, not the collection's, so a row can never
-- link someone else's photograph into your collection.
create policy memory_collections_own on public.memory_collections
  for all to authenticated
  using (exists (
    select 1 from public.memories m
     where m.id = memory_collections.memory_id
       and m.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.memories m
     where m.id = memory_collections.memory_id
       and m.owner_id = (select auth.uid())
  ));

/* ---------------------------------------------------- shared with me */

-- A contributor may want to find what they added later. That needs identity, and
-- contributors are anonymous by default — so remarks carry author_id only when the
-- person happened to be signed in. The account-free path is unchanged.
--
-- This CANNOT be an RLS policy on `memories`: that table holds invite_token, and any
-- policy letting a contributor read the row would hand them the credential that
-- grants write access. A security-definer function returning an explicit column list
-- is the safe shape — note the absence of invite_token and owner_id below.
create or replace function public.memories_shared_with_me()
returns table (
  id                uuid,
  title             text,
  memory_type       memory_type,
  image_path        text,
  date_hint         text,
  location_hint     text,
  contributor_count integer,
  visibility        visibility,
  story_approved_at timestamptz,
  created_at        timestamptz,
  my_remarks        integer,
  last_contributed  timestamptz
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select
    m.id,
    m.title,
    m.memory_type,
    m.image_path,
    m.date_hint,
    m.location_hint,
    m.contributor_count,
    m.visibility,
    m.story_approved_at,
    m.created_at,
    count(r.id)::int  as my_remarks,
    max(r.created_at) as last_contributed
  from public.memories m
  join public.remarks r
    on r.memory_id = m.id
   and r.author_id = auth.uid()
  -- Your own memories belong in the other tab; this is what other people shared.
  where m.owner_id <> auth.uid()
  group by m.id
  order by max(r.created_at) desc;
$$;

revoke all on function public.memories_shared_with_me() from public, anon;
grant execute on function public.memories_shared_with_me() to authenticated;

/* ------------------------------------------------------------- dashboard */

-- One round trip for the header counts instead of four.
create or replace function public.dashboard_summary()
returns table (
  memories_owned     integer,
  contributors_total integer,
  stories_approved   integer,
  stories_published  integer,
  collections_count  integer,
  shared_with_me     integer
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select
    (select count(*)::int from public.memories where owner_id = auth.uid()),
    (select coalesce(sum(contributor_count), 0)::int from public.memories where owner_id = auth.uid()),
    (select count(*)::int from public.memories where owner_id = auth.uid() and story_approved_at is not null),
    (select count(*)::int from public.memories where owner_id = auth.uid() and visibility = 'public'),
    (select count(*)::int from public.collections where owner_id = auth.uid()),
    (select count(distinct m.id)::int
       from public.memories m
       join public.remarks r on r.memory_id = m.id and r.author_id = auth.uid()
      where m.owner_id <> auth.uid());
$$;

revoke all on function public.dashboard_summary() from public, anon;
grant execute on function public.dashboard_summary() to authenticated;

-- --------------------------------------------------------------------------
-- 20260821230559_fix_is_service_role_execute.sql
-- --------------------------------------------------------------------------

-- Regression fix.
--
-- `is_service_role()` was revoked from anon/authenticated in
-- 20260821215746_harden_functions.sql while tightening the RPC surface. But it is
-- called by the guard TRIGGERS, which run as the invoking user — so revoking it made
-- every insert and update fail with
-- "permission denied for function is_service_role". The security lint was right that
-- functions should not be casually exposed, and wrong about this one.
--
-- Re-granting is safe: the function takes no arguments, touches no table, and only
-- reports whether the caller's own JWT claims say `service_role`. It cannot be used
-- to discover anything the caller does not already possess.
--
-- SECURITY INVOKER is deliberate — as DEFINER it would always report the definer's
-- role and the guards would wave every client write straight through.
grant execute on function public.is_service_role() to authenticated, anon;

-- --------------------------------------------------------------------------
-- 20260822000001_credited_storyteller.sql
-- --------------------------------------------------------------------------

-- "Someone else is telling this — credit the story to Nani."
--
-- The person who types a memory is often not the person whose memory it is: an
-- adult holds the phone while their grandmother talks. Without this, the archive
-- would permanently record the typist as the rememberer, which is precisely the
-- attribution error the whole product exists to prevent.
--
-- Free text, not a reference. The people most often credited are exactly the ones
-- who will never have an account.
alter table public.memories
  add column credited_to text check (char_length(credited_to) <= 60);

comment on column public.memories.credited_to is
  'Display name of the person whose memory this is, when that is not the owner. Null means the owner is the teller.';


/* =========================================================================
   10 — editable profiles (20260823120000_editable_profiles.sql)
   ========================================================================= */

-- Editable profiles.
--
-- The profiles table was created to solve one problem — mapping a username onto the
-- synthetic email Auth is keyed by — and it has carried nothing else since. This adds
-- the fields a person actually edits: a picture, a line about themselves, and where
-- they are.
--
-- Username stays immutable and the existing trigger keeps enforcing that. It is not a
-- display detail: it is baked into the synthetic address already issued to Auth, so
-- changing it here would silently break sign-in for that account.

alter table public.profiles
  add column if not exists avatar_path text,
  add column if not exists bio          text,
  add column if not exists location     text;

-- Bounded because these render inside fixed layouts, and because an unbounded text
-- column on a user-writable row is a storage-cost bug waiting to be found.
alter table public.profiles
  drop constraint if exists profiles_bio_length;
alter table public.profiles
  add constraint profiles_bio_length check (bio is null or char_length(bio) <= 280);

alter table public.profiles
  drop constraint if exists profiles_location_length;
alter table public.profiles
  add constraint profiles_location_length
    check (location is null or char_length(location) <= 60);

-- avatar_path must live under the owner's own uid prefix.
--
-- RLS already stops one person writing another's profile row, and storage policies
-- already stop them writing another's object — but neither stops a client pointing
-- its own avatar_path at somebody else's object path. Nothing today would leak from
-- that (a signed URL is only mintable by someone who can read the object), yet it is
-- the kind of dangling reference that becomes a leak the moment the bucket is made
-- public or an avatar is exposed on a shared memory. Cheaper to forbid now.
alter table public.profiles
  drop constraint if exists profiles_avatar_path_own_prefix;
alter table public.profiles
  add constraint profiles_avatar_path_own_prefix
    check (avatar_path is null or avatar_path like (id::text || '/%'));

/* ------------------------------------------------------------------ storage */

-- A separate bucket from `memories`, not a folder inside it.
--
-- The two have genuinely different rules: an avatar is small, square, replaced in
-- place, and deleted when the person clears it; a memory original is large, kept
-- forever, and deleted only with its row. Sharing one bucket would mean one size
-- limit and one MIME list serving both, and a `remove()` bug in either path able to
-- reach the other's files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  2097152,                              -- 2 MB; the client downscales to 512px first
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Object paths are `<uid>/avatar-<n>.jpg`, so the first segment is the owner check —
-- the same shape the memories bucket uses.
drop policy if exists avatars_select_own on storage.objects;
create policy avatars_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;
