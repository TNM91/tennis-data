begin;
create table public.calendar_venue_directory (
 id uuid primary key default gen_random_uuid(),
 facility_name text not null check(length(facility_name) between 1 and 160),
 name_keys text[] not null check(cardinality(name_keys) between 1 and 20),
 city text not null check(length(city) between 1 and 100), city_key text not null,
 state_code text not null check(state_code ~ '^[A-Z]{2}$'),
 street_address text not null check(length(street_address) between 3 and 160),
 source_url text not null check(source_url like 'https://%'),
 verified_at timestamptz not null default now(), verified_by uuid references auth.users(id) on delete set null,
 unique(facility_name,city_key,state_code)
);
create index calendar_venue_directory_names on public.calendar_venue_directory using gin(name_keys);
alter table public.calendar_venue_directory enable row level security;
create policy calendar_venue_directory_read on public.calendar_venue_directory for select to anon, authenticated using(true);
revoke all on public.calendar_venue_directory from anon, authenticated;
grant select on public.calendar_venue_directory to anon, authenticated;
grant all on public.calendar_venue_directory to service_role;

insert into public.calendar_venue_directory(facility_name,name_keys,city,city_key,state_code,street_address,source_url) values
 ('Vetta West',array['vetta west','vetta west racquet sports'],'St. Peters','st peters','MO','1330 Harvestowne Industrial Dr','https://vettasports.com/locations/'),
 ('Vetta Sports Club - Concord',array['vetta sports club - concord','vetta concord','vetta concord racquet sports'],'St. Louis','st louis','MO','12320 Old Tesson Rd','https://vettasports.com/location/concord-racquet-sports/'),
 ('Sunset Tennis Center',array['sunset tennis center','vetta sunset'],'St. Louis','st louis','MO','10911 Gravois Industrial Ct','https://vettasports.com/location/sunset-hills-tennis/'),
 ('Woodsmill Tennis Club',array['woodsmill tennis club'],'Chesterfield','chesterfield','MO','910 Old Woods Mill Rd','https://woodsmilltc.com/'),
 ('St. Clair Tennis Club',array['st clair tennis club','st clair tennis'],'O''Fallon','o''fallon','IL','733 Hartman Ln','https://stclairtennis.com/'),
 ('Forest Lake Tennis Club',array['forest lake tennis club'],'Chesterfield','chesterfield','MO','1012 N. Woods Mill Rd','https://forestlaketennisclub.com/contact/'),
 ('Missouri Athletic Club - West',array['missouri athletic club - west','missouri athletic club west'],'Town & Country','town & country','MO','1777 Des Peres Rd','https://www.mac-stl.org/about/contact-us');

create table public.calendar_venue_preferences (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 context_key text not null check(length(context_key) between 1 and 2000),
 facility_name text not null check(length(facility_name) between 1 and 160), name_key text not null,
 city text not null check(length(city) between 1 and 100), state_code text not null check(state_code ~ '^[A-Z]{2}$'),
 street_address text not null check(length(street_address) between 3 and 160),
 source_url text not null default '', directory_id uuid references public.calendar_venue_directory(id) on delete set null,
 review_status text not null default 'private' check(review_status in ('private','pending','approved','rejected')),
 reviewed_at timestamptz, reviewed_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now(),
 unique(owner_user_id,context_key,name_key)
);
alter table public.calendar_venue_preferences enable row level security;
create policy calendar_venue_preferences_read on public.calendar_venue_preferences for select to authenticated using(owner_user_id=auth.uid());
create policy calendar_venue_preferences_insert on public.calendar_venue_preferences for insert to authenticated with check(owner_user_id=auth.uid() and review_status in ('private','pending') and reviewed_by is null and reviewed_at is null);
create policy calendar_venue_preferences_update on public.calendar_venue_preferences for update to authenticated using(owner_user_id=auth.uid()) with check(owner_user_id=auth.uid() and review_status in ('private','pending') and reviewed_by is null and reviewed_at is null);
revoke all on public.calendar_venue_preferences from anon, authenticated;
grant select,insert,update on public.calendar_venue_preferences to authenticated;
grant all on public.calendar_venue_preferences to service_role;
create index calendar_venue_preferences_review on public.calendar_venue_preferences(review_status,updated_at);

alter table public.player_calendar_items add column venue_directory_id uuid references public.calendar_venue_directory(id) on delete set null;
alter table public.player_calendar_items add column venue_preference_id uuid references public.calendar_venue_preferences(id) on delete set null;

-- Admin service-only, atomic publication. A contributor cannot publish a shared
-- address. An exact before-version prevents approving a concurrently edited row.
create function public.review_calendar_venue(p_id uuid,p_updated_at timestamptz,p_actor uuid,p_approve boolean,p_source_url text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.calendar_venue_preferences; v_id uuid;
begin
 select * into r from public.calendar_venue_preferences where id=p_id for update;
 if not found or r.updated_at<>p_updated_at or r.review_status<>'pending' then raise exception 'Venue changed. Refresh before reviewing.'; end if;
 if p_approve then
  if p_source_url not like 'https://%' then raise exception 'Verified source URL required'; end if;
  insert into public.calendar_venue_directory(facility_name,name_keys,city,city_key,state_code,street_address,source_url,verified_by)
  values(r.facility_name,array[r.name_key],r.city,lower(replace(r.city,'.','')),r.state_code,r.street_address,p_source_url,p_actor)
  on conflict(facility_name,city_key,state_code) do update set street_address=excluded.street_address,source_url=excluded.source_url,verified_by=excluded.verified_by,verified_at=now()
  returning id into v_id;
 end if;
 update public.calendar_venue_preferences set review_status=case when p_approve then 'approved' else 'rejected' end,
  directory_id=case when p_approve then v_id else directory_id end,reviewed_at=now(),reviewed_by=p_actor where id=p_id;
 return v_id;
end $$;
revoke all on function public.review_calendar_venue(uuid,timestamptz,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.review_calendar_venue(uuid,timestamptz,uuid,boolean,text) to service_role;
commit;
