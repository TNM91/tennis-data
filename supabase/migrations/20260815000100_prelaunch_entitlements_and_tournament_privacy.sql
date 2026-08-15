-- Launch hardening: keep tournament contacts private and enforce paid creation paths.

create table if not exists public.tiq_tournament_contacts (
  tournament_id text not null references public.tiq_tournaments(id) on delete cascade,
  entrant_name text not null,
  phone text not null default '',
  sms_opt_in boolean not null default false,
  consent_note text not null default '',
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (tournament_id, entrant_name)
);

alter table public.tiq_tournament_entries
  add column if not exists preference_token_hash text,
  add column if not exists preference_token_expires_at timestamptz;

create unique index if not exists tiq_tournament_entries_preference_token_idx
  on public.tiq_tournament_entries (preference_token_hash)
  where preference_token_hash is not null;

create table if not exists public.api_rate_limits (
  scope text not null,
  key_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1,
  primary key (scope, key_hash, window_started_at)
);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from anon, authenticated;
grant all on table public.api_rate_limits to service_role;

create or replace function public.consume_api_rate_limit(
  target_scope text,
  target_key_hash text,
  target_limit integer,
  target_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_window timestamptz;
  next_count integer;
begin
  if target_limit < 1 or target_window_seconds < 1
    or char_length(target_scope) > 80 or char_length(target_key_hash) > 128 then
    return false;
  end if;

  current_window := to_timestamp(
    floor(extract(epoch from timezone('utc', now())) / target_window_seconds) * target_window_seconds
  );

  insert into public.api_rate_limits (scope, key_hash, window_started_at, request_count)
  values (target_scope, target_key_hash, current_window, 1)
  on conflict (scope, key_hash, window_started_at) do update
  set request_count = public.api_rate_limits.request_count + 1
  returning request_count into next_count;

  delete from public.api_rate_limits
  where window_started_at < timezone('utc', now()) - interval '2 days';

  return next_count <= target_limit;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, text, integer, integer) from public;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer) to service_role;

drop policy if exists "Public can submit TIQ tournament entries" on public.tiq_tournament_entries;
revoke insert on table public.tiq_tournament_entries from anon, authenticated;

insert into public.tiq_tournament_contacts (
  tournament_id,
  entrant_name,
  phone,
  sms_opt_in,
  consent_note,
  updated_by_user_id,
  updated_at
)
select
  tournament.id,
  contact.key,
  coalesce(contact.value ->> 'phone', ''),
  coalesce((contact.value ->> 'smsOptIn')::boolean, false),
  coalesce(contact.value ->> 'consentNote', ''),
  tournament.updated_by_user_id,
  tournament.updated_at
from public.tiq_tournaments tournament
cross join lateral jsonb_each(coalesce(tournament.contacts, '{}'::jsonb)) contact
on conflict (tournament_id, entrant_name) do update
set phone = excluded.phone,
    sms_opt_in = excluded.sms_opt_in,
    consent_note = excluded.consent_note,
    updated_by_user_id = excluded.updated_by_user_id,
    updated_at = excluded.updated_at;

alter table public.tiq_tournament_contacts enable row level security;

create or replace function public.can_manage_tiq_tournament(target_tournament_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1
    from public.tiq_tournaments tournament
    where tournament.id = target_tournament_id
      and (
        tournament.created_by_user_id = auth.uid()
        or (
          tournament.club_id is not null
          and public.can_run_club_competition(tournament.club_id)
        )
      )
  );
$$;

revoke all on function public.can_manage_tiq_tournament(text) from public;
grant execute on function public.can_manage_tiq_tournament(text) to authenticated, service_role;

drop policy if exists "Tournament managers read private contacts" on public.tiq_tournament_contacts;
create policy "Tournament managers read private contacts"
on public.tiq_tournament_contacts for select to authenticated
using (public.can_manage_tiq_tournament(tournament_id));

drop policy if exists "Tournament managers create private contacts" on public.tiq_tournament_contacts;
create policy "Tournament managers create private contacts"
on public.tiq_tournament_contacts for insert to authenticated
with check (
  public.can_manage_tiq_tournament(tournament_id)
  and updated_by_user_id = auth.uid()
);

drop policy if exists "Tournament managers update private contacts" on public.tiq_tournament_contacts;
create policy "Tournament managers update private contacts"
on public.tiq_tournament_contacts for update to authenticated
using (public.can_manage_tiq_tournament(tournament_id))
with check (
  public.can_manage_tiq_tournament(tournament_id)
  and updated_by_user_id = auth.uid()
);

drop policy if exists "Tournament managers delete private contacts" on public.tiq_tournament_contacts;
create policy "Tournament managers delete private contacts"
on public.tiq_tournament_contacts for delete to authenticated
using (public.can_manage_tiq_tournament(tournament_id));

