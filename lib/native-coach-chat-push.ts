import 'server-only'
import type {SupabaseClient} from '@supabase/supabase-js'
import {coachConversationId} from './native-coach-chat-unread'
import {chatTimestamp} from './chat-timestamp'
import {deliverAppleChat,nativeCoachPayload,nativePushConfiguration} from './native-chat-push-server'
import {nativeChatBadgeCounts} from './native-chat-badge'
type Input={student:string;conversationId:string;actorId:string;recipientId:string;messageId:string}
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
/** One peer, at most three opted-in devices; no body selection or retry queue. */
export async function loadNativeCoachDevices(service:SupabaseClient,input:Input){
 if(!Object.values(input).every(uuid)||input.actorId===input.recipientId||coachConversationId(input.student)!==input.conversationId)throw Error('Invalid Coach alert')
 const deadline=AbortSignal.timeout(8000),{student,actorId,recipientId,conversationId,messageId}=input
 const pref=await service.from('internal_notification_preferences').select('profile_id,message_alerts_enabled,native_coach_alerts_enabled').eq('profile_id',recipientId).abortSignal(deadline).retry(false).maybeSingle()
 if(pref.error)throw Error('Coach preferences unavailable')
 if(!pref.data||pref.data.profile_id!==recipientId||pref.data.message_alerts_enabled!==true||pref.data.native_coach_alerts_enabled!==true)return []
 const [link,conversation,message,participants]=await Promise.all([
  service.from('coach_player_links').select('id,coach_user_id,player_user_id,status').eq('id',student).abortSignal(deadline).retry(false).maybeSingle(),
  service.from('internal_conversations').select('id,conversation_type,related_entity_type,related_entity_id,status').eq('id',conversationId).abortSignal(deadline).retry(false).maybeSingle(),
  service.from('internal_messages').select('id,conversation_id,sender_user_id,created_at,deleted_at').eq('id',messageId).eq('conversation_id',conversationId).abortSignal(deadline).retry(false).maybeSingle(),
  service.from('internal_conversation_participants').select('profile_id,muted,last_read_at').eq('conversation_id',conversationId).in('profile_id',[actorId,recipientId]).limit(3).abortSignal(deadline).retry(false),
 ])
 if([link,conversation,message,participants].some(r=>r.error))throw Error('Coach access unavailable')
 const l=link.data,c=conversation.data,m=message.data,p=participants.data
 if(!l||l.id!==student||!['active','needs_assignment','review_notes'].includes(l.status)||new Set([l.coach_user_id,l.player_user_id]).size!==2||![l.coach_user_id,l.player_user_id].includes(actorId)||![l.coach_user_id,l.player_user_id].includes(recipientId)||!c||c.id!==conversationId||c.conversation_type!=='direct'||c.related_entity_type!=='coach_student'||c.related_entity_id!==student||!['open','waiting_on_user','waiting_on_admin'].includes(c.status)||!m||m.id!==messageId||m.sender_user_id!==actorId||m.conversation_id!==conversationId||m.deleted_at!==null||!Array.isArray(p)||p.length!==2||new Set(p.map(row=>row.profile_id)).size!==2||p.some(row=>![actorId,recipientId].includes(row.profile_id)))return []
 const recipient=p.find(row=>row.profile_id===recipientId)!,sent=chatTimestamp(m.created_at),read=recipient.last_read_at===null?null:chatTimestamp(recipient.last_read_at)
 if(recipient.muted!==false||sent===null||recipient.last_read_at!==null&&read===null||read!==null&&read>=sent)return []
 const blocks=await service.from('team_chat_blocks').select('owner_user_id').or('and(owner_user_id.eq.'+recipientId+',blocked_user_id.eq.'+actorId+'),and(owner_user_id.eq.'+actorId+',blocked_user_id.eq.'+recipientId+')').limit(2).abortSignal(deadline).retry(false)
 if(blocks.error||!Array.isArray(blocks.data))throw Error('Coach safety unavailable')
 if(blocks.data.length)return []
 const devices=await service.from('native_push_devices').select('installation_id,profile_id,device_token,updated_at').eq('profile_id',recipientId).eq('enabled',true).gt('expires_at',new Date().toISOString()).limit(4).abortSignal(deadline).retry(false)
 if(devices.error||!Array.isArray(devices.data)||devices.data.length>3||devices.data.some(d=>d.profile_id!==recipientId||!uuid(d.installation_id)||typeof d.device_token!=='string'||!/^[a-f0-9]{64,256}$/.test(d.device_token)||typeof d.updated_at!=='string')||new Set(devices.data.map(d=>d.installation_id)).size!==devices.data.length)throw Error('Coach devices unavailable')
 return devices.data as {installation_id:string;profile_id:string;device_token:string;updated_at:string}[]
}
export async function sendNativeCoachChatPush(service:SupabaseClient,input:Input){
 const config=nativePushConfiguration();if(!config)return {sent:0,failed:0}
 try{
  const devices=await loadNativeCoachDevices(service,input);if(!devices.length)return {sent:0,failed:0}
  const badges=await nativeChatBadgeCounts(service,[input.recipientId])
  const result=await deliverAppleChat(devices,'/messages?thread='+input.conversationId,input.conversationId,config,undefined,nativeCoachPayload,badges)
  await Promise.all(result.expired.map(device=>service.from('native_push_devices').update({enabled:false}).eq('installation_id',device.installation_id).eq('profile_id',device.profile_id).eq('device_token',device.device_token).eq('updated_at',device.updated_at).abortSignal(AbortSignal.timeout(2000)).retry(false)))
  if(result.failed)console.warn('native_coach_alert_delivery_incomplete')
  return {sent:result.sent,failed:result.failed}
 }catch{console.warn('native_coach_alert_unavailable');return {sent:0,failed:1}}
}
