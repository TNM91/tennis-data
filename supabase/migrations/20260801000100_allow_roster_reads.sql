alter table public.team_roster_members enable row level security;

drop policy if exists "Public can read team roster members" on public.team_roster_members;
create policy "Public can read team roster members"
on public.team_roster_members
for select
using (true);

drop policy if exists "Admins can manage team roster members" on public.team_roster_members;
create policy "Admins can manage team roster members"
on public.team_roster_members
for all
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);
