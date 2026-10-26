begin;
do $$ begin
 if not (has_table_privilege('authenticated','public.lineup_scenarios','SELECT') and has_table_privilege('authenticated','public.lineup_scenarios','INSERT') and has_table_privilege('authenticated','public.lineup_scenarios','UPDATE')) then raise exception 'Existing scenario grants differ; review before migration'; end if;
 if exists(select 1 from pg_policies where schemaname='public' and tablename='lineup_scenarios' and policyname not in ('public read lineup_scenarios','admin read lineup_scenarios','admin insert lineup_scenarios','admin update lineup_scenarios','admin delete lineup_scenarios','owner insert lineup_scenarios','owner update lineup_scenarios')) then raise exception 'Unexpected scenario policy; review before migration'; end if;
 if not exists(select 1 from pg_indexes where schemaname='public' and indexname='lineup_scenarios_owner_name_scope_key') and not exists(select 1 from pg_policies where schemaname='public' and tablename='lineup_scenarios' and policyname='public read lineup_scenarios' and cmd='SELECT' and qual='true') then raise exception 'Legacy visibility changed; review before migration'; end if;
 if exists(select 1 from pg_policies where schemaname='public' and tablename='lineup_scenarios' and policyname in ('admin insert lineup_scenarios','admin update lineup_scenarios','admin delete lineup_scenarios') and (roles<>array['authenticated']::name[] or coalesce(qual,'is_admin()')<>'is_admin()' or coalesce(with_check,'is_admin()')<>'is_admin()')) then raise exception 'Admin scenario policies differ; review before migration'; end if;
end $$;
-- Existing unowned scenarios retain their existing public-read behavior. New saves
-- default to their creator; neither client may turn an owned row into a public row.
alter table public.lineup_scenarios add column if not exists owner_user_id uuid references auth.users(id) on delete cascade;
alter table public.lineup_scenarios alter column owner_user_id set default auth.uid();
alter table public.lineup_scenarios enable row level security;
do $$ begin
 if exists(select 1 from pg_policies where schemaname='public' and tablename='lineup_scenarios' and cmd='SELECT' and policyname not in ('public read lineup_scenarios','admin read lineup_scenarios')) then raise exception 'Unexpected scenario SELECT policy; review before changing visibility'; end if;
end $$;
drop policy if exists "public read lineup_scenarios" on public.lineup_scenarios;
create policy "public read lineup_scenarios" on public.lineup_scenarios for select to anon, authenticated
 using (owner_user_id is null or owner_user_id=(select auth.uid()));
drop policy if exists "admin read lineup_scenarios" on public.lineup_scenarios;
create policy "admin read lineup_scenarios" on public.lineup_scenarios for select to authenticated using(public.is_admin());
drop policy if exists "owner insert lineup_scenarios" on public.lineup_scenarios;
create policy "owner insert lineup_scenarios" on public.lineup_scenarios for insert to authenticated
 with check (owner_user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.captain_subscription_active and (p.captain_access_expires_at is null or p.captain_access_expires_at>now())));
drop policy if exists "owner update lineup_scenarios" on public.lineup_scenarios;
create policy "owner update lineup_scenarios" on public.lineup_scenarios for update to authenticated
 using (owner_user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.captain_subscription_active and (p.captain_access_expires_at is null or p.captain_access_expires_at>now())))
 with check (owner_user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.captain_subscription_active and (p.captain_access_expires_at is null or p.captain_access_expires_at>now())));
create unique index if not exists lineup_scenarios_owner_name_scope_key on public.lineup_scenarios(owner_user_id,team_name,coalesce(league_name,''),coalesce(flight,''),coalesce(match_date,'-infinity'::date),coalesce(opponent_team,''),lower(btrim(scenario_name))) where owner_user_id is not null;
-- Existing table grants remain unchanged.
notify pgrst, 'reload schema';
commit;
