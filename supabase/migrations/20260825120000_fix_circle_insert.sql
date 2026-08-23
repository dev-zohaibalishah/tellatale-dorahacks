-- Creating a circle failed with "new row violates row-level security policy".
--
-- The insert itself was always fine. What failed was reading the row back in the same
-- statement, and the client always does that — `.insert(...).select().single()` is
-- INSERT ... RETURNING, and PostgreSQL applies the SELECT policy to what RETURNING
-- hands back.
--
-- That policy was `using (public.is_circle_member(id))`, and `is_circle_member` is
-- declared STABLE. A STABLE function sees the snapshot from the start of the
-- statement — which is the moment before the row it is being asked about existed. So
-- it looked for the new circle, could not find it, returned false, and the insert was
-- reported as an RLS violation even though the row had been written.
--
-- The tell was that a plain INSERT succeeded and only INSERT ... RETURNING failed.
-- The reason my testing missed it: every circle in those tests was seeded as the
-- service role, which bypasses RLS entirely, so the authenticated path this policy
-- governs was never actually exercised.
--
-- The fix is to answer the owner case from the row itself. `owner_id = auth.uid()`
-- reads a column of the row being checked, so there is no snapshot and no lookup —
-- and it is also the cheaper branch for the common case. Membership still goes
-- through the function, which is correct there because it asks about the *caller's*
-- membership rather than about the row.

drop policy if exists circles_select_member on public.circles;

create policy circles_select_member on public.circles
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or public.is_circle_member(id)
  );
