-- Keep sustained historical collection off the transactional database's
-- large-text hot path. Source pages remain private audit evidence in Storage;
-- Postgres retains the URL, hash, provenance, and Storage reference.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tennisrecord-source-pages',
  'tennisrecord-source-pages',
  false,
  1048576,
  array['text/html']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.tennisrecord_source_pages
  add column if not exists raw_html_storage_path text;

comment on column public.tennisrecord_source_pages.raw_html_storage_path is
  'Private Supabase Storage object containing captured public source HTML. raw_html remains only as a temporary fallback when Storage is unavailable.';

-- Match the scheduler's exact pending-page lookup. This avoids repeatedly
-- scanning completed history while selecting the next campaign checkpoint.
create index if not exists tennisrecord_crawl_queue_pending_campaign_kind_idx
  on public.tennisrecord_crawl_queue (campaign_id, page_kind, first_seen_at)
  where status = 'pending' and deferred_retry_at is null;

create index if not exists tennisrecord_crawl_queue_pending_deferred_idx
  on public.tennisrecord_crawl_queue (campaign_id, page_kind, deferred_retry_at, first_seen_at)
  where status = 'pending' and deferred_retry_at is not null;

-- Existing source-page replays can read from the former database fallback or
-- from the new object reference without a broad source-page scan.
drop index if exists public.tennisrecord_source_pages_parser_replay_idx;
create index tennisrecord_source_pages_parser_replay_idx
  on public.tennisrecord_source_pages (parser_revision, last_seen_at desc)
  where (raw_html is not null or raw_html_storage_path is not null) and blocked = false;

-- The historical campaign has sustained roughly ninety-second checkpoints.
-- This keeps all requests sequential and rate-limited while lifting the batch
-- size from eight to twelve to reduce idle work between checkpoints.
alter table public.tennisrecord_collector_settings
  alter column max_requests_per_run set default 12;

update public.tennisrecord_collector_settings
set max_requests_per_run = 12,
    updated_at = timezone('utc', now())
where id = true
  and enabled = true
  and automation_state = 'bootstrap'
  and max_requests_per_run = 8;
