create or replace function public.transfer_tiq_league_ownership(
  target_league_id text,
  new_owner_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_owner_user_id uuid := auth.uid();
  saved_owner_user_id uuid;
  previous_owner_email text := '';
  previous_owner_name text := 'Previous league owner';
begin
  if current_owner_user_id is null then
    raise exception 'Sign in as the current league owner to transfer ownership.';
  end if;

  select league.created_by_user_id
    into saved_owner_user_id
    from public.tiq_leagues league
    where league.id = target_league_id
    for update;

  if saved_owner_user_id is null then
    raise exception 'That league could not be found.';
  end if;

  if saved_owner_user_id <> current_owner_user_id then
    raise exception 'Only the current league owner can transfer ownership.';
  end if;

  if new_owner_user_id = current_owner_user_id then
    raise exception 'Choose a different connected delegate as the new owner.';
  end if;

  if not exists (
    select 1
    from public.tiq_league_delegates delegate
    where delegate.league_id = target_league_id
      and delegate.user_id = new_owner_user_id
  ) then
    raise exception 'The new owner must accept a delegate invitation before ownership can be transferred.';
  end if;

  select
    coalesce(account.email, ''),
    coalesce(
      nullif(account.raw_user_meta_data ->> 'full_name', ''),
      nullif(account.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(account.email, ''), '@', 1),
      'Previous league owner'
    )
    into previous_owner_email, previous_owner_name
    from auth.users account
    where account.id = current_owner_user_id;

  delete from public.tiq_league_delegates
    where league_id = target_league_id
      and user_id = new_owner_user_id;

  insert into public.tiq_league_delegates (league_id, user_id, role, email, display_name)
  values (target_league_id, current_owner_user_id, 'delegate', previous_owner_email, previous_owner_name)
  on conflict (league_id, user_id) do update
    set role = 'delegate',
        email = excluded.email,
        display_name = excluded.display_name;

  update public.tiq_leagues
    set created_by_user_id = new_owner_user_id,
        updated_by_user_id = new_owner_user_id,
        updated_at = now()
    where id = target_league_id;
end;
$$;

revoke all on function public.transfer_tiq_league_ownership(text, uuid) from public;
grant execute on function public.transfer_tiq_league_ownership(text, uuid) to authenticated;
