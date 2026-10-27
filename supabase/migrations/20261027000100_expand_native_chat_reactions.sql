begin;
-- Keep existing social reactions and formal acknowledgment records intact.
alter table public.team_room_message_reactions drop constraint team_room_message_reactions_reaction_check;
alter table public.team_room_message_reactions add constraint team_room_message_reactions_reaction_check
 check (reaction in ('ack','helpful','celebrate','heart','laugh','fire','tennis')) not valid;
alter table public.team_room_message_reactions validate constraint team_room_message_reactions_reaction_check;
create or replace function public.native_chat_reaction_summary(p_conversation uuid,p_messages uuid[],p_owner uuid)
returns table(message_id uuid,reaction text,reaction_count bigint,reacted boolean)
language sql stable security definer set search_path='' as $$
 select r.message_id,r.reaction::text,count(*),bool_or(r.profile_id=p_owner)
 from public.team_room_message_reactions r
 join public.internal_messages m on m.id=r.message_id and m.conversation_id=r.conversation_id
 where r.conversation_id=p_conversation and r.message_id=any(p_messages)
  and cardinality(p_messages)<=75 and m.deleted_at is null and r.reaction in ('helpful','celebrate','heart','laugh','fire','tennis')
  and not exists(select 1 from public.team_chat_blocks b where b.owner_user_id=p_owner and (b.blocked_user_id=r.profile_id or b.blocked_user_id=m.sender_user_id))
 group by r.message_id,r.reaction;
$$;
revoke all on function public.native_chat_reaction_summary(uuid,uuid[],uuid) from public,anon,authenticated,service_role;
grant execute on function public.native_chat_reaction_summary(uuid,uuid[],uuid) to service_role;
commit;
