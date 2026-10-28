import type {SupabaseClient} from '@supabase/supabase-js'
import {authorizeNativeCaptainScope} from './native-captain-workspace'
import {buildTeamRoomScopeId,normalizeTeamRoomKey,canManageTeamRoom,type TeamRoomScope} from './team-room'
import {loadChatBlocks} from './team-chat-safety'
import {fixtureId} from './team-fixtures-contract'
import type {AvailabilityReplies} from './native-availability-replies-contract'
const fail=(status:number)=>({ok:false as const,status})
const text=(v:unknown)=>typeof v==='string'?v.trim():''
/** Read only: no participant sync, roster inference, alerts or per-message polling. */
export async function loadNativeAvailabilityReplies(service:SupabaseClient,owner:string,scope:TeamRoomScope,messageId:string){
 if(!fixtureId(messageId))return fail(400)
 const access=await authorizeNativeCaptainScope(service,owner,scope);if(!access.ok)return access
 const room=await service.from('internal_conversations').select('id,status').eq('related_entity_type','team_room').eq('related_entity_id',buildTeamRoomScopeId(scope)).maybeSingle()
 if(room.error)return fail(503);if(!room.data||room.data.status==='closed')return fail(403)
 const roomId=String(room.data.id),blocked=await loadChatBlocks(service,owner)
 const message=await service.from('internal_messages').select('id,sender_user_id,metadata').eq('id',messageId).eq('conversation_id',roomId).is('deleted_at',null).maybeSingle()
 if(message.error)return fail(503)
 const metadata=message.data?.metadata
 if(!message.data||blocked.has(message.data.sender_user_id)||!metadata||metadata.teamRoomCard!==true||!['availability','projected_lineup'].includes(metadata.cardType)||!/^\d{4}-\d{2}-\d{2}$/.test(text(metadata.matchDate))||!Number.isFinite(Date.parse(text(metadata.matchDate)+'T12:00:00Z')))return fail(404)
 const [links,participants,removals,responses]=await Promise.all([
  service.from('team_profile_links').select('profile_user_id,team_role,team_roles').eq('normalized_team_name',normalizeTeamRoomKey(scope.teamName)).eq('league_name',scope.leagueName).eq('flight',scope.flight).eq('status','accepted').is('archived_at',null).limit(251),
  service.from('internal_conversation_participants').select('profile_id').eq('conversation_id',roomId).limit(251),
  service.from('team_room_member_removals').select('profile_id').eq('conversation_id',roomId).limit(251),
  service.from('team_room_message_responses').select('profile_id,response').eq('message_id',messageId).limit(251),
 ])
 for(const result of [links,participants,removals,responses])if(result.error||!result.data||result.data.length>250)return fail(503)
 const joined=new Set(participants.data!.map(p=>p.profile_id)),removed=new Set(removals.data!.map(p=>p.profile_id))
 const ids=Array.from(new Set(links.data!.filter(link=>joined.has(link.profile_user_id)&&!blocked.has(link.profile_user_id)&&(canManageTeamRoom(link.team_roles?.length?link.team_roles:[link.team_role])||!removed.has(link.profile_user_id))).map(link=>String(link.profile_user_id))))
 if(!ids.includes(owner))return fail(403)
 const profiles=await service.from('profiles').select('id,message_display_name,linked_player_name').in('id',ids).limit(251)
 if(profiles.error||!profiles.data||profiles.data.length>250)return fail(503)
 const names=new Map(profiles.data.map(p=>[String(p.id),(text(p.message_display_name)||text(p.linked_player_name)||'Team member').slice(0,120)]))
 if(ids.some(id=>!names.has(id)))return fail(503)
 const replies=new Map<string,'yes'|'maybe'|'no'>()
 for(const r of responses.data!){if(!ids.includes(r.profile_id))continue;if(replies.has(r.profile_id)||!['yes','maybe','no'].includes(r.response))return fail(503);replies.set(r.profile_id,r.response)}
 const groups:AvailabilityReplies['groups']={yes:[],maybe:[],no:[],waiting:[]}
 for(const id of ids)groups[replies.get(id)||'waiting'].push(names.get(id)!)
 for(const list of Object.values(groups))list.sort((a,b)=>a.localeCompare(b))
 const result:AvailabilityReplies={ok:true,owner,scope,messageId,matchDate:text(metadata.matchDate),opponent:text(metadata.opponent).slice(0,160),checkedAt:new Date().toISOString(),groups}
 return {ok:true as const,status:200,result}
}
