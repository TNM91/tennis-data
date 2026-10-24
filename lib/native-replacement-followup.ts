import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamRoomScope} from './team-room'
import {lineupRecord} from './native-captain-lineup-contract'
import {loadNativeReplacement} from './native-captain-replacement'
const str=(v:unknown)=>typeof v==='string'?v:''
const fail=(status:number,message:string)=>({ok:false as const,status,message})
export function readReplacementDeadline(value:unknown,matchDate:string,now=Date.now()){
 if(value==='')return ''
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value||Date.parse(value)<=now)throw Error('Choose a future reply-by time.')
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value))
 if(day>matchDate)throw Error('Choose a reply-by time on or before match day.')
 return value
}
/** One explicit action, exact request/version CAS and a committed replay receipt; no scheduled work. */
export async function saveNativeReplacementFollowup(service:SupabaseClient,owner:string,scope:TeamRoomScope,body:Record<string,unknown>){
 const operationId=str(body.operationId),kind=str(body.kind),deadlineAt=kind==='deadline'?str(body.deadlineAt):''
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)||!['deadline','reminder'].includes(kind)||kind==='deadline'&&typeof body.deadlineAt!=='string')return fail(400,'Reopen the replacement request.')
 const loaded=await loadNativeReplacement(service,owner,scope,str(body.fixtureId));if(!loaded.ok)return loaded
 const {state,notice}=loaded;if(!state.card||state.card.id!==body.messageId||notice.publishedAnnouncementMessageId!==body.requestId)return fail(409,'This replacement request changed. Reopen the review.')
 const receipt=lineupRecord(state.card.metadata.nativeReplacementFollowup)
 const same=receipt.operationId===operationId&&receipt.owner===owner
 const currentValue=kind==='deadline'?str(notice.deadlineAt)===deadlineAt:str(notice.reminderSentAt)===receipt.at
 if(same){if(!currentValue||receipt.kind!==kind||receipt.deadlineAt!==deadlineAt||receipt.requestId!==body.requestId||receipt.expectedCardToken!==body.expectedCardToken)return fail(409,'This follow-up changed. Reopen the review.');return {ok:true as const,status:200,replayed:true,messageId:state.card.id,operationId,kind,deadlineAt,conversationId:state.conversationId,replacementPlayerName:str(notice.replacementPlayerName),courtLabel:str(notice.courtLabel)}}
 if(!loaded.review.followUp.canManage||state.token!==body.expectedCardToken)return fail(409,'This replacement request changed or was answered. Reopen the review.')
 if(kind==='reminder'&&!loaded.review.followUp.reminderAvailable)return fail(409,'A reminder was already sent recently. Reopen the review for the next reminder time.')
 if(kind==='deadline'){try{readReplacementDeadline(deadlineAt,state.match.date)}catch(cause){return fail(400,cause instanceof Error?cause.message:'Choose a reply-by time.')}}
 if(kind==='deadline'&&str(notice.deadlineAt)===deadlineAt)return {ok:true as const,status:200,replayed:true,messageId:state.card.id,operationId,kind,deadlineAt,conversationId:state.conversationId,replacementPlayerName:str(notice.replacementPlayerName),courtLabel:str(notice.courtLabel)}
 const now=new Date().toISOString(),nextNotice=kind==='deadline'?{...notice,deadlineAt,deadlineStatus:'',reminderSentAt:notice.reminderSentAt||''}:{...notice,reminderSentAt:now}
 const next={...state.card.metadata,lineupChangeNotice:nextNotice,nativeReplacementFollowup:{operationId,owner,kind,deadlineAt,requestId:body.requestId,expectedCardToken:body.expectedCardToken,at:now}}
 const saved=await service.from('internal_messages').update({metadata:next,edited_at:now}).eq('id',state.card.id).eq('conversation_id',state.conversationId).is('deleted_at',null).filter('metadata','eq',JSON.stringify(state.card.metadata)).select('id').maybeSingle()
 if(saved.error)return fail(503,'Your follow-up could not be confirmed. Retry the same action.')
 if(!saved.data)return fail(409,'The request changed. Reopen the review.')
 return {ok:true as const,status:200,replayed:false,messageId:state.card.id,operationId,kind,deadlineAt,conversationId:state.conversationId,replacementPlayerName:str(notice.replacementPlayerName),courtLabel:str(notice.courtLabel)}
}
