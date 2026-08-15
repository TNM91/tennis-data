create or replace function public.enforce_club_membership_billing_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  club_owner uuid;
  billing_plan text;
  billing_status text;
  staff_count integer;
  player_count integer;
  incoming_is_staff boolean;
  incoming_is_player boolean;
begin
  if new.status <> 'active' then
    return new;
  end if;

  select club.owner_user_id
    into club_owner
  from public.clubs club
  where club.id = new.club_id;

  select billing.plan_id, billing.status
    into billing_plan, billing_status
  from public.club_billing_accounts billing
  where billing.owner_user_id = club_owner;

  if billing_status is null or billing_status not in ('active', 'trial') then
    raise exception 'Club billing is not active.' using errcode = 'P0001';
  end if;

  if billing_plan = 'club_unlimited' then
    return new;
  end if;

  incoming_is_staff := new.roles && array['owner', 'admin', 'director', 'coach', 'captain', 'coordinator']::text[];
  incoming_is_player := 'player' = any(new.roles);

  select
    count(*) filter (where membership.roles && array['owner', 'admin', 'director', 'coach', 'captain', 'coordinator']::text[]),
    count(*) filter (where 'player' = any(membership.roles))
    into staff_count, player_count
  from public.club_memberships membership
  where membership.club_id = new.club_id
    and membership.status = 'active'
    and membership.id is distinct from new.id;

  if incoming_is_staff and staff_count >= 10 then
    raise exception 'Club Starter supports up to 10 active coaches or staff.' using errcode = 'P0001';
  end if;

  if incoming_is_player and player_count >= 150 then
    raise exception 'Club Starter supports up to 150 connected players.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;
comment on function public.enforce_club_membership_billing_limits() is
  'Enforces Club Starter limits of 10 active coaches/staff and 150 connected players; Club Unlimited is uncapped.';
