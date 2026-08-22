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
