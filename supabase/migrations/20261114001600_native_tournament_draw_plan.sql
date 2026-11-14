begin;
set local lock_timeout = '5s';

-- Opening a paid organizer workspace is independent of the StoreKit catalog.
create or replace function public.native_tournament_setup(p_owner uuid, p_event uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select private.native_tournament_setup_json(setup) ||
    case when published.id is not null then jsonb_build_object('publicId', published.id) else '{}'::jsonb end
  from private.native_tournament_setups setup
  left join private.native_tournament_purchases payment
    on payment.owner_id = setup.owner_id and payment.event_id = setup.id
    and payment.environment = 'Production' and payment.status = 'paid'
  left join public.tiq_tournaments published on published.id = payment.public_id and published.is_public
  where setup.owner_id = p_owner and setup.id = p_event and not exists (
    select 1 from public.account_deletion_requests request
    where request.account_id = p_owner and request.automatic_consent
  );
$$;

-- The shared registration context must also close a native division with a published draw and no assigned courts.
do $patch$
declare
  source text := pg_get_functiondef('public.native_tournament_entry_context(text,text)'::regprocedure);
  marker text := 'locked:=t.results<>';
begin
  if (length(source) - length(replace(source, marker, ''))) <> length(marker) then
    raise exception 'Tournament entry lock changed; review draw publication';
  end if;
  execute replace(source, marker, 'locked:=(t.id like ''tiq-native-division-%'' and t.status=''scheduled'') or t.results<>');
end $patch$;

create function private.freeze_native_tournament_draw()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.id like 'tiq-native-division-%' and old.status in ('scheduled','completed')
    and (new.entrants is distinct from old.entrants or new.format is distinct from old.format
      or new.entrant_type is distinct from old.entrant_type or new.status in ('open','draft')) then
    raise exception 'The tournament draw is published' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.freeze_native_tournament_draw() from public, anon, authenticated, service_role;
create trigger freeze_native_tournament_draw before update on public.tiq_tournaments
for each row execute function private.freeze_native_tournament_draw();

-- Paid native divisions use the account-linked queue. Lock the same division
-- row as draw publication so late requests cannot slip into a closed field.
create function private.guard_native_tournament_entry()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'pending' or new.tournament_id not like 'tiq-native-division-%' then return new; end if;
  if new.submitted_by_user_id is null or new.native_registration->>'version' is distinct from '1' then
    raise exception 'Enter this division in the TenAceIQ app' using errcode = '23514';
  end if;
  perform 1 from public.tiq_tournaments where id = new.tournament_id and is_public and status = 'open' for share;
  if not found then raise exception 'Entries are closed for this division' using errcode = '23514'; end if;
  return new;
end;
$$;
revoke all on function private.guard_native_tournament_entry() from public, anon, authenticated, service_role;
create trigger guard_native_tournament_entry before insert or update of tournament_id, status on public.tiq_tournament_entries
for each row execute function private.guard_native_tournament_entry();
create policy "Native tournament entries use account registration" on public.tiq_tournament_entries
as restrictive for insert to anon, authenticated with check (tournament_id not like 'tiq-native-division-%');

-- Pending counts are read with the same event snapshot as the roster and schedule.
create function private.native_tournament_plan_data(p_root text)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', root.id, 'name', root.name, 'date', root.starts_on, 'zone', root.event_details->>'timeZone',
    'divisions', (
      select coalesce(jsonb_agg(jsonb_build_object('id', division.id, 'name', division.name, 'format', division.format,
        'status', division.status, 'entrants', division.entrants, 'results', division.results, 'schedule', division.schedule,
        'pending', (select count(*) from public.tiq_tournament_entries entry
          where entry.tournament_id = division.id and entry.status = 'pending'))
        order by division.name, division.id), '[]'::jsonb)
      from public.tiq_tournaments division
      where division.event_id = root.id and division.is_public and not division.is_event
        and division.id like 'tiq-native-division-%'
    ))
  from public.tiq_tournaments root where root.id = p_root and root.is_public;
$$;
revoke all on function private.native_tournament_plan_data(text) from public, anon, authenticated, service_role;

create function public.native_tournament_draw_plan(
  p_owner uuid, p_event uuid, p_action text default 'read', p_expected text default null,
  p_division text default null, p_match text default null, p_slot jsonb default null
)
returns jsonb language plpgsql security definer set search_path = ''
set lock_timeout = '3s' set statement_timeout = '8s' as $$
declare
  root public.tiq_tournaments;
  division public.tiq_tournaments;
  event_key text;
  data jsonb;
  action_date text;
