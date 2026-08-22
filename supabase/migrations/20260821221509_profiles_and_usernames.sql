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
