create table if not exists public.tiq_tournament_alerts (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null references public.tiq_tournaments(id) on delete cascade,
  kind text not null default 'court_ready',
  channel text not null default 'sms',
  message text not null default '',
  site_url text not null default 'https://www.tenaceiq.com',
  recipient_count integer not null default 0,
  opted_in_count integer not null default 0,
  status text not null default 'draft',
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tiq_tournament_alerts_kind_check check (kind in ('rules', 'court_ready', 'schedule_change', 'recap')),
  constraint tiq_tournament_alerts_channel_check check (channel in ('sms')),
  constraint tiq_tournament_alerts_status_check check (status in ('draft', 'queued', 'sent', 'cancelled'))
);

create index if not exists tiq_tournament_alerts_tournament_idx on public.tiq_tournament_alerts (tournament_id);
create index if not exists tiq_tournament_alerts_status_idx on public.tiq_tournament_alerts (status);

alter table public.tiq_tournament_alerts enable row level security;

drop policy if exists "Tournament creators can read alert drafts" on public.tiq_tournament_alerts;
create policy "Tournament creators can read alert drafts"
on public.tiq_tournament_alerts for select
using (
  exists (
    select 1 from public.tiq_tournaments t
    where t.id = tournament_id
      and t.created_by_user_id = auth.uid()
  )
);

drop policy if exists "Tournament creators can create alert drafts" on public.tiq_tournament_alerts;
create policy "Tournament creators can create alert drafts"
on public.tiq_tournament_alerts for insert
with check (
  created_by_user_id = auth.uid()
  and exists (
    select 1 from public.tiq_tournaments t
    where t.id = tournament_id
      and t.created_by_user_id = auth.uid()
  )
);

drop policy if exists "Tournament creators can update alert drafts" on public.tiq_tournament_alerts;
create policy "Tournament creators can update alert drafts"
on public.tiq_tournament_alerts for update
using (
  exists (
    select 1 from public.tiq_tournaments t
    where t.id = tournament_id
      and t.created_by_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.tiq_tournaments t
    where t.id = tournament_id
      and t.created_by_user_id = auth.uid()
  )
);
