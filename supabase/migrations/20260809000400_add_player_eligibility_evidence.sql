alter table public.players
  add column if not exists mixed_pair_role text not null default 'unknown';
alter table public.players
  drop constraint if exists players_mixed_pair_role_check;
alter table public.players
  add constraint players_mixed_pair_role_check
  check (mixed_pair_role in ('man', 'woman', 'unknown'));
alter table public.team_roster_members
  add column if not exists rating_source text not null default 'unknown',
  add column if not exists mixed_pair_role text not null default 'unknown',
  add column if not exists age_division text,
  add column if not exists eligibility_verified_at timestamptz;
alter table public.team_roster_members
  drop constraint if exists team_roster_members_rating_source_check;
alter table public.team_roster_members
  add constraint team_roster_members_rating_source_check
  check (rating_source in ('verified', 'self', 'unknown'));
alter table public.team_roster_members
  drop constraint if exists team_roster_members_mixed_pair_role_check;
alter table public.team_roster_members
  add constraint team_roster_members_mixed_pair_role_check
  check (mixed_pair_role in ('man', 'woman', 'unknown'));
comment on column public.players.mixed_pair_role is
'Optional tennis-specific Mixed doubles eligibility used to validate one player in each Mixed team role without inferring from a name.';
comment on column public.team_roster_members.age_division is
'League-specific age eligibility evidenced by the imported official roster, such as 40 & Over.';
