create table if not exists public.player_schedule_responses (
  id uuid primary key default gen_random_uuid(),
  player_user_id uuid not null references auth.users(id) on delete cascade,
  competition_kind text not null check (competition_kind in ('league', 'tournament')),
  competition_id text not null,
  event_id text not null,
  response text not null check (response in ('available', 'unavailable')),
  event_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint player_schedule_responses_event_unique
    unique (player_user_id, competition_kind, competition_id, event_id)
);

create index if not exists player_schedule_responses_player_idx
  on public.player_schedule_responses (player_user_id, updated_at desc);

create index if not exists player_schedule_responses_competition_idx
  on public.player_schedule_responses (competition_kind, competition_id, updated_at desc);

create or replace function public.set_player_schedule_response_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_player_schedule_response_updated_at on public.player_schedule_responses;
create trigger set_player_schedule_response_updated_at
before update on public.player_schedule_responses
for each row
execute function public.set_player_schedule_response_updated_at();

create or replace function public.is_tiq_competition_director(
  p_competition_kind text,
  p_competition_id text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_competition_kind = 'league' then exists (
      select 1 from public.tiq_leagues league
      where league.id::text = p_competition_id
        and league.created_by_user_id = auth.uid()
    )
    when p_competition_kind = 'tournament' then exists (
      select 1 from public.tiq_tournaments tournament
      where tournament.id::text = p_competition_id
        and tournament.created_by_user_id = auth.uid()
    )
    else false
  end;
$$;

revoke all on function public.is_tiq_competition_director(text, text) from public;
grant execute on function public.is_tiq_competition_director(text, text) to authenticated;

alter table public.player_schedule_responses enable row level security;

drop policy if exists "Players can read their schedule responses" on public.player_schedule_responses;
create policy "Players can read their schedule responses"
on public.player_schedule_responses
for select
to authenticated
using (player_user_id = auth.uid());

drop policy if exists "Players can add their schedule responses" on public.player_schedule_responses;
create policy "Players can add their schedule responses"
on public.player_schedule_responses
for insert
to authenticated
with check (player_user_id = auth.uid());

drop policy if exists "Players can update their schedule responses" on public.player_schedule_responses;
create policy "Players can update their schedule responses"
on public.player_schedule_responses
for update
to authenticated
using (player_user_id = auth.uid())
with check (player_user_id = auth.uid());

drop policy if exists "Competition directors can read schedule responses" on public.player_schedule_responses;
create policy "Competition directors can read schedule responses"
on public.player_schedule_responses
for select
to authenticated
using (public.is_tiq_competition_director(competition_kind, competition_id));

create or replace function public.notify_tiq_league_schedule_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status not in ('confirmed', 'coordinator_set') then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.scheduled_date is not distinct from new.scheduled_date
    and old.scheduled_time is not distinct from new.scheduled_time
    and old.facility is not distinct from new.facility
    and old.status is not distinct from new.status then
    return new;
  end if;

  insert into public.internal_notifications (
    recipient_profile_id,
    actor_user_id,
    notification_type,
    title,
    body,
    href
  )
  select distinct
    entry.created_by_user_id,
    new.updated_by_user_id,
    'schedule',
    case
      when tg_op = 'INSERT' then 'League match scheduled'
      when old.status not in ('confirmed', 'coordinator_set') then 'League match scheduled'
      else 'League match changed'
    end,
    concat_ws(
      ' · ',
      new.participant_a_name || ' vs ' || new.participant_b_name,
      to_char(new.scheduled_date, 'Mon FMDD'),
      nullif(to_char(new.scheduled_time, 'FMHH12:MI AM'), ''),
      nullif(trim(new.facility), '')
    ),
    '/compete/schedule#event-' || new.id::text
  from public.tiq_player_league_entries entry
  where entry.league_id::text = new.league_id::text
    and entry.entry_status = 'active'
    and entry.created_by_user_id is not null
    and entry.created_by_user_id is distinct from new.updated_by_user_id
    and (
      (
        nullif(trim(coalesce(entry.player_id, '')), '') is not null
        and entry.player_id::text in (
          coalesce(new.participant_a_id::text, ''),
          coalesce(new.participant_b_id::text, '')
        )
      )
      or lower(trim(entry.player_name)) in (
        lower(trim(new.participant_a_name)),
        lower(trim(new.participant_b_name))
      )
    );

  return new;
end;
$$;

drop trigger if exists notify_tiq_league_schedule_change on public.tiq_league_schedule_items;
create trigger notify_tiq_league_schedule_change
after insert or update on public.tiq_league_schedule_items
for each row
execute function public.notify_tiq_league_schedule_change();

create or replace function public.notify_tiq_tournament_schedule_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.schedule is not distinct from new.schedule then
    return new;
  end if;

  insert into public.internal_notifications (
    recipient_profile_id,
    actor_user_id,
    notification_type,
    title,
    body,
    href
  )
  select distinct
    entry.submitted_by_user_id,
    new.updated_by_user_id,
    'schedule',
    case
      when old.schedule = '{}'::jsonb then 'Tournament schedule posted'
      else 'Tournament schedule changed'
    end,
    new.name || ' has updated match timing or court details.',
    '/compete/schedule'
  from public.tiq_tournament_entries entry
  where entry.tournament_id::text = new.id::text
    and entry.status = 'approved'
    and entry.submitted_by_user_id is not null
    and entry.submitted_by_user_id is distinct from new.updated_by_user_id;

  return new;
end;
$$;

drop trigger if exists notify_tiq_tournament_schedule_change on public.tiq_tournaments;
create trigger notify_tiq_tournament_schedule_change
after update of schedule on public.tiq_tournaments
for each row
execute function public.notify_tiq_tournament_schedule_change();

comment on table public.player_schedule_responses is
'Player availability responses tied to the current snapshot of an approved TIQ competition event.';
