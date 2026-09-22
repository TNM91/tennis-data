alter table public.tiq_player_league_entries
  add column if not exists club_membership_id uuid references public.club_memberships(id) on delete set null;

alter table public.tiq_tournament_entries
  add column if not exists club_membership_id uuid references public.club_memberships(id) on delete set null;

create index if not exists tiq_player_league_entries_club_membership_idx
  on public.tiq_player_league_entries (club_membership_id)
  where club_membership_id is not null;

create index if not exists tiq_tournament_entries_club_membership_idx
  on public.tiq_tournament_entries (club_membership_id)
  where club_membership_id is not null;

update public.tiq_player_league_entries entry
set club_membership_id = membership.id
from public.tiq_leagues league,
     public.club_memberships membership
where entry.club_membership_id is null
  and league.id = entry.league_id
  and league.club_id is not null
  and membership.club_id = league.club_id
  and membership.status <> 'removed'
  and lower(regexp_replace(trim(entry.player_name), '[^a-z0-9]+', ' ', 'gi')) =
      lower(regexp_replace(trim(coalesce(nullif(membership.display_name, ''), membership.email)), '[^a-z0-9]+', ' ', 'gi'))
  and 1 = (
    select count(*)
    from public.club_memberships candidate
    where candidate.club_id = league.club_id
      and candidate.status <> 'removed'
      and lower(regexp_replace(trim(entry.player_name), '[^a-z0-9]+', ' ', 'gi')) =
          lower(regexp_replace(trim(coalesce(nullif(candidate.display_name, ''), candidate.email)), '[^a-z0-9]+', ' ', 'gi'))
  );

update public.tiq_tournament_entries entry
set club_membership_id = membership.id
from public.tiq_tournaments tournament,
     public.club_memberships membership
where entry.club_membership_id is null
  and tournament.id = entry.tournament_id
  and tournament.club_id is not null
  and membership.club_id = tournament.club_id
  and membership.status <> 'removed'
  and (
    (nullif(lower(trim(entry.email)), '') is not null and lower(trim(entry.email)) = lower(trim(membership.email)))
    or (
      length(regexp_replace(entry.phone, '[^0-9]+', '', 'g')) >= 10
      and right(regexp_replace(entry.phone, '[^0-9]+', '', 'g'), 10) = right(regexp_replace(membership.phone, '[^0-9]+', '', 'g'), 10)
    )
  )
  and 1 = (
    select count(*)
    from public.club_memberships candidate
    where candidate.club_id = tournament.club_id
      and candidate.status <> 'removed'
      and (
        (nullif(lower(trim(entry.email)), '') is not null and lower(trim(entry.email)) = lower(trim(candidate.email)))
        or (
          length(regexp_replace(entry.phone, '[^0-9]+', '', 'g')) >= 10
          and right(regexp_replace(entry.phone, '[^0-9]+', '', 'g'), 10) = right(regexp_replace(candidate.phone, '[^0-9]+', '', 'g'), 10)
        )
      )
  );

drop policy if exists "Club staff can remove player league entries" on public.tiq_player_league_entries;
create policy "Club staff can remove player league entries"
on public.tiq_player_league_entries
for delete to authenticated
using (
  exists (
    select 1 from public.tiq_leagues league
    where league.id = league_id
      and league.club_id is not null
      and league.league_format = 'individual'
      and public.can_run_club_competition(league.club_id)
  )
);

drop policy if exists "Club staff can remove tournament entries" on public.tiq_tournament_entries;
create policy "Club staff can remove tournament entries"
on public.tiq_tournament_entries
for delete to authenticated
using (
  exists (
    select 1 from public.tiq_tournaments tournament
    where tournament.id = tournament_id
      and tournament.club_id is not null
      and tournament.entrant_type = 'players'
      and public.can_run_club_competition(tournament.club_id)
  )
);

comment on column public.tiq_player_league_entries.club_membership_id is
  'Exact Club member connected to a Club-managed individual league entry.';

comment on column public.tiq_tournament_entries.club_membership_id is
  'Exact Club member connected to a Club-managed player tournament entry.';
