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
