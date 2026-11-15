begin;
set local lock_timeout = '5s';

-- Operator-created fixtures reuse Tournament Desk and Trophy Case. Reserving the IDs
-- at the table prevents any application or payment flow from publishing these rows.
alter table public.tiq_tournaments add constraint native_tournament_rehearsals_are_private check (
  not is_public or (
    id !~ '^tiq-native-(event|division)-74697166-6c74-4e10-8f11-[a-f0-9]{12}$'
    and coalesce(event_id, '') !~ '^tiq-native-event-74697166-6c74-4e10-8f11-[a-f0-9]{12}$'
  )
);

create table private.native_tournament_rehearsals (
  owner_id uuid not null,
  event_id uuid not null,
  event_key text not null unique references public.tiq_tournaments(id) on delete cascade,
  winner_id uuid references auth.users(id) on delete set null,
  partner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  primary key (owner_id, event_id),
  foreign key (owner_id, event_id) references private.native_tournament_setups(owner_id, id) on delete cascade,
  check (event_key ~ '^tiq-native-event-74697166-6c74-4e10-8f11-[a-f0-9]{12}$'),
  check (expires_at > created_at and expires_at <= created_at + interval '7 days'),
  check (owner_id <> winner_id and owner_id <> partner_id and winner_id <> partner_id)
);
alter table private.native_tournament_rehearsals enable row level security;
revoke all on private.native_tournament_rehearsals from public, anon, authenticated, service_role;

create view private.active_native_tournament_rehearsals as
  select owner_id, event_id, event_key, winner_id, partner_id
  from private.native_tournament_rehearsals
  where expires_at > statement_timestamp() and winner_id is not null and partner_id is not null;
revoke all on private.active_native_tournament_rehearsals from public, anon, authenticated, service_role;

-- Change only the specific predicates in each deployed function. Abort the entire
-- migration if any function differs from the version this patch was written for.
create function pg_temp.patch_tournament_rehearsal(source text, marker text, replacement text)
returns text language plpgsql as $$
begin
  source := replace(source, chr(13), '');
  marker := replace(marker, chr(13), '');
  replacement := replace(replacement, chr(13), '');
  if length(source) - length(replace(source, marker, '')) <> length(marker) then
    raise exception 'Tournament rehearsal patch did not find exactly one marker: %', marker;
  end if;
  return replace(source, marker, replacement);
end;
$$;

