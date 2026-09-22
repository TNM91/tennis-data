-- Separate season availability from final lineup confirmations. Only the
-- server may read tokens or write replies; anonymous clients have no table access.
create table public.season_availability_invites (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id),
  team_name text not null,
  league_name text not null,
  flight text not null default '',
  season_key text not null,
  roster_key text not null,
  player_id uuid references public.players(id),
  player_name text not null,
  response_token uuid not null unique default gen_random_uuid(),
  calendar_token uuid not null unique default gen_random_uuid(),
  match_ids uuid[] not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(team_name, league_name, flight, season_key, roster_key),
  check (cardinality(match_ids) between 1 and 250)
);
create table public.season_availability_responses (
  invite_id uuid not null references public.season_availability_invites(id) on delete cascade,
  match_id uuid not null references public.matches(id),
  status text not null check (status in ('available','maybe','unavailable')),
  match_date date not null,
  match_time text not null default '',
  responded_at timestamptz not null default now(),
  primary key (invite_id, match_id)
);
alter table public.season_availability_invites enable row level security;
alter table public.season_availability_responses enable row level security;
revoke all on public.season_availability_invites, public.season_availability_responses from anon, authenticated;
grant all on public.season_availability_invites, public.season_availability_responses to service_role;

-- Atomic partial save, with a fresh token/schedule check under row locks.
-- Unanswered matches are left unanswered; retries update rather than duplicate.
create function public.save_season_availability(p_token uuid, p_responses jsonb)
returns integer language plpgsql security invoker set search_path = public as $$
declare invite public.season_availability_invites; answer jsonb; fixture public.matches; saved integer := 0;
begin
  select * into invite from public.season_availability_invites where response_token=p_token and revoked_at is null for update;
  if not found then raise exception 'This season link is no longer active.'; end if;
  if jsonb_typeof(p_responses) <> 'array' or jsonb_array_length(p_responses) not between 1 and 250 then
    raise exception 'Choose availability for at least one match.';
  end if;
  for answer in select value from jsonb_array_elements(p_responses) loop
    select * into fixture from public.matches where id=(answer->>'matchId')::uuid for share;
    if not found or not (fixture.id=any(invite.match_ids))
      or (fixture.home_team is distinct from invite.team_name and fixture.away_team is distinct from invite.team_name)
      or fixture.league_name is distinct from invite.league_name or coalesce(fixture.flight,'')<>invite.flight
      or fixture.line_number is not null or coalesce(fixture.match_type,'')<>''
      or lower(coalesce(fixture.status,'')) in ('cancelled','canceled','postponed')
      or fixture.match_date is distinct from (answer->>'matchDate')::date
      or coalesce(fixture.match_time::text,'')<>coalesce(answer->>'matchTime','')
      or fixture.match_date < (now() at time zone 'America/Chicago')::date
      or coalesce(answer->>'status','') not in ('available','maybe','unavailable') then
      raise exception 'The schedule changed. Reload and review your dates before saving.';
    end if;
    insert into public.season_availability_responses(invite_id,match_id,status,match_date,match_time)
    values(invite.id,fixture.id,answer->>'status',fixture.match_date,coalesce(fixture.match_time::text,''))
    on conflict(invite_id,match_id) do update set status=excluded.status,match_date=excluded.match_date,match_time=excluded.match_time,responded_at=now();
    saved := saved+1;
  end loop;
  return saved;
end $$;
revoke all on function public.save_season_availability(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.save_season_availability(uuid,jsonb) to service_role;
