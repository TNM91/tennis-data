begin;
set local lock_timeout = '5s';

create table private.native_league_drafts (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  revision uuid not null,
  draft jsonb not null check (jsonb_typeof(draft) = 'object' and octet_length(draft::text) <= 2048),
  check (
    jsonb_typeof(draft->'weeks') is not distinct from 'number' and
    jsonb_typeof(draft->'startsOn') is not distinct from 'string' and
    (draft->>'weeks')::integer between 1 and 12 and
    (draft->>'startsOn')::date + ((draft->>'weeks')::integer * 7 - 1) <= date '9999-12-31'
  )
);
alter table private.native_league_drafts enable row level security;
revoke all on private.native_league_drafts from public, anon, authenticated, service_role;

create function public.native_league_draft(p_owner uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('draft', saved.draft, 'revision', saved.revision)
  from private.native_league_drafts saved
  where saved.owner_id = p_owner and not exists (
    select 1 from public.account_deletion_requests request
    where request.account_id = p_owner and request.automatic_consent
  );
$$;

create function public.save_native_league_draft(p_owner uuid, p_expected uuid, p_revision uuid, p_draft jsonb)
returns jsonb language plpgsql security definer set search_path = ''
set lock_timeout = '3s' set statement_timeout = '5s' as $$
declare
  saved private.native_league_drafts;
begin
  if p_owner is null or p_revision is null or p_revision = p_expected or p_draft is null then
    return jsonb_build_object('code', 'invalid');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('native-league-draft:' || p_owner::text, 0));
  perform 1 from auth.users where id = p_owner for key share;
  if not found or exists (
    select 1 from public.account_deletion_requests request
    where request.account_id = p_owner and request.automatic_consent
  ) then
    return jsonb_build_object('code', 'forbidden');
  end if;

  select * into saved from private.native_league_drafts where owner_id = p_owner;
  if saved.revision = p_revision and saved.draft = p_draft then
    return jsonb_build_object('draft', saved.draft, 'revision', saved.revision);
  end if;
  if saved.revision is distinct from p_expected then
    return jsonb_build_object('code', 'stale');
  end if;

  insert into private.native_league_drafts (owner_id, revision, draft) values (p_owner, p_revision, p_draft)
  on conflict (owner_id) do update set revision = excluded.revision, draft = excluded.draft
  returning * into saved;
  return jsonb_build_object('draft', saved.draft, 'revision', saved.revision);
end;
$$;

revoke all on function public.native_league_draft(uuid) from public, anon, authenticated, service_role;
revoke all on function public.save_native_league_draft(uuid, uuid, uuid, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.native_league_draft(uuid) to service_role;
grant execute on function public.save_native_league_draft(uuid, uuid, uuid, jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