revoke all on table public.tiq_tournament_contacts from anon;
grant select, insert, update, delete on table public.tiq_tournament_contacts to authenticated;
grant all on table public.tiq_tournament_contacts to service_role;

-- The legacy JSON field stays temporarily for rollback, but no browser role can read it.
revoke select on table public.tiq_tournaments from anon, authenticated;
grant select (
  id, name, format, entrant_type, status, starts_on, location_label,
  director_notes, entrants, results, is_public, created_by_user_id,
  updated_by_user_id, created_at, updated_at, schedule, entrant_player_ids,
  club_id, club_group_id, result_mode
) on table public.tiq_tournaments to anon, authenticated;

alter table public.profiles
  alter column tiq_individual_league_creator_enabled set default false;

update public.profiles
set tiq_individual_league_creator_enabled = false
where role <> 'admin'
  and coalesce(tiq_team_league_entry_enabled, false) = false
  and coalesce(tiq_individual_league_creator_enabled, false) = true;

create or replace function public.has_current_league_access(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1
    from public.profiles profile
    where profile.id = target_user_id
      and profile.tiq_team_league_entry_enabled = true
      and (
        profile.league_access_expires_at is null
        or profile.league_access_expires_at > timezone('utc', now())
      )
  );
$$;

create or replace function public.has_current_coach_access(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1
    from public.profiles profile
    where profile.id = target_user_id
      and profile.coach_subscription_active = true
      and profile.coach_subscription_status in ('trial', 'active')
      and (
        profile.coach_access_expires_at is null
        or profile.coach_access_expires_at > timezone('utc', now())
      )
  );
$$;

create or replace function public.has_current_full_court_access(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1
    from public.profiles profile
    where profile.id = target_user_id
      and profile.player_plus_subscription_active = true
      and profile.coach_subscription_active = true
      and profile.captain_subscription_active = true
      and profile.tiq_team_league_entry_enabled = true
      and (profile.player_plus_access_expires_at is null or profile.player_plus_access_expires_at > timezone('utc', now()))
      and (profile.coach_access_expires_at is null or profile.coach_access_expires_at > timezone('utc', now()))
      and (profile.captain_access_expires_at is null or profile.captain_access_expires_at > timezone('utc', now()))
      and (profile.league_access_expires_at is null or profile.league_access_expires_at > timezone('utc', now()))
  );
$$;

revoke all on function public.has_current_league_access(uuid) from public;
revoke all on function public.has_current_coach_access(uuid) from public;
revoke all on function public.has_current_full_court_access(uuid) from public;
grant execute on function public.has_current_league_access(uuid) to authenticated, service_role;
grant execute on function public.has_current_coach_access(uuid) to authenticated, service_role;
grant execute on function public.has_current_full_court_access(uuid) to authenticated, service_role;

drop policy if exists "Authenticated users can create TIQ leagues" on public.tiq_leagues;
create policy "Entitled users can create TIQ leagues"
on public.tiq_leagues for insert to authenticated
with check (
  created_by_user_id = auth.uid()
  and updated_by_user_id = auth.uid()
  and competition_layer = 'tiq'
  and (
    public.has_current_league_access(auth.uid())
    or (club_id is not null and public.can_run_club_competition(club_id))
  )
);

drop policy if exists "Authenticated users can create TIQ tournaments" on public.tiq_tournaments;
create policy "Entitled users can create TIQ tournaments"
on public.tiq_tournaments for insert to authenticated
with check (
  created_by_user_id = auth.uid()
  and updated_by_user_id = auth.uid()
  and (
    (club_id is not null and public.can_run_club_competition(club_id))
    or (
      public.has_current_league_access(auth.uid())
      and (
        public.has_current_full_court_access(auth.uid())
        or not exists (
          select 1 from public.tiq_tournaments existing
          where existing.created_by_user_id = auth.uid()
        )
      )
    )
  )
);

drop policy if exists "Users can insert own tactical scenarios" on public.tactical_scenarios;
create policy "Coach users can insert own tactical scenarios"
on public.tactical_scenarios for insert to authenticated
with check (auth.uid() = user_id and public.has_current_coach_access(auth.uid()));

drop policy if exists "Users can update own tactical scenarios" on public.tactical_scenarios;
create policy "Coach users can update own tactical scenarios"
on public.tactical_scenarios for update to authenticated
using (auth.uid() = user_id and public.has_current_coach_access(auth.uid()))
with check (auth.uid() = user_id and public.has_current_coach_access(auth.uid()));

drop policy if exists "Users can delete own tactical scenarios" on public.tactical_scenarios;
create policy "Coach users can delete own tactical scenarios"
on public.tactical_scenarios for delete to authenticated
using (auth.uid() = user_id and public.has_current_coach_access(auth.uid()));
