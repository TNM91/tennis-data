alter table public.upgrade_requests
  add column if not exists dedupe_active boolean not null default false;

create unique index if not exists upgrade_requests_active_dedupe_idx
  on public.upgrade_requests (requester_user_id, plan_id, next_href)
  where dedupe_active = true
    and requester_user_id is not null
    and status in ('pending', 'contacted');
