begin;
set local lock_timeout = '5s';

-- Account trophies use the approved app entry. Keep recipients and partner codes private.
create table private.native_tournament_titles (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.tiq_tournaments(id) on delete cascade,
  division_id text not null unique references public.tiq_tournaments(id) on delete cascade,
  champion text not null,
  recipient_id uuid references auth.users(id) on delete set null,
  partner_code uuid unique,
  partner_id uuid references auth.users(id) on delete set null,
  partner_claimed_at timestamptz,
  issued_at timestamptz not null default clock_timestamp()
);
create index native_tournament_titles_recipient_idx on private.native_tournament_titles (recipient_id, issued_at desc);
create index native_tournament_titles_partner_idx on private.native_tournament_titles (partner_id, issued_at desc);
alter table private.native_tournament_titles enable row level security;
revoke all on table private.native_tournament_titles from public, anon, authenticated, service_role;

create function private.native_tournament_title_json(title private.native_tournament_titles)
returns jsonb language sql immutable set search_path = '' as $$
  select case when title.id is not null then jsonb_build_object(
    'id', title.id, 'champion', title.champion, 'paired', title.partner_code is not null,
    'partnerClaimed', title.partner_claimed_at is not null,
    'partnerCode', case when title.partner_claimed_at is null then title.partner_code end
  ) end;
$$;
revoke all on function private.native_tournament_title_json(private.native_tournament_titles)
  from public, anon, authenticated, service_role;

create function public.native_tournament_title(
  p_owner uuid, p_event uuid, p_division text, p_action text default 'read',
  p_expected text default null, p_champion text default null, p_award uuid default null
)
returns jsonb language plpgsql security definer set search_path = ''
set lock_timeout = '3s' set statement_timeout = '8s' as $$
declare
  root text;
  division public.tiq_tournaments;
  award private.native_tournament_titles;
  recipients uuid[];
begin
  if p_owner is null or p_event is null or p_action is null or p_action not in ('read','award','withdraw') then
    return jsonb_build_object('code','invalid');
  end if;
  perform 1 from auth.users where id = p_owner for key share;
  if not found or exists (select 1 from public.account_deletion_requests where account_id = p_owner and automatic_consent) then
    return jsonb_build_object('code','missing');
  end if;
  select public_id into root from private.native_tournament_purchases
    where owner_id = p_owner and event_id = p_event and environment = 'Production' and status = 'paid' for share;
  perform 1 from public.tiq_tournaments where id = root and is_public and is_event
    and created_by_user_id = p_owner for update;
  if not found then return jsonb_build_object('code','missing'); end if;
  select * into division from public.tiq_tournaments where id = p_division and event_id = root
    and is_public and not is_event and created_by_user_id = p_owner for update;
  if not found then return jsonb_build_object('code','missing'); end if;
  select * into award from private.native_tournament_titles where division_id = division.id;
  if p_action = 'read' then
    return jsonb_build_object('award', private.native_tournament_title_json(award),
      'revision', md5(private.native_tournament_plan_data(root)::text));
  end if;
  if p_action = 'withdraw' then
    if award.id is not null and award.id is distinct from p_award then
      return jsonb_build_object('code','stale');
    end if;
    delete from private.native_tournament_titles where id = p_award and division_id = division.id;
    return jsonb_build_object('award',null);
  end if;
  if division.status <> 'completed' or p_champion is null or not (p_champion = any(division.entrants)) then
    return jsonb_build_object('code','not_ready');
  end if;
  if award.id is not null then
    if award.champion is distinct from p_champion then return jsonb_build_object('code','stale'); end if;
    return jsonb_build_object('award',private.native_tournament_title_json(award));
  end if;
  -- The route picked the champion from validated results in this exact snapshot.
  if p_expected is distinct from md5(private.native_tournament_plan_data(root)::text) then
    return jsonb_build_object('code','stale');
  end if;
  select array_agg(entry.submitted_by_user_id) into recipients from public.tiq_tournament_entries entry
    where entry.tournament_id = division.id and entry.player_name = p_champion and entry.status = 'approved'
      and entry.native_registration->>'version' = '1' and entry.submitted_by_user_id is not null
      and not exists (select 1 from public.account_deletion_requests
        where account_id = entry.submitted_by_user_id and automatic_consent);
  if cardinality(recipients) is distinct from 1 then return jsonb_build_object('code','recipient'); end if;
  insert into private.native_tournament_titles (event_id,division_id,champion,recipient_id,partner_code)
    values (root,division.id,p_champion,recipients[1],case when division.entrant_type = 'teams' then gen_random_uuid() end)
    returning * into award;
  return jsonb_build_object('award',private.native_tournament_title_json(award));
