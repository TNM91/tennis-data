begin;
set local lock_timeout = '5s';

-- Keep the rehearsal outside the public catalog, even if an organizer or
-- entrant has other league roles.
alter table public.tiq_leagues add constraint native_entry_rehearsal_is_private
  check (id not like 'tiq-native-league-e79ec308-8b38-4bf8-aac9-%' or (not is_public and league_format = 'individual'));
create policy "Entry rehearsals are visible to their owner" on public.tiq_leagues
  as restrictive for select to public
  using (id not like 'tiq-native-league-e79ec308-8b38-4bf8-aac9-%' or created_by_user_id = (select auth.uid()));

create table private.native_league_entry_rehearsals (
  league_id text primary key references public.tiq_leagues(id) on delete cascade
    check (league_id ~ '^tiq-native-league-e79ec308-8b38-4bf8-aac9-[a-f0-9]{12}$'),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  expires_at timestamptz not null
);
alter table private.native_league_entry_rehearsals enable row level security;
revoke all on private.native_league_entry_rehearsals from public,anon,authenticated,service_role;

create function private.native_league_entry_rehearsal_open(target text, actor uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from private.native_league_entry_rehearsals rehearsal
    join public.tiq_leagues l on l.id = rehearsal.league_id and l.created_by_user_id = rehearsal.owner_id
    join auth.users u on u.id = rehearsal.owner_id and u.email_confirmed_at is not null
    where rehearsal.league_id = target and rehearsal.owner_id = actor
      and rehearsal.expires_at > statement_timestamp()
      and not l.is_public and l.season_status = 'active' and l.league_format = 'individual'
      and l.ends_on >= (statement_timestamp() at time zone l.schedule_time_zone)::date
      and not exists (select 1 from public.account_deletion_requests request
        where request.account_id = actor and request.status <> 'completed')
  );
$$;
revoke all on function private.native_league_entry_rehearsal_open(text,uuid) from public,anon,authenticated,service_role;

-- One verified account can use the same rehearsal as both entrant and
-- organizer. A caller can request their own catalog row or an exact league.
create function public.native_league_entry_rehearsal(p_league text)
returns jsonb language sql stable security definer set search_path = ''
set statement_timeout = '5s' as $$
  select to_jsonb(source) from (
    select l.id,l.created_by_user_id,l.league_name,l.league_format,l.season_label,l.season_status,
      l.flight,l.location_label,l.starts_on,l.ends_on,l.schedule_time_zone,l.updated_at,
      l.scoring_system,l.competition_rules,l.is_public
    from private.native_league_entry_rehearsals rehearsal
    join public.tiq_leagues l on l.id = rehearsal.league_id
    where rehearsal.owner_id = (select auth.uid()) and (p_league is null or p_league = l.id)
      and private.native_league_entry_rehearsal_open(l.id,(select auth.uid()))
  ) source;
$$;
revoke all on function public.native_league_entry_rehearsal(text) from public,anon,authenticated,service_role;
grant execute on function public.native_league_entry_rehearsal(text) to authenticated;

-- Keep the existing receipt, locking, and eligibility checks. The only
-- additional path is the exact private rehearsal for this signed-in actor.
create function pg_temp.patch_entry_rehearsal(source text, marker text, replacement text)
returns text language plpgsql as $$
begin
  source := replace(source,chr(13),'');
  if length(source)-length(replace(source,marker,'')) <> length(marker) then
    raise exception 'League entry rehearsal source changed: %', marker;
  end if;
  return replace(source,marker,replacement);
end;
$$;

do $patch$
declare
  source text;
  visibility constant text := $sql$and (id not like 'tiq-native-league-%' or private.native_league_registration_open(id))$sql$;
  rehearsal_visibility constant text := $sql$and (
      (is_public and (id not like 'tiq-native-league-%' or private.native_league_registration_open(id)))
      or private.native_league_entry_rehearsal_open(id,p_actor)
    )$sql$;
begin
  source := pg_get_functiondef('public.native_first_party_league_entry(uuid,text,text,timestamptz,jsonb)'::regprocedure);
  source := pg_temp.patch_entry_rehearsal(source,$sql$where id = p_league and is_public and season_status = 'active'$sql$,
    $sql$where id = p_league and season_status = 'active'$sql$);
  execute pg_temp.patch_entry_rehearsal(source,visibility,rehearsal_visibility);

  source := pg_get_functiondef('private.native_first_party_league_decision(uuid,text,text,timestamptz,uuid,timestamptz,text,text,text)'::regprocedure);
  source := pg_temp.patch_entry_rehearsal(source,'and league.created_by_user_id = p_actor and private.native_league_registration_open(league.id)',
    'and league.created_by_user_id = p_actor and (private.native_league_registration_open(league.id) or private.native_league_entry_rehearsal_open(league.id,p_actor))');
  source := pg_temp.patch_entry_rehearsal(source,'where id = p_league and created_by_user_id = p_actor and is_public',
    'where id = p_league and created_by_user_id = p_actor');
  execute pg_temp.patch_entry_rehearsal(source,visibility,rehearsal_visibility);

  source := pg_get_functiondef('public.native_first_party_league_decision(uuid,text,text,timestamptz,uuid,timestamptz,text,text,text)'::regprocedure);
  source := pg_temp.patch_entry_rehearsal(source,'not private.native_league_registration_open(p_league)',
    'not (private.native_league_registration_open(p_league) or private.native_league_entry_rehearsal_open(p_league,p_actor))');
  execute pg_temp.patch_entry_rehearsal(source,'and recipient <> p_actor',
    'and (recipient <> p_actor or private.native_league_entry_rehearsal_open(p_league,p_actor))');

  source := pg_get_functiondef('private.native_league_entry_updates()'::regprocedure);
  source := pg_temp.patch_entry_rehearsal(source,'and league.is_public and league.created_by_user_id = n.actor_user_id',
    'and (league.is_public or private.native_league_entry_rehearsal_open(league.id,n.recipient_profile_id)) and league.created_by_user_id = n.actor_user_id');
  execute pg_temp.patch_entry_rehearsal(source,'and private.native_league_registration_open(league.id)))',
    'and (private.native_league_registration_open(league.id) or private.native_league_entry_rehearsal_open(league.id,n.recipient_profile_id))))');
end;
$patch$;
drop function pg_temp.patch_entry_rehearsal(text,text,text);

notify pgrst, 'reload schema';
commit;
