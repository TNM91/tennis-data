import {createHash} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
import {loadNativeAvailabilityReplyContext} from './native-availability-replies'
import {nativeAvailabilityFixtureOpen} from './native-availability-requests'
import {buildTeamRoomHref,type TeamRoomScope} from './team-room'
import {fixtureId} from './team-fixtures-contract'
import {sendNativeTeamChatPush} from './native-chat-push-server'
import {sendTeamRoomPush} from './team-room-push-server'
import type {AvailabilityReminderReview,AvailabilityReminderAction,AvailabilityReminderReceipt} from './native-availability-reminder-contract'
const fail=(status:number)=>({ok:false as const,status})
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const cooldown=6*60*60*1000
const hrefFor=(scope:TeamRoomScope,id:string,op:string)=>buildTeamRoomHref({...scope,messageId:id})+'&reminder='+op
function notificationId(op:string,owner:string,id:string){const h=hash([op,owner,id]);return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`}
async function context(service:SupabaseClient,owner:string,scope:TeamRoomScope,id:string){
 const r=await loadNativeAvailabilityReplyContext(service,owner,scope,id);if(!r.ok)return r
 const waiting=r.members.filter(m=>!m.response),candidates=waiting.filter(m=>m.id!==owner&&!m.muted)
 const blocks=candidates.length?await service.from('team_chat_blocks').select('owner_user_id').eq('blocked_user_id',owner).in('owner_user_id',candidates.map(m=>m.id)).limit(251):{data:[],error:null}
 if(blocks.error||!blocks.data||blocks.data.length>250)return fail(503)
 const blocked=new Set(blocks.data.map(b=>b.owner_user_id)),targets=candidates.filter(m=>!blocked.has(m.id)).sort((a,b)=>a.id.localeCompare(b.id))
 return {...r,waiting,targets}
}
async function reviewFrom(service:SupabaseClient,owner:string,scope:TeamRoomScope,id:string,c:Extract<Awaited<ReturnType<typeof context>>,{ok:true}>){
 const prior=object(c.metadata.nativeAvailabilityReminder),at=typeof prior.at==='string'?Date.parse(prior.at):NaN,nextAt=Number.isFinite(at)?new Date(at+cooldown).toISOString():''
 let reason=''
 if(c.metadata.availabilityRequestId)reason='Use Captain to follow up on this separate availability invitation.'
 else if(object(c.metadata.lineupChangeNotice).publishedLineupChange===true)reason='Use the replacement request to follow up on this lineup change.'
 else if(!await nativeAvailabilityFixtureOpen(service,scope,c.roomId,id,c.metadata))reason='This shared match request changed or is no longer open. Refresh your team before following up.'
 else if(nextAt&&Date.parse(nextAt)>Date.now())reason='A reminder was recorded recently. Wait until the next reminder time before sending another.'
 else if(!c.targets.length)reason='No unanswered teammates are eligible for a reminder with their current team alert settings.'
 else if(c.targets.length>100)reason='This request exceeds the 100-member reminder limit.'
 const token=hash([owner,scope,id,c.metadata,[...c.members].sort((a,b)=>a.id.localeCompare(b.id)),c.targets.map(m=>m.id)])
 const review:AvailabilityReminderReview={ok:true,owner,scope,messageId:id,matchDate:c.result.matchDate,opponent:c.result.opponent,token,names:c.targets.map(m=>m.name),waitingCount:c.waiting.length,excludedCount:c.waiting.length-c.targets.length,canSend:!reason,reason,nextAt}
 return review
}
export async function loadAvailabilityReminder(service:SupabaseClient,owner:string,scope:TeamRoomScope,id:string){const c=await context(service,owner,scope,id);if(!c.ok)return c;return {ok:true as const,status:200,review:await reviewFrom(service,owner,scope,id,c)}}
async function receipt(service:SupabaseClient,owner:string,scope:TeamRoomScope,a:AvailabilityReminderAction,c:Extract<Awaited<ReturnType<typeof context>>,{ok:true}>){
 const saved=object(c.metadata.nativeAvailabilityReminder)
 if(saved.operationId!==a.operationId)return fail(404)
 if(saved.owner!==owner||saved.expectedToken!==a.expectedToken||typeof saved.at!=='string'||!Number.isFinite(Date.parse(saved.at)))return fail(409)
 const notifications=await service.from('internal_notifications').select('id').eq('conversation_id',c.roomId).eq('actor_user_id',owner).eq('href',hrefFor(scope,a.messageId,a.operationId)).limit(101)
 if(notifications.error||!notifications.data||notifications.data.length>100)return fail(503)
 const result:AvailabilityReminderReceipt={ok:true,owner,scope,messageId:a.messageId,operationId:a.operationId,at:saved.at,state:notifications.data.length?'notifications_saved':'recorded',count:notifications.data.length}
 return {ok:true as const,status:200,result}
}
/** One metadata CAS winner may attempt delivery. Replay/lookup never retries alerts. */
export async function sendAvailabilityReminder(service:SupabaseClient,owner:string,scope:TeamRoomScope,body:Record<string,unknown>){
 const a=body as unknown as AvailabilityReminderAction
 if(!fixtureId(a.messageId)||!fixtureId(a.operationId)||typeof a.expectedToken!=='string'||!/^[a-f0-9]{64}$/.test(a.expectedToken)||body.lookup!==undefined&&typeof body.lookup!=='boolean')return fail(400)
 const c=await context(service,owner,scope,a.messageId);if(!c.ok)return c
 const found=await receipt(service,owner,scope,a,c);if(found.ok||found.status!==404)return found
 if(body.lookup===true)return found
 const review=await reviewFrom(service,owner,scope,a.messageId,c);if(!review.canSend||review.token!==a.expectedToken)return fail(409)
 const at=new Date().toISOString(),proof={operationId:a.operationId,owner,expectedToken:a.expectedToken,at},metadata={...c.metadata,nativeAvailabilityReminder:proof}
 const claim=await service.from('internal_messages').update({metadata,edited_at:at}).eq('id',a.messageId).eq('conversation_id',c.roomId).is('deleted_at',null).filter('metadata','eq',JSON.stringify(c.metadata)).select('id').maybeSingle()
 if(claim.error)return fail(503)
 if(!claim.data){const fresh=await context(service,owner,scope,a.messageId);if(!fresh.ok)return fresh;const prior=await receipt(service,owner,scope,a,fresh);return prior.ok?prior:fail(prior.status===404?409:prior.status)}
 const recorded:AvailabilityReminderReceipt={ok:true,owner,scope,messageId:a.messageId,operationId:a.operationId,state:'recorded',count:0,at}
 // Recheck after claiming and only narrow the reviewed audience. A failure consumes the attempt.
 try{
  const fresh=await context(service,owner,scope,a.messageId)
  if(!fresh.ok)return {ok:true as const,status:200,result:recorded}
  const previous={...c.metadata};delete previous.nativeAvailabilityReminder
  const current={...fresh.metadata};delete current.nativeAvailabilityReminder
  if(hash(previous)!==hash(current)||object(fresh.metadata.nativeAvailabilityReminder).operationId!==a.operationId||!await nativeAvailabilityFixtureOpen(service,scope,c.roomId,a.messageId,fresh.metadata))return {ok:true as const,status:200,result:recorded}
  const reviewed=new Set(c.targets.map(m=>m.id)),recipients=fresh.targets.filter(m=>reviewed.has(m.id)).map(m=>m.id)
  if(!recipients.length)return {ok:true as const,status:200,result:recorded}
  const href=hrefFor(scope,a.messageId,a.operationId),title=`${scope.teamName} needs your availability`,text=`Can you play on ${review.matchDate} vs ${review.opponent}? Open this match request and reply.`
  const saved=await service.from('internal_notifications').insert(recipients.map(id=>({id:notificationId(a.operationId,owner,id),recipient_profile_id:id,actor_user_id:owner,notification_type:'message',title,body:text,href,conversation_id:c.roomId}))).select('id')
  if(saved.error||saved.data?.length!==recipients.length)return {ok:true as const,status:200,result:recorded}
  await Promise.allSettled([sendTeamRoomPush(service,recipients,{title,body:text,href,tag:`availability-${a.messageId}`}),sendNativeTeamChatPush(service,{conversationId:c.roomId,actorId:owner,recipients,scope,href})])
  return {ok:true as const,status:200,result:{...recorded,state:'notifications_saved' as const,count:recipients.length}}
 }catch{return {ok:true as const,status:200,result:recorded}}
}
