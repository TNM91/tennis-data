-- Keep the exact Team access rules while letting Postgres evaluate the signed-in
-- account once per query instead of repeatedly during roster and link reads.

drop policy if exists "Members can read own team profile links" on public.team_profile_links;
create policy "Members can read own team profile links"
  on public.team_profile_links
  for select
  to authenticated
  using (profile_user_id = (select auth.uid()));

drop policy if exists "Admins can manage team roster members" on public.team_roster_members;
create policy "Admins can manage team roster members"
  on public.team_roster_members
  for all
  to public
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );
