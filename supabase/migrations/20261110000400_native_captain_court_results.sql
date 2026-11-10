begin;
set local lock_timeout = '5s';

do $guard$
begin
  if not public.account_erasure_catalog_ready() or not exists (
    select 1 from pg_catalog.pg_proc
    where oid = 'public.account_erasure_catalog_ready()'::regprocedure and prosecdef
      and md5(regexp_replace(replace(replace(prosrc,
        '0c6f2399c3bb83c30104cea3ad909760', '71aa786c4bef4a48b62690ba6787c745'),
        '{"t":"native_personal_matches","c":"owner_user_id","p":"users","d":"c","n":false},', ''), '\s', '', 'g'))
        = 'd5ae334069ece2d06146a4b9863d7713'
  ) then
    raise exception 'Review the account deletion catalog before adding captain court results';
  end if;
end $guard$;

create table public.native_captain_court_results (
  fixture_id uuid not null references public.tiq_league_schedule_items(id) on delete cascade,
  court_number smallint not null check (court_number between 1 and 30),
  league_id text not null,
  match_date date not null,
  room_a uuid not null references public.internal_conversations(id) on delete cascade,
  room_b uuid not null references public.internal_conversations(id) on delete cascade,
  a1 uuid references auth.users(id) on delete set null,
  a2 uuid references auth.users(id) on delete set null,
  b1 uuid references auth.users(id) on delete set null,
  b2 uuid references auth.users(id) on delete set null,
  posted_by uuid references auth.users(id) on delete set null,
  format text not null check (format in ('singles','doubles')),
  winner text not null check (winner in ('A','B')),
  score text not null check (char_length(score) between 1 and 64 and score !~ '[[:cntrl:]]'),
  revision uuid not null,
  primary key (fixture_id, court_number),
  check (room_a <> room_b),
  check (format = 'doubles' or (a2 is null and b2 is null)),
  check (a1 <> a2 and a1 <> b1 and a1 <> b2 and a2 <> b1 and a2 <> b2 and b1 <> b2)
);

create index native_captain_results_a1_idx on public.native_captain_court_results (a1, match_date desc) where a1 is not null;
create index native_captain_results_a2_idx on public.native_captain_court_results (a2, match_date desc) where a2 is not null;
create index native_captain_results_b1_idx on public.native_captain_court_results (b1, match_date desc) where b1 is not null;
create index native_captain_results_b2_idx on public.native_captain_court_results (b2, match_date desc) where b2 is not null;

alter table public.native_captain_court_results enable row level security;
revoke all on public.native_captain_court_results from public, anon, authenticated;
grant select, insert, update on public.native_captain_court_results to service_role;

do $extend$
declare
  source text := pg_catalog.pg_get_functiondef('public.account_erasure_catalog_ready()'::regprocedure);
  columns_marker constant text := '0c6f2399c3bb83c30104cea3ad909760';
  foreign_keys_marker constant text := $prefix$jsonb_to_recordset('[$prefix$;
  court_keys constant text :=
    '{"t":"native_captain_court_results","c":"a1","p":"users","d":"n","n":true},' ||
    '{"t":"native_captain_court_results","c":"a2","p":"users","d":"n","n":true},' ||
    '{"t":"native_captain_court_results","c":"b1","p":"users","d":"n","n":true},' ||
    '{"t":"native_captain_court_results","c":"b2","p":"users","d":"n","n":true},' ||
    '{"t":"native_captain_court_results","c":"posted_by","p":"users","d":"n","n":true},';
begin
  if length(source) - length(replace(source, columns_marker, '')) <> length(columns_marker)
    or length(source) - length(replace(source, foreign_keys_marker, '')) <> length(foreign_keys_marker) then
    raise exception 'Account deletion catalog markers changed';
  end if;
  execute replace(replace(source, columns_marker, 'e6781b04114bd94e72be80d0c98d91bf'), foreign_keys_marker, foreign_keys_marker || court_keys);
  if not public.account_erasure_catalog_ready() then
    raise exception 'Account deletion catalog did not validate with captain court results';
  end if;
end $extend$;

notify pgrst, 'reload schema';
commit;
