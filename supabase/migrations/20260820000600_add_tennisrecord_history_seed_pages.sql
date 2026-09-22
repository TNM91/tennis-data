-- History pages are discovery-only, public, season-scoped seed pages. They
-- may enqueue only explicit result pages; no history-page rating is staged.
alter table public.tennisrecord_crawl_queue
  drop constraint if exists tennisrecord_crawl_queue_page_kind_check;

alter table public.tennisrecord_crawl_queue
  add constraint tennisrecord_crawl_queue_page_kind_check
  check (page_kind in ('match', 'player', 'team', 'history', 'league', 'unknown'));
