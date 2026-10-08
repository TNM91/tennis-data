begin;
create table public.tiq_event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.tiq_tournaments(id) on delete cascade,
  tournament_id text not null references public.tiq_tournaments(id) on delete cascade,
  player_one text not null check (length(btrim(player_one)) between 1 and 90),
  player_two text not null default '' check (length(player_two) <= 90),
  entrant_name text not null check (length(entrant_name) between 1 and 200),
  status text not null check (status in ('pending','confirmed','waitlisted','withdrawn')),
  fee_cents integer not null check (fee_cents between 0 and 10000000),
  paid_cents integer not null check (paid_cents between 0 and fee_cents),
  note text not null default '' check (length(note) <= 300),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (tournament_id, entrant_name)
);
create index tiq_event_registrations_event_idx on public.tiq_event_registrations(event_id);
alter table public.tiq_event_registrations enable row level security;
revoke all on public.tiq_event_registrations from anon, authenticated;
grant select on public.tiq_event_registrations to authenticated;
grant all on public.tiq_event_registrations to service_role;
create policy "Event managers read private registrations" on public.tiq_event_registrations
for select to authenticated using (public.can_manage_tiq_tournament(event_id) and public.can_manage_tiq_tournament(tournament_id));

create function public.save_tiq_event_registration(target_event text, registration jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  division public.tiq_tournaments%rowtype;
  old_row public.tiq_event_registrations%rowtype;
  saved public.tiq_event_registrations%rowtype;
  row_id uuid;
  one_name text := btrim(regexp_replace(coalesce(registration->>'player_one',''),'[[:space:]]+',' ','g'));
  two_name text := btrim(regexp_replace(coalesce(registration->>'player_two',''),'[[:space:]]+',' ','g'));
  new_name text;
  new_status text := registration->>'status';
  original_name text := coalesce(registration->>'original_entrant','');
  next_field text[];
  fee integer := (registration->>'fee_cents')::integer;
  paid integer := (registration->>'paid_cents')::integer;
begin
  if auth.uid() is null or not public.can_manage_tiq_tournament(target_event) then raise exception 'Organizer access required.'; end if;
  perform 1 from public.tiq_tournaments where id=target_event and is_event for update;
  if not found then raise exception 'Choose an event.'; end if;
  select * into division from public.tiq_tournaments where id=registration->>'tournament_id' and event_id=target_event for update;
  if not found or not public.can_manage_tiq_tournament(division.id) then raise exception 'Choose a division in this event.'; end if;
  if length(one_name) not between 1 and 90 or length(two_name)>90 or length(coalesce(registration->>'note',''))>300
    or new_status is null or new_status not in ('pending','confirmed','waitlisted','withdrawn')
    or fee is null or paid is null or fee not between 0 and 10000000 or paid not between 0 and fee then raise exception 'Invalid registration.'; end if;
  if two_name<>'' and lower(one_name)=lower(two_name) then raise exception 'Choose two different players.'; end if;
  if division.entrant_type='players' and two_name<>'' then raise exception 'Singles entries have one player.'; end if;
  if new_status='confirmed' and division.entrant_type='teams' and two_name='' then raise exception 'Add a partner before confirming this team.'; end if;
  new_name := one_name || case when two_name<>'' then ' / ' || two_name else '' end;
  if coalesce(registration->>'id','')<>'' then
    row_id := (registration->>'id')::uuid;
    select * into old_row from public.tiq_event_registrations where id=row_id and event_id=target_event and tournament_id=division.id for update;
    if not found or old_row.updated_at is distinct from (registration->>'expected_updated_at')::timestamptz then raise exception 'Registration changed. Refresh before saving.'; end if;
    original_name := case when old_row.entrant_name=any(division.entrants) then old_row.entrant_name else '' end;
  else
    row_id := gen_random_uuid();
    if original_name<>'' and (not original_name=any(division.entrants) or exists(select 1 from public.tiq_event_registrations where tournament_id=division.id and entrant_name=original_name)) then raise exception 'Registration changed. Refresh before saving.'; end if;
  end if;
  if new_status<>'withdrawn' and exists(select 1 from public.tiq_event_registrations r where r.tournament_id=division.id and r.id<>row_id and r.status<>'withdrawn'
    and (lower(r.player_one) in (lower(one_name),nullif(lower(two_name),'')) or (r.player_two<>'' and lower(r.player_two) in (lower(one_name),nullif(lower(two_name),''))))) then raise exception 'This player is already registered in this division.'; end if;
  if new_status<>'withdrawn' and exists(select 1 from unnest(division.entrants) team, regexp_split_to_table(team,'[[:space:]]*/[[:space:]]*') player where team<>original_name and lower(btrim(player)) in (lower(one_name),nullif(lower(two_name),''))) then raise exception 'This player is already registered in this division.'; end if;
  next_field := coalesce(division.entrants,'{}'::text[]);
  if original_name<>'' then next_field := array_remove(next_field,original_name); end if;
  if new_status='confirmed' then
    if exists(select 1 from unnest(next_field) n where lower(n)=lower(new_name)) then raise exception 'This team is already in the confirmed field.'; end if;
    if original_name=new_name and original_name=any(division.entrants) then next_field := division.entrants;
    else next_field := array_append(next_field,new_name); end if;
  end if;
  if next_field is distinct from division.entrants then
    if division.status='completed' or exists(select 1 from public.tiq_tournaments where id=target_event and status='completed') then raise exception 'Completed division field cannot be changed.'; end if;
    if division.results <> '{}'::jsonb then raise exception 'Clear results before changing the confirmed field.'; end if;
    if division.schedule <> '{}'::jsonb then raise exception 'Court slots are assigned. Clear the division schedule before changing its field.'; end if;
    update public.tiq_tournaments set entrants=next_field,updated_by_user_id=auth.uid(),updated_at=clock_timestamp() where id=division.id;
  end if;
  insert into public.tiq_event_registrations(id,event_id,tournament_id,player_one,player_two,entrant_name,status,fee_cents,paid_cents,note)
    values(row_id,target_event,division.id,one_name,two_name,new_name,new_status,fee,paid,coalesce(registration->>'note',''))
    on conflict(id) do update set player_one=excluded.player_one,player_two=excluded.player_two,entrant_name=excluded.entrant_name,status=excluded.status,fee_cents=excluded.fee_cents,paid_cents=excluded.paid_cents,note=excluded.note,updated_at=clock_timestamp()
    returning * into saved;
  return to_jsonb(saved);
end;
$$;
revoke all on function public.save_tiq_event_registration(text,jsonb) from public,anon;
grant execute on function public.save_tiq_event_registration(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
