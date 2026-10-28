import type {SupabaseClient} from '@supabase/supabase-js'
import {sendNativeTeamChatPush} from './native-chat-push-server'
import {buildTeamRoomHref,type TeamRoomScope} from './team-room'
/** Only the first atomic publication calls this; votes and retries never send team alerts. */
export async function notifyNativeTeamPoll(service:SupabaseClient,owner:string,scope:TeamRoomScope,roomId:string,parentId:string){
 const rows=await service.from('internal_conversation_participants').select('profile_id,muted').eq('conversation_id',parentId).limit(251)
 if(rows.error||!Array.isArray(rows.data)||rows.data.length>250)return
 const candidates=rows.data.filter(p=>p.profile_id!==owner&&p.muted!==true).map(p=>String(p.profile_id))
 if(!candidates.length)return
 const [links,removed]=await Promise.all([
  service.from('team_profile_links').select('profile_user_id').eq('team_name',scope.teamName).eq('league_name',scope.leagueName).eq('flight',scope.flight).eq('status','accepted').is('archived_at',null).in('profile_user_id',candidates).limit(251),
  service.from('team_room_member_removals').select('profile_id').eq('conversation_id',parentId).in('profile_id',candidates).limit(251),
 ])
 if(links.error||removed.error||!Array.isArray(links.data)||!Array.isArray(removed.data)||links.data.length>250||removed.data.length>250)return
 const accepted=new Set(links.data.map(p=>String(p.profile_user_id))),excluded=new Set(removed.data.map(p=>String(p.profile_id)))
 const recipients=candidates.filter(id=>accepted.has(id)&&!excluded.has(id));if(!recipients.length)return
 const url=new URL(buildTeamRoomHref(scope),'https://www.tenaceiq.com');if(roomId!==parentId)url.searchParams.set('chatRoom',roomId)
 // The existing sender rechecks accepted membership, removals, blocks and both team/room mute settings.
 return sendNativeTeamChatPush(service,{conversationId:roomId,...(roomId!==parentId?{parentConversationId:parentId}:{}),actorId:owner,recipients,scope,href:url.pathname+url.search})
}
