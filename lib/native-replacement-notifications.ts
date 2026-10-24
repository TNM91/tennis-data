import type {SupabaseClient} from '@supabase/supabase-js'
import {buildTeamRoomHref,buildTeamRoomScopeId,canManageTeamRoom,normalizeTeamRoomKey,type TeamRoomScope} from './team-room'
import {chatNotificationRecipients} from './team-chat-safety'
import {sendTeamRoomPush} from './team-room-push-server'
import {sendNativeTeamChatPush} from './native-chat-push-server'
const key=(v:unknown)=>typeof v==='string'?v.trim().toLowerCase().replace(/\s+/g,' '):''
/** Only the publication winner calls this best-effort fanout. Never broadcast a replacement. */
export async function notifyNativeReplacement(service:SupabaseClient,input:{conversationId:string;messageId:string;owner:string;scope:TeamRoomScope;affectedNames:string[];courtLabel:string;replacementPlayerName:string;outgoingPlayerName:string}){
 const [participants,links,removals]=await Promise.all([
  service.from('internal_conversation_participants').select('profile_id,muted').eq('conversation_id',input.conversationId).limit(101),
  service.from('team_profile_links').select('profile_user_id,team_name,league_name,flight,team_role,team_roles').eq('status','accepted').is('archived_at',null).eq('normalized_team_name',normalizeTeamRoomKey(input.scope.teamName)).eq('league_name',input.scope.leagueName).eq('flight',input.scope.flight).limit(1001),
  service.from('team_room_member_removals').select('profile_id').eq('conversation_id',input.conversationId).limit(1001),
 ])
 if(participants.error||links.error||removals.error||(participants.data?.length||0)>100||(links.data?.length||0)>1000||(removals.data?.length||0)>1000)return {notifiedCount:0}
 const scopeId=buildTeamRoomScopeId(input.scope),removed=new Set((removals.data||[]).map(r=>r.profile_id))
 const accepted=new Set((links.data||[]).filter(r=>buildTeamRoomScopeId({teamName:r.team_name,leagueName:r.league_name,flight:r.flight})===scopeId&&(!removed.has(r.profile_user_id)||canManageTeamRoom(r.team_roles?.length?r.team_roles:[r.team_role]))).map(r=>r.profile_user_id))
 const members=(participants.data||[]).filter(p=>accepted.has(p.profile_id)&&!p.muted&&p.profile_id!==input.owner)
 if(!members.length)return {notifiedCount:0}
 const profiles=await service.from('profiles').select('id,linked_player_name').in('id',members.map(p=>p.profile_id));if(profiles.error)return {notifiedCount:0}
 const affected=new Set(input.affectedNames.map(key)),people=profiles.data||[]
 const candidates=people.filter(p=>affected.has(key(p.linked_player_name))&&people.filter(other=>key(other.linked_player_name)===key(p.linked_player_name)).length===1).map(p=>String(p.id))
 const recipients=await chatNotificationRecipients(service,input.owner,candidates);if(!recipients.length)return {notifiedCount:0}
 const url=new URL(buildTeamRoomHref(input.scope),'https://www.tenaceiq.com');url.searchParams.set('message',input.messageId);url.searchParams.set('court',input.courtLabel);url.hash=`match-card-${encodeURIComponent(input.messageId)}`
 const href=url.pathname+url.search+url.hash,title=`${input.scope.teamName} lineup changed`,body=`${input.courtLabel}: ${input.replacementPlayerName} is in for ${input.outgoingPlayerName}.`
 const saved=await service.from('internal_notifications').insert(recipients.map(id=>({recipient_profile_id:id,actor_user_id:input.owner,notification_type:'message',title,body,href,conversation_id:input.conversationId})))
 if(saved.error)return {notifiedCount:0}
 await Promise.all([sendTeamRoomPush(service,recipients,{title,body,href,tag:`team-room-lineup-${input.messageId}`}),sendNativeTeamChatPush(service,{conversationId:input.conversationId,actorId:input.owner,recipients,href,scope:input.scope})])
 return {notifiedCount:recipients.length}
}
