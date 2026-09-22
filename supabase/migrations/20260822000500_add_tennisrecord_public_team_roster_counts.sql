-- Aggregate source-labeled TennisRecord roster evidence for lightweight public
-- directory counts. This remains isolated from canonical team memberships.
create or replace view public.tennisrecord_public_team_roster_counts
with (security_invoker = false)
as
select
  membership.normalized_team_name,
  count(distinct membership.source_player_key)::integer as listed_player_count
from public.tennisrecord_staged_team_memberships membership
where btrim(membership.normalized_team_name) <> ''
group by membership.normalized_team_name;

revoke all on public.tennisrecord_public_team_roster_counts from public;
grant select on public.tennisrecord_public_team_roster_counts to anon, authenticated;

comment on view public.tennisrecord_public_team_roster_counts is
  'Read-only TennisRecord roster listing counts for public team discovery. These counts do not establish canonical TenAceIQ team membership.';
