begin;
-- Stop on an unexpected deployed definition rather than replacing unreviewed access rules.
do $$ begin
 if not public.apple_purchase_catalog_ready() then raise exception 'Apple purchase catalog is not ready'; end if;
 if not exists(select 1 from pg_catalog.pg_proc where oid='public.has_current_player_access(uuid)'::regprocedure and prosecdef and proconfig=array['search_path=""'] and md5(regexp_replace(prosrc,'\s','','g'))='2abd931c2ebd8ae24ecf3731226b652a') then raise exception 'Player access definition differs; review before migration'; end if;
 if (select count(*) from pg_policies where schemaname='public' and tablename='lineup_scenarios' and policyname in ('owner insert lineup_scenarios','owner update lineup_scenarios'))<>2 or exists(select 1 from pg_policies where schemaname='public' and tablename='lineup_scenarios' and policyname in ('owner insert lineup_scenarios','owner update lineup_scenarios') and (roles<>array['authenticated']::name[] or md5(coalesce(qual,'')||'|'||coalesce(with_check,''))<>case policyname when 'owner insert lineup_scenarios' then 'cb2dfd129b636dff96d67524672ed240' else '3e65fb2311bf42966f818fd5383596c2' end)) then raise exception 'Owned lineup access differs; review before migration'; end if;
end $$;
-- Preserve existing website/admin grants. Apple access is restricted to the caller's account.
create or replace function public.has_current_player_access(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1
    from public.profiles profile
    where profile.id = target_user_id
      and (
        (
          profile.player_plus_subscription_active = true
          and profile.player_plus_subscription_status in ('trial', 'active')
          and (profile.player_plus_access_expires_at is null or profile.player_plus_access_expires_at > timezone('utc', now()))
        )
        or (
          profile.coach_subscription_active = true
          and profile.coach_subscription_status in ('trial', 'active')
          and (profile.coach_access_expires_at is null or profile.coach_access_expires_at > timezone('utc', now()))
        )
        or (
          profile.captain_subscription_active = true
          and profile.captain_subscription_status in ('trial', 'active')
          and (profile.captain_access_expires_at is null or profile.captain_access_expires_at > timezone('utc', now()))
        )
      )
  ) or (target_user_id=(select auth.uid()) and coalesce((public.my_apple_purchase_access()->>'playerExpiresAt')::timestamptz>now(),false));
$$;

revoke all on function public.has_current_player_access(uuid) from public,anon;
grant execute on function public.has_current_player_access(uuid) to authenticated,service_role;
drop policy if exists "owner insert lineup_scenarios" on public.lineup_scenarios;
create policy "owner insert lineup_scenarios" on public.lineup_scenarios for insert to authenticated
 with check (owner_user_id=(select auth.uid()) and (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.captain_subscription_active and (p.captain_access_expires_at is null or p.captain_access_expires_at>now())) or (public.my_apple_purchase_access()->>'captainExpiresAt')::timestamptz>now()));
drop policy if exists "owner update lineup_scenarios" on public.lineup_scenarios;
create policy "owner update lineup_scenarios" on public.lineup_scenarios for update to authenticated
 using (owner_user_id=(select auth.uid()) and (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.captain_subscription_active and (p.captain_access_expires_at is null or p.captain_access_expires_at>now())) or (public.my_apple_purchase_access()->>'captainExpiresAt')::timestamptz>now()))
 with check (owner_user_id=(select auth.uid()) and (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.captain_subscription_active and (p.captain_access_expires_at is null or p.captain_access_expires_at>now())) or (public.my_apple_purchase_access()->>'captainExpiresAt')::timestamptz>now()));
notify pgrst, 'reload schema';
commit;
