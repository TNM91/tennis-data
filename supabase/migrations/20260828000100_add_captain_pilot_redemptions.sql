create table if not exists public.captain_pilot_redemptions (
  id uuid primary key default gen_random_uuid(),
  campaign_key text not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  captain_name text not null default '',
  captain_email text not null default '',
  club_or_area text not null default '',
  team_name text not null,
  team_key text not null,
  feedback_focus text not null default '',
  upgrade_request_id uuid null references public.upgrade_requests(id) on delete set null,
  status text not null default 'claimed' check (status in ('claimed', 'checkout_started', 'converted', 'closed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  converted_at timestamptz null,
  unique (campaign_key, profile_id),
  unique (campaign_key, team_key),
  unique (upgrade_request_id)
);

create index if not exists captain_pilot_redemptions_campaign_status_created_at_idx
  on public.captain_pilot_redemptions (campaign_key, status, created_at desc);

alter table public.captain_pilot_redemptions enable row level security;

drop policy if exists "Captains can read their pilot redemption" on public.captain_pilot_redemptions;
create policy "Captains can read their pilot redemption"
  on public.captain_pilot_redemptions for select to authenticated
  using (profile_id = auth.uid());
