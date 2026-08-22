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
