import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamRoomScope} from './team-room'
import {buildTeamRoomScopeId} from './team-room'
import {checkTeamChatAccess} from './team-chat-updates'
import {loadNativeCaptainPractices} from './native-captain-practices'
import {practiceRsvpPath} from './captain-practice-rsvp'
import {validPracticeEditId} from './native-practice-edit'
import {practiceAnnouncementText,type PracticeAnnouncement} from './native-practice-share-contract'
import {nativeInviteToken} from './native-team-invite-contract'
export async function loadNativePracticeSharing(service:SupabaseClient,owner:string,scope:TeamRoomScope,eventId:unknown){
 if(typeof eventId!=='string'||!eventId||eventId.length>120)return {ok:false as const,status:400}
 const snapshot=await loadNativeCaptainPractices(service,owner,scope,eventId);if(!snapshot.ok)return snapshot
 const practice=snapshot.practices.find(p=>p.id===eventId);if(!practice)return {ok:false as const,status:404}
 const room=await service.from('internal_conversations').select('id,status').eq('related_entity_type','team_room').eq('related_entity_id',buildTeamRoomScopeId(scope)).maybeSingle()
 if(room.error)return {ok:false as const,status:503};if(!room.data||room.data.status==='closed')return {ok:false as const,status:403}
 const access=await checkTeamChatAccess(service,owner,room.data.id,false);if(!access.ok)return access
 const invite=await service.from('captain_practice_invites').select('id,event_id,created_by_user_id,public_token').eq('event_id',eventId).eq('created_by_user_id',owner).maybeSingle()
 if(invite.error)return {ok:false as const,status:503};if(!invite.data||invite.data.id!==practice.inviteId||invite.data.event_id!==eventId||invite.data.created_by_user_id!==owner||!nativeInviteToken(invite.data.public_token))return {ok:false as const,status:404}
 return {ok:true as const,status:200,owner,scope,practice,rsvpPath:practiceRsvpPath(invite.data.public_token),roomId:room.data.id as string}
}
export async function announceNativePractice(service:SupabaseClient,owner:string,scope:TeamRoomScope,value:Record<string,unknown>,deliver:(message:{body:string;clientMessageId:string})=>Promise<Response>){
 const a=value as unknown as PracticeAnnouncement,action=value.action
 if(!['announce','lookup'].includes(String(action))||typeof a.eventId!=='string'||!a.eventId||a.eventId.length>120||!validPracticeEditId(a.clientMessageId)||typeof a.expectedUpdatedAt!=='string'||a.expectedUpdatedAt.length>80||!Number.isFinite(Date.parse(a.expectedUpdatedAt))||!['invitation','update','cancelled'].includes(a.kind)||typeof a.note!=='string'||a.note.length>300||a.note!==a.note.trim()||typeof a.body!=='string'||!a.body||a.body.length>2400)return {ok:false as const,status:400}
 const share=await loadNativePracticeSharing(service,owner,scope,a.eventId);if(!share.ok)return share
 if(!a.body.endsWith('\nhttps://www.tenaceiq.com'+share.rsvpPath))return {ok:false as const,status:409}
 const existing=await service.from('internal_messages').select('id,body,message_kind,reply_to_message_id,edited_at,deleted_at,sender_user_id,conversation_id').eq('id',a.clientMessageId).eq('sender_user_id',owner).eq('conversation_id',share.roomId).maybeSingle()
 if(existing.error)return {ok:false as const,status:503}
 const receipt={ok:true as const,status:200,owner,scope,eventId:a.eventId,announcementId:a.clientMessageId,body:a.body}
 if(existing.data){const m=existing.data;return m.id===a.clientMessageId&&m.sender_user_id===owner&&m.conversation_id===share.roomId&&m.body===a.body&&m.message_kind==='announcement'&&!m.reply_to_message_id&&!m.edited_at&&!m.deleted_at?receipt:{ok:false as const,status:409}}
 if(action==='lookup')return {ok:false as const,status:404}
 if(share.practice.updatedAt!==a.expectedUpdatedAt)return {ok:false as const,status:409}
 let text:string;try{text=practiceAnnouncementText(share,scope,a.kind,a.note)}catch{return {ok:false as const,status:409}}
 if(text!==a.body)return {ok:false as const,status:409}
 // Reuse the team's existing announcement authorization, idempotent insertion and alert preferences.
 // This is a bounded freshness check, not a lock spanning the practice and the message insertion.
 const response=await deliver({body:a.body,clientMessageId:a.clientMessageId});if(response.status!==200)return {ok:false as const,status:[400,401,403,409].includes(response.status)?response.status:503}
 const result=await response.json(),m=result?.message
 if(result?.ok!==true||m?.id!==a.clientMessageId||m?.isMine!==true||m?.body!==a.body||m?.kind!=='announcement'||m?.replyToMessageId)return {ok:false as const,status:503}
 return receipt
}
