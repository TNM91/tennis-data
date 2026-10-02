-- Apply AFTER the collector code so the older seed routine cannot consume this reset.
-- Enroll known Missouri owner profiles without reopening review/blocked/error rows.
update public.tennisrecord_crawl_queue q
set refresh_season=extract(year from now() at time zone 'UTC')::integer,
    refresh_due_at=coalesce(q.refresh_due_at,q.completed_at+interval '7 days',now())
from public.tennisrecord_staged_players p
where q.source_url=p.source_url and p.state='MO'
  and q.page_kind='player' and q.status in ('done','pending')
  and (q.refresh_season is null or q.refresh_season<>extract(year from now() at time zone 'UTC'));

update public.tennisrecord_collector_settings
set current_refresh_seeded_at=null,current_refresh_player_cursor=null,current_refresh_seed_cycle_at=null
where id=true and enabled and current_refresh_enabled;
