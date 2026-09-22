alter table public.team_profile_links
  add column if not exists is_default boolean not null default false;

with ranked_links as (
  select
    links.id,
    row_number() over (
      partition by links.profile_user_id
      order by
        case
          when lower(trim(links.team_name)) = lower(trim(coalesce(profiles.linked_team_name, '')))
            and lower(trim(links.league_name)) = lower(trim(coalesce(profiles.linked_league_name, '')))
            and lower(trim(links.flight)) = lower(trim(coalesce(profiles.linked_flight, '')))
          then 0 else 1
        end,
        links.updated_at desc,
        links.id
    ) as rank
  from public.team_profile_links links
  left join public.profiles profiles on profiles.id = links.profile_user_id
  where links.status = 'accepted'
)
update public.team_profile_links links
set is_default = ranked_links.rank = 1
from ranked_links
where links.id = ranked_links.id;

create unique index if not exists team_profile_links_one_default_per_profile_idx
  on public.team_profile_links (profile_user_id)
  where is_default = true and status = 'accepted';

create index if not exists team_profile_links_default_lookup_idx
  on public.team_profile_links (profile_user_id, is_default, updated_at desc);
