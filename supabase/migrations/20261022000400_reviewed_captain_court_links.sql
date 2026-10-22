-- Explicit, retained-evidence reviews only. A player/date match is not a link.
create table public.tennisrecord_reviewed_captain_courts (
  source_event_id text not null check (source_event_id ~ '^tennisrecord:20[0-9]{2}:[1-9][0-9]*$'),
  discipline text not null check (discipline in ('singles','doubles')),
  court_number integer not null check (court_number between 1 and 99),
  canonical_match_id uuid not null unique references public.matches(id),
  canonical_parent_id uuid not null references public.matches(id),
  source_page_id uuid not null references public.tennisrecord_source_pages(id),
  source_snapshot jsonb not null check (jsonb_typeof(source_snapshot)='object'),
  court_snapshot jsonb not null check (jsonb_typeof(court_snapshot)='object'),
  parent_snapshot jsonb not null check (jsonb_typeof(parent_snapshot)='object'),
  rating_processed_at timestamptz,
  reviewed_at timestamptz not null default now(),
  review_notes text not null check (length(btrim(review_notes))>=20),
  primary key(source_event_id,discipline,court_number)
);
alter table public.tennisrecord_reviewed_captain_courts enable row level security;
revoke all on public.tennisrecord_reviewed_captain_courts from public,anon,authenticated;
grant select,insert,update,delete on public.tennisrecord_reviewed_captain_courts to service_role;
comment on table public.tennisrecord_reviewed_captain_courts is
  'Private reviewed source-event/court links. Importer revalidates retained evidence, court/parent identity and all players; captain results remain authoritative.';
notify pgrst, 'reload schema';