end;
$$;

create function public.claim_native_tournament_trophy(p_owner uuid, p_code uuid)
returns uuid language plpgsql security definer set search_path = ''
set lock_timeout = '3s' set statement_timeout = '8s' as $$
declare award private.native_tournament_titles;
begin
  if p_owner is null or p_code is null then return null; end if;
  perform 1 from auth.users where id = p_owner for key share;
  if not found or exists (select 1 from public.account_deletion_requests where account_id = p_owner and automatic_consent) then
    return null;
  end if;
  select * into award from private.native_tournament_titles where partner_code = p_code;
  if not found then return null; end if;
  perform 1 from public.tiq_tournaments where id = award.event_id and is_public and is_event for share;
  if not found then return null; end if;
  perform 1 from public.tiq_tournaments where id = award.division_id and event_id = award.event_id
    and is_public and status = 'completed' for share;
  if not found then return null; end if;
  select * into award from private.native_tournament_titles where partner_code = p_code for update;
  if not found or award.recipient_id is not distinct from p_owner then return null; end if;
  if award.partner_claimed_at is not null then
    return case when award.partner_id is not distinct from p_owner then award.id end;
  end if;
  if exists (select 1 from public.tiq_tournament_entries
    where tournament_id = award.division_id and submitted_by_user_id = p_owner and status = 'approved') then
    return null;
  end if;
  update private.native_tournament_titles set partner_id = p_owner, partner_claimed_at = clock_timestamp() where id = award.id;
  return award.id;
end;
$$;

create function public.native_tournament_account_trophies(p_owner uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(item.trophy order by item.issued_at desc,item.id), '[]'::jsonb)
  from (
    select title.id,title.issued_at,jsonb_build_object(
      'id','tiq-title-' || title.id::text,'kind','tournament','placement','first','name',event.name,
      'division',division.name,'awardedOn',(title.issued_at at time zone 'UTC')::date
    ) trophy
    from private.native_tournament_titles title
    join public.tiq_tournaments event on event.id = title.event_id and event.is_public and event.is_event
    join public.tiq_tournaments division on division.id = title.division_id and division.event_id = event.id
      and division.is_public and division.status = 'completed'
    where (title.recipient_id = p_owner or title.partner_id = p_owner)
      and not exists (select 1 from public.account_deletion_requests where account_id = p_owner and automatic_consent)
    order by title.issued_at desc,title.id limit 30
  ) item;
$$;

-- Preserve issued titles while allowing score-only corrections.
create function private.guard_awarded_tournament_results()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.id like 'tiq-native-division-%' and old.results is distinct from new.results
    and exists (select 1 from private.native_tournament_titles where division_id = old.id)
    and (select jsonb_object_agg(key,value->'winner') from jsonb_each(old.results))
      is distinct from (select jsonb_object_agg(key,value->'winner') from jsonb_each(new.results)) then
    raise exception 'trophy_locked' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_awarded_tournament_results() from public, anon, authenticated, service_role;
create trigger guard_awarded_tournament_results before update of results on public.tiq_tournaments
for each row execute function private.guard_awarded_tournament_results();

revoke all on function public.native_tournament_title(uuid,uuid,text,text,text,text,uuid),
  public.claim_native_tournament_trophy(uuid,uuid), public.native_tournament_account_trophies(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.native_tournament_title(uuid,uuid,text,text,text,text,uuid),
  public.claim_native_tournament_trophy(uuid,uuid), public.native_tournament_account_trophies(uuid) to service_role;

notify pgrst, 'reload schema';
commit;
