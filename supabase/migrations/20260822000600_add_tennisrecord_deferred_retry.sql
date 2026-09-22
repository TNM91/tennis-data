-- Ordinary network failures may be retried later without treating source
-- blocks, parser failures, or unsupported URLs as retryable. The separate
-- counter prevents a repeated transport failure from looping forever.
alter table public.tennisrecord_crawl_queue
  add column if not exists deferred_retry_count integer not null default 0 check (deferred_retry_count between 0 and 2),
  add column if not exists deferred_retry_at timestamptz;

create index if not exists tennisrecord_crawl_queue_deferred_retry_idx
  on public.tennisrecord_crawl_queue (deferred_retry_at, first_seen_at)
  where status = 'error' and deferred_retry_at is not null;

-- Existing exhausted transport failures get their first delayed retry window.
-- All other queue errors remain terminal for review.
update public.tennisrecord_crawl_queue
set deferred_retry_at = timezone('utc', now()) + interval '6 hours'
where status = 'error'
  and retry_count = 3
  and deferred_retry_count = 0
  and deferred_retry_at is null
  and failure_reason ~* '(fetch failed|network|timeout|timed out|econn|socket hang up|temporarily unavailable)';
