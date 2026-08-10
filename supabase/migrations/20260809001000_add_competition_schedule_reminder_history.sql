create table if not exists public.competition_schedule_reminders (
  id uuid primary key default gen_random_uuid(),
  organizer_user_id uuid not null references auth.users(id) on delete cascade,
  player_user_id uuid not null references auth.users(id) on delete cascade,
  competition_kind text not null check (competition_kind in ('league', 'tournament')),
  competition_id text not null,
  event_id text not null,
  event_snapshot jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default timezone('utc', now())
);

create index if not exists competition_schedule_reminders_event_idx
  on public.competition_schedule_reminders (organizer_user_id, event_id, sent_at desc);

create index if not exists competition_schedule_reminders_player_idx
  on public.competition_schedule_reminders (player_user_id, sent_at desc);

alter table public.competition_schedule_reminders enable row level security;

drop policy if exists "Organizers can read schedule reminder history" on public.competition_schedule_reminders;
create policy "Organizers can read schedule reminder history"
on public.competition_schedule_reminders
for select
to authenticated
using (organizer_user_id = (select auth.uid()));

drop policy if exists "Competition directors can add schedule reminders" on public.competition_schedule_reminders;
create policy "Competition directors can add schedule reminders"
on public.competition_schedule_reminders
for insert
to authenticated
with check (
  organizer_user_id = (select auth.uid())
  and public.is_tiq_competition_director(competition_kind, competition_id)
);

comment on table public.competition_schedule_reminders is
  'Organizer reminder history used to enforce a per-player cooldown for the current competition schedule snapshot.';
