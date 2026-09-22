-- Historical backfills stay scoped to an explicit geography/date campaign.
-- The campaign controls queue selection; raw source observations remain isolated.
create table if not exists public.tennisrecord_campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  region_label text not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'planned' check (status in ('planned', 'active', 'paused', 'completed')),
  seed_provenance text not null default 'admin_reviewed_public_urls',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (ends_on >= starts_on)
);

alter table public.tennisrecord_collector_settings
  add column if not exists active_campaign_id uuid references public.tennisrecord_campaigns(id) on delete set null;

alter table public.tennisrecord_crawl_queue
  add column if not exists campaign_id uuid references public.tennisrecord_campaigns(id) on delete set null;

create index if not exists tennisrecord_campaigns_status_idx
  on public.tennisrecord_campaigns(status, starts_on, ends_on);
create index if not exists tennisrecord_crawl_queue_campaign_work_idx
  on public.tennisrecord_crawl_queue(campaign_id, status, first_seen_at);

insert into public.tennisrecord_campaigns (slug, name, region_label, starts_on, ends_on, status, seed_provenance)
values ('missouri-2025-current', 'Missouri historical seed', 'St. Louis / Missouri', date '2025-01-01', current_date, 'active', 'admin_reviewed_public_urls')
on conflict (slug) do update
set ends_on = excluded.ends_on,
    status = case when public.tennisrecord_campaigns.status = 'completed' then public.tennisrecord_campaigns.status else 'active' end,
    updated_at = timezone('utc', now());

update public.tennisrecord_crawl_queue queue
set campaign_id = campaign.id
from public.tennisrecord_campaigns campaign
where campaign.slug = 'missouri-2025-current'
  and queue.campaign_id is null;

update public.tennisrecord_collector_settings settings
set active_campaign_id = campaign.id,
    updated_at = timezone('utc', now())
from public.tennisrecord_campaigns campaign
where settings.id = true
  and campaign.slug = 'missouri-2025-current'
  and settings.active_campaign_id is null;

alter table public.tennisrecord_campaigns enable row level security;
