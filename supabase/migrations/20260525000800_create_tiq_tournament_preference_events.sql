create table if not exists public.tiq_tournament_preference_events (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null references public.tiq_tournaments(id) on delete cascade,
  tournament_entry_id uuid references public.tiq_tournament_entries(id) on delete set null,
  player_name text not null default '',
  phone text not null default '',
  action text not null default 'opt_out',
  source text not null default 'tournament_preferences',
  consent_note text not null default '',
  created_at timestamptz not null default now(),
  constraint tiq_tournament_preference_events_action_check check (action in ('opt_in', 'opt_out')),
  constraint tiq_tournament_preference_events_source_check check (source in ('tournament_preferences', 'director_update', 'sms_reply'))
);

create index if not exists tiq_tournament_preference_events_tournament_idx
  on public.tiq_tournament_preference_events (tournament_id, created_at desc);

create index if not exists tiq_tournament_preference_events_phone_idx
  on public.tiq_tournament_preference_events (phone);

alter table public.tiq_tournament_preference_events enable row level security;

drop policy if exists "Tournament creators can read preference events" on public.tiq_tournament_preference_events;
create policy "Tournament creators can read preference events"
on public.tiq_tournament_preference_events for select
using (
  exists (
    select 1 from public.tiq_tournaments t
    where t.id = tournament_id
      and t.created_by_user_id = auth.uid()
  )
);