begin
  if p_owner is null or p_event is null or p_action is null or p_action not in ('read','publish','slot') then
    return jsonb_build_object('code','invalid');
  end if;
  if p_action <> 'read' then
    perform 1 from auth.users where id = p_owner for key share;
    if not found then return jsonb_build_object('code','missing'); end if;
  end if;
  if exists (select 1 from public.account_deletion_requests request
    where request.account_id = p_owner and request.automatic_consent) then
    return jsonb_build_object('code','missing');
  end if;
  -- Refunds and schedule writes always lock the purchase before the event.
  if p_action = 'read' then
    select public_id into event_key from private.native_tournament_purchases
      where owner_id = p_owner and event_id = p_event and environment = 'Production' and status = 'paid';
  else
    select public_id into event_key from private.native_tournament_purchases
      where owner_id = p_owner and event_id = p_event and environment = 'Production' and status = 'paid' for share;
  end if;
  if event_key is null then return jsonb_build_object('code','missing'); end if;
  if p_action = 'read' then
    select * into root from public.tiq_tournaments where id = event_key and is_public and is_event
      and event_id is null and created_by_user_id = p_owner;
  else
    select * into root from public.tiq_tournaments where id = event_key and is_public and is_event
      and event_id is null and created_by_user_id = p_owner for update;
  end if;
  if not found then return jsonb_build_object('code','missing'); end if;
  data := private.native_tournament_plan_data(root.id);
  if data is null then return jsonb_build_object('code','missing'); end if;
  if p_action = 'read' then
    return data || jsonb_build_object('revision', md5(data::text));
  end if;
  if p_expected is distinct from md5(data::text) then return jsonb_build_object('code','stale'); end if;
  select * into division from public.tiq_tournaments
    where id = p_division and event_id = root.id and created_by_user_id = p_owner
      and is_public and not is_event and id like 'tiq-native-division-%' for update;
  if not found then return jsonb_build_object('code','missing'); end if;
  if root.status = 'completed' or division.status = 'completed' then return jsonb_build_object('code','closed'); end if;
  if p_action = 'publish' then
    if division.status <> 'open' or cardinality(division.entrants) < 2 or exists (
      select 1 from public.tiq_tournament_entries entry
      where entry.tournament_id = division.id and entry.status = 'pending'
    ) then return jsonb_build_object('code','review'); end if;
    update public.tiq_tournaments set status = 'scheduled', updated_by_user_id = p_owner where id = division.id;
    -- Keep the event open while another division still accepts entries.
    if root.status = 'open' and not exists (
      select 1 from public.tiq_tournaments item where item.event_id = root.id and item.is_public and item.status = 'open'
    ) then
      update public.tiq_tournaments set status = 'scheduled', updated_by_user_id = p_owner where id = root.id;
    end if;
  else
    -- The authenticated route validates the shared draw and event-wide conflicts against p_expected.
    if division.status <> 'scheduled' or p_match is null or p_match !~ '^r[1-9][0-9]?-m[1-9][0-9]?$'
      or division.results ? p_match then return jsonb_build_object('code','invalid'); end if;
    if p_slot is not null then
      action_date := p_slot->>'date';
      if jsonb_typeof(p_slot) <> 'object' or action_date is null or action_date !~ '^\d{4}-\d{2}-\d{2}$'
        or action_date < root.starts_on or coalesce(p_slot->>'time','') !~ '^([01]\d|2[0-3]):[0-5]\d$'
        or length(coalesce(btrim(p_slot->>'court'),'')) not between 1 and 40 then
        return jsonb_build_object('code','invalid');
      end if;
    end if;
    update public.tiq_tournaments set schedule = case when p_slot is null then schedule - p_match
      else jsonb_set(schedule, array[p_match], p_slot, true) end, updated_by_user_id = p_owner where id = division.id;
  end if;
  data := private.native_tournament_plan_data(root.id);
  return data || jsonb_build_object('revision', md5(data::text));
end;
$$;
revoke all on function public.native_tournament_draw_plan(uuid,uuid,text,text,text,text,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.native_tournament_draw_plan(uuid,uuid,text,text,text,text,jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
