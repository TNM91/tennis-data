begin;
set local lock_timeout = '5s';

do $guard$
begin
  if not public.account_erasure_catalog_ready() or not exists (
    select 1 from pg_catalog.pg_proc
    where oid = 'public.account_erasure_catalog_ready()'::regprocedure and prosecdef
      and md5(regexp_replace(replace(prosrc, '16cffb50117acff9ca9275d67c04808b',
        '71aa786c4bef4a48b62690ba6787c745'), '\s', '', 'g')) = 'd5ae334069ece2d06146a4b9863d7713'
  ) then
    raise exception 'Review the existing account deletion catalog before adding personal matches';
  end if;
end $guard$;

create table public.native_personal_matches (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  revision uuid not null,
  calendar_match_id text check (calendar_match_id ~ '^(league|tournament):[a-zA-Z0-9_-]{1,80}:[a-zA-Z0-9_:-]{1,120}$'),
  match_date date not null check (match_date between date '0001-01-01' and current_date + 1),
  opponent text not null check (char_length(opponent) between 1 and 100 and btrim(opponent) <> '' and opponent !~ '[[:cntrl:]]'),
  format text not null check (format in ('singles', 'doubles')),
  outcome text not null check (outcome in ('Won', 'Lost')),
  score text not null check (char_length(score) between 1 and 64 and btrim(score) <> '' and score !~ '[[:cntrl:]]'),
  created_at timestamptz not null default now(),
  primary key (owner_user_id, id),
  unique (owner_user_id, calendar_match_id)
);

comment on column public.native_personal_matches.calendar_match_id is
  'Private calendar association supplied by the owner. This field does not verify participation or the result.';

create index native_personal_matches_history_idx
  on public.native_personal_matches (owner_user_id, match_date desc, created_at desc, id desc);

alter table public.native_personal_matches enable row level security;
create policy own_personal_matches on public.native_personal_matches for all to authenticated
  using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
revoke all on public.native_personal_matches from public, anon, authenticated;
grant select, delete on public.native_personal_matches to authenticated;
grant insert (owner_user_id, id, revision, calendar_match_id, match_date, opponent, format, outcome, score),
  update (revision, match_date, opponent, format, outcome, score)
  on public.native_personal_matches to authenticated;

do $extend_catalog$
declare
  source text := pg_catalog.pg_get_functiondef('public.account_erasure_catalog_ready()'::regprocedure);
  columns_marker constant text := '16cffb50117acff9ca9275d67c04808b';
  foreign_keys_marker constant text := $prefix$jsonb_to_recordset('[$prefix$;
  match_owner_fk constant text := '{"t":"native_personal_matches","c":"owner_user_id","p":"users","d":"c","n":false},';
begin
  if length(source) - length(replace(source, columns_marker, '')) <> length(columns_marker)
    or length(source) - length(replace(source, foreign_keys_marker, '')) <> length(foreign_keys_marker) then
    raise exception 'Account deletion catalog markers changed';
  end if;
  execute replace(replace(source, columns_marker, '0c6f2399c3bb83c30104cea3ad909760'),
    foreign_keys_marker, foreign_keys_marker || match_owner_fk);
  if not public.account_erasure_catalog_ready() then
    raise exception 'Account deletion catalog did not validate with the personal matches table';
  end if;
end $extend_catalog$;

notify pgrst, 'reload schema';
commit;
