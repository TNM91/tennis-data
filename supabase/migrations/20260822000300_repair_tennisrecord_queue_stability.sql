-- Discovery is provenance, not an instruction to re-run a completed source
-- page. Earlier crawler revisions re-opened known rows through an upsert,
-- inflating the pending queue and making the historical tracker move backward.
-- A deliberate weekly refresh clears completed_at before re-queuing, so this
-- repair preserves that explicit path while restoring accidental reopenings.
update public.tennisrecord_crawl_queue
set
  status = 'done',
  failure_reason = '',
  retry_count = 0,
  last_error_at = null
where status = 'pending'
  and completed_at is not null;
