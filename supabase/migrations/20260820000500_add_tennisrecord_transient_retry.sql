-- Retry only ordinary transport failures. Source blocks remain terminal and
-- parser/data failures stay quarantined for review.
alter table public.tennisrecord_crawl_queue
  add column if not exists retry_count integer not null default 0 check (retry_count between 0 and 3),
  add column if not exists last_error_at timestamptz;

-- Requeue prior transport-only failures once the bounded retry policy exists.
update public.tennisrecord_crawl_queue
set status = 'pending',
    retry_count = 0,
    last_error_at = timezone('utc', now()),
    failure_reason = 'Requeued under bounded transient retry policy.'
where status = 'error'
  and failure_reason ilike '%fetch failed%';
