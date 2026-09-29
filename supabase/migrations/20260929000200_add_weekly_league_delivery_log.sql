alter table public.tiq_leagues
  alter column weekly_settings set default '{
    "enabled": false,
    "collectAvailability": true,
    "autoGenerateCourts": true,
    "collectPlayerStories": true,
    "leagueChatEnabled": false,
    "emailRemindersEnabled": false,
    "courtCount": 4,
    "startTimes": ["08:00", "08:30"]
  }'::jsonb;

create table if not exists public.tiq_league_weekly_deliveries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.tiq_league_weekly_sessions(id) on delete cascade,
  recipient_profile_id uuid not null references auth.users(id) on delete cascade,
  delivery_kind text not null check (delivery_kind in ('availability_open', 'court_plan')),
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'sent', 'failed', 'skipped')),
  provider_message_id text not null default '',
  error_message text not null default '',
  created_at timestamptz not null default now(),
  sent_at timestamptz null,
  unique (session_id, recipient_profile_id, delivery_kind)
);

create index if not exists tiq_league_weekly_deliveries_status_idx
  on public.tiq_league_weekly_deliveries (delivery_status, created_at desc);

alter table public.tiq_league_weekly_deliveries enable row level security;

create policy "League owners read weekly deliveries"
on public.tiq_league_weekly_deliveries for select to authenticated
using (
  exists (
    select 1 from public.tiq_league_weekly_sessions session
    where session.id = session_id and public.can_manage_tiq_league(session.league_id)
  )
);