create or replace function public.native_tournament_setup(p_owner uuid, p_event uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select private.native_tournament_setup_json(setup) ||
    case when coalesce(published.id, test.event_key) is not null
      then jsonb_build_object('publicId', coalesce(published.id, test.event_key)) else '{}'::jsonb end
  from private.native_tournament_setups setup
  left join private.native_tournament_purchases payment
    on payment.owner_id = setup.owner_id and payment.event_id = setup.id
    and payment.environment = 'Production' and payment.status = 'paid'
  left join public.tiq_tournaments published on published.id = payment.public_id and published.is_public
  left join private.active_native_tournament_rehearsals test on test.owner_id = setup.owner_id and test.event_id = setup.id
  where setup.owner_id = p_owner and setup.id = p_event and not exists (
    select 1 from public.account_deletion_requests request
    where request.account_id = p_owner and request.automatic_consent
  ) and (test.event_key is not null or not exists (
    select 1 from private.native_tournament_rehearsals expired where expired.owner_id = p_owner and expired.event_id = p_event
  ));
$$;

do $patch$
declare source text;
begin
  source := pg_get_functiondef('public.native_tournament_desk(uuid,uuid)'::regprocedure);
  execute pg_temp.patch_tournament_rehearsal(source, 'where s.owner_id = p_owner and (p_after', $sql$where s.owner_id = p_owner
      and not exists (select 1 from private.native_tournament_rehearsals test
        where test.owner_id = s.owner_id and test.event_id = s.id and
          (test.expires_at <= statement_timestamp() or test.winner_id is null or test.partner_id is null))
      and (p_after$sql$);

  source := pg_get_functiondef('public.native_tournament_checkout(uuid,uuid,text,text,uuid,uuid,uuid)'::regprocedure);
  execute pg_temp.patch_tournament_rehearsal(source, 'select * into setup from private.native_tournament_setups', $sql$if exists (
    select 1 from private.native_tournament_rehearsals where owner_id = p_owner and event_id = p_event
  ) then return jsonb_build_object('code','missing'); end if;
  select * into setup from private.native_tournament_setups$sql$);

  source := pg_get_functiondef('private.native_tournament_plan_data(text)'::regprocedure);
  source := pg_temp.patch_tournament_rehearsal(source, 'division.event_id = root.id and division.is_public',
    'division.event_id = root.id and division.is_public = root.is_public');
  execute pg_temp.patch_tournament_rehearsal(source, 'where root.id = p_root and root.is_public', $sql$where root.id = p_root
    and (root.is_public or exists (select 1 from private.active_native_tournament_rehearsals test
      where test.event_key = root.id and test.owner_id = root.created_by_user_id and root.is_event))$sql$);

  source := pg_get_functiondef('public.native_tournament_draw_plan(uuid,uuid,text,text,text,text,jsonb)'::regprocedure);
  execute pg_temp.patch_tournament_rehearsal(source, '-- Refunds and schedule writes always lock the purchase before the event.', $sql$-- The completed fixture is read-only in the draw planner.
  if p_action = 'read' then
    select test.event_key into event_key from private.active_native_tournament_rehearsals test
      where test.owner_id = p_owner and test.event_id = p_event;
    if found then
      data := private.native_tournament_plan_data(event_key);
      if data is null then return jsonb_build_object('code','missing'); end if;
      return data || jsonb_build_object('revision', md5(data::text));
    end if;
  end if;
  -- Refunds and schedule writes always lock the purchase before the event.$sql$);

  source := pg_get_functiondef('public.native_tournament_title(uuid,uuid,text,text,text,text,uuid)'::regprocedure);
  source := pg_temp.patch_tournament_rehearsal(source, '  recipients uuid[];', $sql$  recipients uuid[];
  test_winner uuid;
  test_event boolean := false;$sql$);
  source := pg_temp.patch_tournament_rehearsal(source, '  perform 1 from public.tiq_tournaments where id = root and is_public and is_event', $sql$  if root is null then
    select test.event_key, test.winner_id into root, test_winner from private.active_native_tournament_rehearsals test
      where test.owner_id = p_owner and test.event_id = p_event;
    test_event := found;
  end if;
  perform 1 from public.tiq_tournaments where id = root and is_public = (not test_event) and is_event$sql$);
  source := pg_temp.patch_tournament_rehearsal(source, 'and is_public and not is_event and created_by_user_id',
    'and is_public = (not test_event) and not is_event and created_by_user_id');
  execute pg_temp.patch_tournament_rehearsal(source, $sql$entry.native_registration->>'version' = '1' and entry.submitted_by_user_id is not null$sql$, $sql$entry.native_registration->>'version' = '1' and entry.submitted_by_user_id is not null
      and (not test_event or entry.submitted_by_user_id = test_winner)$sql$);

  source := pg_get_functiondef('public.claim_native_tournament_trophy(uuid,uuid)'::regprocedure);
  source := pg_temp.patch_tournament_rehearsal(source, 'declare award private.native_tournament_titles;', $sql$declare
  award private.native_tournament_titles;
  public_event boolean;$sql$);
  source := pg_temp.patch_tournament_rehearsal(source, 'perform 1 from public.tiq_tournaments where id = award.event_id and is_public and is_event for share;', $sql$select event.is_public into public_event from public.tiq_tournaments event
    where event.id = award.event_id and event.is_event and (event.is_public or exists (
      select 1 from private.active_native_tournament_rehearsals test
      where test.event_key = event.id and test.owner_id = event.created_by_user_id
        and test.winner_id = award.recipient_id and test.partner_id = p_owner
    )) for share;$sql$);
  execute pg_temp.patch_tournament_rehearsal(source, $sql$and is_public and status = 'completed' for share;$sql$,
    $sql$and is_public = public_event and status = 'completed' for share;$sql$);

  source := pg_get_functiondef('public.native_tournament_account_trophies(uuid)'::regprocedure);
  source := pg_temp.patch_tournament_rehearsal(source, 'event.id = title.event_id and event.is_public and event.is_event',
    'event.id = title.event_id and event.is_event');
  execute pg_temp.patch_tournament_rehearsal(source, $sql$and division.is_public and division.status = 'completed'
    where (title.recipient_id = p_owner or title.partner_id = p_owner)$sql$, $sql$and division.is_public = event.is_public and division.status = 'completed'
    where (title.recipient_id = p_owner or title.partner_id = p_owner)
      and (event.is_public or exists (
        select 1 from private.active_native_tournament_rehearsals test
        where test.event_key = event.id and test.owner_id = event.created_by_user_id and test.winner_id = title.recipient_id
          and (p_owner = test.winner_id or p_owner = test.partner_id)
      ))$sql$);
end;
$patch$;
drop function pg_temp.patch_tournament_rehearsal(text, text, text);

notify pgrst, 'reload schema';
commit;
