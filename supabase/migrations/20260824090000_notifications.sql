-- Notifications.
--
-- The screen existed and invented its contents: it listed every memory with a
-- contributor count above zero and called each one an event. So one memory that three
-- people added to was a single row, adding a fourth changed nothing visible, and the
-- timestamp shown was the memory's `updated_at` — which moves for reasons that have
-- nothing to do with anybody contributing. Nothing was ever marked read, because there
-- was nothing to mark.
--
-- This records the events themselves.
--
-- Rows are written by triggers rather than by the Edge Functions that happen to cause
-- them. A remark can arrive from `submit-remark` under the service role or from a
-- signed-in contributor through PostgREST, and a notification that only fires on one
-- of those paths is a notification that silently stops working the day the other path
-- gets used. The trigger sits under both.

create type notification_kind as enum ('remark_added', 'reaction_added');

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  -- The recipient. Always the memory's owner today; a column rather than a join so
  -- that stays true when memories gain more than one interested party.
  user_id    uuid not null references auth.users (id) on delete cascade,
  memory_id  uuid not null references public.memories (id) on delete cascade,
  kind       notification_kind not null,
  -- Free text, copied at write time. Contributors have no account, so there is no
  -- row to join to for a name — and even for a signed-in contributor, the name that
  -- belongs on this event is the one they used on the day.
  actor_name text check (char_length(actor_name) <= 60),
  -- A short quote, so the list says what happened rather than that something did.
  preview    text check (char_length(preview) <= 140),
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

-- The screen's only query: this user's rows, newest first. Partial index on unread
-- because the badge asks that question on every app launch.
create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index notifications_unread_idx
  on public.notifications (user_id)
  where read_at is null;

alter table public.notifications enable row level security;

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Marking read is the only client write, and the guard below narrows it to exactly
-- that. No insert policy: a client that can write its own notifications can forge
-- "someone added to your memory", which is the one claim this table exists to make
-- truthfully.
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy notifications_delete_own on public.notifications
  for delete to authenticated
  using (user_id = (select auth.uid()));

/* ------------------------------------------------------------------ guard */

create or replace function public.guard_notification_update()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Everything except read_at is a record of something that happened. The owner may
  -- acknowledge it; they may not rewrite it.
  if new.user_id  is distinct from old.user_id
     or new.memory_id  is distinct from old.memory_id
     or new.kind       is distinct from old.kind
     or new.actor_name is distinct from old.actor_name
     or new.preview    is distinct from old.preview
     or new.created_at is distinct from old.created_at then
    raise exception 'Only read_at can be changed.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger notifications_guard_update
  before update on public.notifications
  for each row execute function public.guard_notification_update();

/* --------------------------------------------------------------- triggers */

create or replace function public.notify_owner_of_remark()
returns trigger
language plpgsql
-- security definer: the insert must succeed for a guest with no account and no
-- table privileges. The function is the only thing that can write this table.
security definer
set search_path = public, pg_temp
as $$
declare
  owner uuid;
begin
  select owner_id into owner from public.memories where id = new.memory_id;
  if owner is null then
    return new;
  end if;

  -- Do not notify someone about their own contribution to their own memory.
  if new.author_id is not null and new.author_id = owner then
    return new;
  end if;

  insert into public.notifications (user_id, memory_id, kind, actor_name, preview, created_at)
  values (
    owner,
    new.memory_id,
    'remark_added',
    new.contributor_name,
    -- Enough to recognise, not enough to replace opening it.
    left(new.body, 140),
    -- The remark's own timestamp, not the trigger's clock. Identical in the normal
    -- case, and the difference is what keeps a backfill or an import from stamping
    -- a decade of history as having all happened this afternoon.
    new.created_at
  );
  return new;
end;
$$;

create trigger remarks_notify_owner
  after insert on public.remarks
  for each row execute function public.notify_owner_of_remark();

create or replace function public.notify_owner_of_reaction()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owner uuid;
begin
  select owner_id into owner from public.memories where id = new.memory_id;
  if owner is null then
    return new;
  end if;

  insert into public.notifications (user_id, memory_id, kind, actor_name, preview, created_at)
  values (owner, new.memory_id, 'reaction_added', null, new.kind::text, new.created_at);
  return new;
end;
$$;

create trigger reactions_notify_owner
  after insert on public.reactions
  for each row execute function public.notify_owner_of_reaction();

/* ------------------------------------------------------------- mark read */

-- One statement, one round trip, and it cannot touch anybody else's rows because the
-- security-definer body pins user_id to the caller rather than trusting an argument.
create or replace function public.mark_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  touched integer;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  update public.notifications
     set read_at = now()
   where user_id = auth.uid()
     and read_at is null;

  get diagnostics touched = row_count;
  return touched;
end;
$$;

revoke all on function public.mark_notifications_read() from public;
grant execute on function public.mark_notifications_read() to authenticated;
