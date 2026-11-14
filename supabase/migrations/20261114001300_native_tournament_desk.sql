begin;
set local lock_timeout = '5s';

-- Private organizer setup. Publication can promote this into the shared tournament
-- event and division records once the event has a verified organizer purchase.
create table private.native_tournament_setups (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  draft jsonb not null check (jsonb_typeof(draft) = 'object' and octet_length(draft::text) <= 2048),
  created_at timestamptz not null default clock_timestamp(),
  primary key (owner_id, id)
);
create index native_tournament_setups_recent on private.native_tournament_setups (owner_id, created_at desc, id desc);
alter table private.native_tournament_setups enable row level security;
revoke all on private.native_tournament_setups from public, anon, authenticated, service_role;

alter table private.native_tournament_drafts add column prepared boolean not null default false;

create or replace function public.native_tournament_draft(p_owner uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('draft', case when saved.prepared then null else saved.draft end,
    'revision', saved.revision)
  from private.native_tournament_drafts saved
  where saved.owner_id = p_owner and not exists (
    select 1 from public.account_deletion_requests request
    where request.account_id = p_owner and request.automatic_consent
  );
$$;

create function public.native_tournament_desk(p_owner uuid, p_after uuid default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('draft', setup.draft, 'revision', setup.id)
    order by setup.created_at desc, setup.id desc), '[]'::jsonb)
  from (
    select s.id, s.draft, s.created_at
    from private.native_tournament_setups s
    where s.owner_id = p_owner and (p_after is null or (s.created_at, s.id) < (
      select cursor.created_at, cursor.id from private.native_tournament_setups cursor
      where cursor.owner_id = p_owner and cursor.id = p_after
    ))
      and not exists (
        select 1 from public.account_deletion_requests request
        where request.account_id = p_owner and request.automatic_consent
      )
    order by s.created_at desc, s.id desc
    limit 21
  ) setup;
$$;

create function public.prepare_native_tournament(p_owner uuid, p_revision uuid)
returns jsonb language plpgsql security definer set search_path = ''
set lock_timeout = '3s' set statement_timeout = '5s' as $$
declare
  source jsonb;
begin
  if p_owner is null or p_revision is null then
    return jsonb_build_object('code', 'invalid');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('native-tournament-draft:' || p_owner::text, 0));
  perform 1 from auth.users where id = p_owner for key share;
  if not found or exists (
    select 1 from public.account_deletion_requests request
    where request.account_id = p_owner and request.automatic_consent
  ) then
    return jsonb_build_object('code', 'forbidden');
  end if;

  select draft into source from private.native_tournament_setups
  where owner_id = p_owner and id = p_revision;
  if found then
    return jsonb_build_object('draft', source, 'revision', p_revision);
  end if;

  select draft into source from private.native_tournament_drafts
  where owner_id = p_owner and revision = p_revision and not prepared;
  if not found then
    return jsonb_build_object('code', 'stale');
  end if;
  insert into private.native_tournament_setups (owner_id, id, draft)
  values (p_owner, p_revision, source);
  update private.native_tournament_drafts set prepared = true, draft = '{}'::jsonb
  where owner_id = p_owner and revision = p_revision;
  return jsonb_build_object('draft', source, 'revision', p_revision);
end;
$$;

-- Prevent a delayed draft-save retry from restoring a draft already moved into the desk.
create or replace function public.save_native_tournament_draft(p_owner uuid, p_expected uuid, p_revision uuid, p_draft jsonb)
returns jsonb language plpgsql security definer set search_path = ''
set lock_timeout = '3s' set statement_timeout = '5s' as $$
declare
  saved private.native_tournament_drafts;
begin
  if p_owner is null or p_revision is null or p_revision = p_expected or p_draft is null then
    return jsonb_build_object('code', 'invalid');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('native-tournament-draft:' || p_owner::text, 0));
  perform 1 from auth.users where id = p_owner for key share;
  if not found or exists (
    select 1 from public.account_deletion_requests request
    where request.account_id = p_owner and request.automatic_consent
  ) then
    return jsonb_build_object('code', 'forbidden');
  end if;
  if exists (
    select 1 from private.native_tournament_setups setup where setup.owner_id = p_owner and setup.id = p_revision
  ) then
    return jsonb_build_object('code', 'stale');
  end if;
  select * into saved from private.native_tournament_drafts where owner_id = p_owner;
  if saved.revision = p_revision and saved.draft = p_draft then
    return jsonb_build_object('draft', saved.draft, 'revision', saved.revision);
  end if;
  if saved.revision is distinct from p_expected then
    return jsonb_build_object('code', 'stale');
  end if;
  insert into private.native_tournament_drafts (owner_id, revision, draft) values (p_owner, p_revision, p_draft)
  on conflict (owner_id) do update set revision = excluded.revision, draft = excluded.draft, prepared = false
  returning * into saved;
  return jsonb_build_object('draft', saved.draft, 'revision', saved.revision);
end;
$$;

revoke all on function public.native_tournament_desk(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.prepare_native_tournament(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.native_tournament_desk(uuid, uuid) to service_role;
grant execute on function public.prepare_native_tournament(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
commit;
