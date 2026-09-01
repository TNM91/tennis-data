-- Player profiles are source evidence for factual location and public history
-- expansion. These rows were deliberately held before profile processing was
-- part of the bounded scheduled campaign. Resume only that explicit hold;
-- genuine fetch, block, and parser failures remain quarantined.
update public.tennisrecord_crawl_queue
set status = 'pending',
    failure_reason = '',
    completed_at = null
where page_kind = 'player'
  and status = 'error'
  and failure_reason = 'deferred_bootstrap_perimeter';
