begin;
set local lock_timeout = '5s';

create function public.native_chat_hit_rematch(p_owner uuid,p_hit uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('room',hit.room_id,'clubId',hit.club_id)
  from private.native_chat_hits hit
  where hit.id=p_hit and hit.status='accepted' and hit.starts_at<=now()
    and private.can_read_native_chat_hit(hit,p_owner)
    and exists (
      select 1 from public.native_personal_matches scorecard
      where scorecard.owner_user_id=p_owner and scorecard.chat_hit_id=hit.id
    );
$$;

revoke all on function public.native_chat_hit_rematch(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.native_chat_hit_rematch(uuid,uuid) to service_role;

notify pgrst,'reload schema';
commit;
