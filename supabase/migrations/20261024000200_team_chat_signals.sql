begin;
-- Content-free invalidation only. The client fetches moderated content through the API.
-- No cascade FK / DELETE grant: retained opaque signal rows cannot emit cross-room DELETE keys.
create table if not exists public.team_chat_signals (
 conversation_id uuid primary key,
 revision bigint not null default 1,
 changed_at timestamptz not null default clock_timestamp()
);
alter table public.team_chat_signals enable row level security;
revoke all on public.team_chat_signals from public, anon, authenticated, service_role;
grant select on public.team_chat_signals to authenticated;
grant select,insert,update on public.team_chat_signals to service_role;

create or replace function public.can_read_team_chat_signal(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists (
  select 1 from public.internal_conversations c
  join public.internal_conversation_participants p on p.conversation_id=c.id and p.profile_id=auth.uid()
  join public.team_profile_links l on l.profile_user_id=auth.uid() and l.status='accepted'
  where c.id=p_conversation_id and c.related_entity_type='team_room'
   and c.related_entity_id =
    pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.lower(coalesce(l.team_name,'')),'[^a-z0-9]+',' ','g')) || '__' ||
    pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.lower(coalesce(l.league_name,'')),'[^a-z0-9]+',' ','g')) || '__' ||
    pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.lower(coalesce(l.flight,'')),'[^a-z0-9]+',' ','g'))
   and (not exists(select 1 from public.team_room_member_removals r where r.conversation_id=c.id and r.profile_id=auth.uid())
    or (case when cardinality(l.team_roles)>0 then l.team_roles else array[coalesce(l.team_role,'player')] end) && array['captain','co_captain'])
 );
$$;
revoke all on function public.can_read_team_chat_signal(uuid) from public,anon,authenticated,service_role;
grant execute on function public.can_read_team_chat_signal(uuid) to authenticated;
drop policy if exists "Accepted team members read chat signals" on public.team_chat_signals;
create policy "Accepted team members read chat signals" on public.team_chat_signals for select to authenticated
 using (public.can_read_team_chat_signal(conversation_id));

create or replace function public.touch_team_chat_signal()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_id uuid;
begin
 for target_id in select distinct targets.id from unnest(case
  when TG_OP='INSERT' then array[NEW.conversation_id]
  when TG_OP='DELETE' then array[OLD.conversation_id]
  else array[OLD.conversation_id,NEW.conversation_id] end) as targets(id)
 loop
  if exists(select 1 from public.internal_conversations c where c.id=target_id and c.related_entity_type='team_room') then
   insert into public.team_chat_signals as s(conversation_id) values(target_id)
    on conflict(conversation_id) do update set revision=s.revision+1,changed_at=clock_timestamp();
  end if;
 end loop;
 if TG_OP='DELETE' then return OLD; else return NEW; end if;
end;
$$;
revoke all on function public.touch_team_chat_signal() from public,anon,authenticated,service_role;
drop trigger if exists internal_messages_team_chat_signal on public.internal_messages;
create trigger internal_messages_team_chat_signal after insert or update or delete on public.internal_messages
 for each row execute function public.touch_team_chat_signal();
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='team_chat_signals') then
  alter publication supabase_realtime add table public.team_chat_signals;
 end if;
end $$;
commit;
