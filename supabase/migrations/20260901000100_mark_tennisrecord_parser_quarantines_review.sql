-- A source page with no complete, trustworthy court result is a completed
-- capture that needs parser review, not an operational collector failure.
-- Keep it terminal so it never creates a crawl loop or inflates the active
-- import's error count.
alter table public.tennisrecord_crawl_queue
  drop constraint if exists tennisrecord_crawl_queue_status_check;

alter table public.tennisrecord_crawl_queue
  add constraint tennisrecord_crawl_queue_status_check
  check (status in ('pending', 'running', 'done', 'review', 'blocked', 'error'));

update public.tennisrecord_crawl_queue
set status = 'review',
    completed_at = coalesce(completed_at, last_error_at, timezone('utc', now()))
where status = 'error'
  and failure_reason = 'No complete TennisRecord court results were parsed; page evidence was retained for review.';
