import type {SupabaseClient} from '@supabase/supabase-js'
import {CapacitorHttp,type HttpOptions,type HttpResponse} from '@capacitor/core'
import type {TeamScope} from './team-room-data'
import {fixtureId} from '../../lib/team-fixtures-contract'
import type {AvailabilityReminderReview,AvailabilityReminderAction,AvailabilityReminderReceipt} from '../../lib/native-availability-reminder-contract'
export type {AvailabilityReminderReview,AvailabilityReminderAction,AvailabilityReminderReceipt}
export class AvailabilityReminderError extends Error{constructor(public conflict=false){super('Reminder not confirmed.')}}
export type ReminderSend=(method:'GET'|'POST',options:HttpOptions)=>Promise<HttpResponse>
const transport:ReminderSend=(method,options)=>method==='GET'?CapacitorHttp.get(options):CapacitorHttp.post(options)
async function session(client:SupabaseClient,owner:string,current:()=>boolean){const {data,error}=await client.auth.getSession();if(error||data.session?.user.id!==owner||!current())throw new AvailabilityReminderError(true);return data.session}
function envelope(value:unknown,owner:string,scope:TeamScope,id:string){const r=value as AvailabilityReminderReview&AvailabilityReminderReceipt;if(!r||r.ok!==true||r.owner!==owner||r.messageId!==id||r.scope?.teamName!==scope.teamName||r.scope.leagueName!==scope.leagueName||r.scope.flight!==scope.flight)throw new AvailabilityReminderError();return r}
export async function readAvailabilityReminder(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,id:string,send:ReminderSend=transport):Promise<AvailabilityReminderReview>{
 if(scope.chatRoomId||!fixtureId(id))throw new AvailabilityReminderError(true)
 const auth=await session(client,owner,current),r=await send('GET',{url:'https://www.tenaceiq.com/api/mobile/captain/availability-reminder?'+new URLSearchParams({team:scope.teamName,league:scope.leagueName,flight:scope.flight,message:id}),headers:{Authorization:'Bearer '+auth.access_token,'Cache-Control':'no-store'},webFetchExtra:{cache:'no-store'},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:20000});await session(client,owner,current)
 if(r.status!==200)throw new AvailabilityReminderError([400,401,403,404,409].includes(r.status))
 const v=envelope(r.data,owner,scope,id)
 if(typeof v.matchDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v.matchDate)||typeof v.opponent!=='string'||v.opponent.length>160||typeof v.token!=='string'||!/^[a-f0-9]{64}$/.test(v.token)||!Array.isArray(v.names)||v.names.length>250||v.names.some(n=>typeof n!=='string'||!n.trim()||n.length>120)||!Number.isInteger(v.waitingCount)||v.waitingCount<0||v.waitingCount>250||!Number.isInteger(v.excludedCount)||v.excludedCount<0||v.excludedCount+v.names.length!==v.waitingCount||typeof v.canSend!=='boolean'||typeof v.reason!=='string'||v.reason.length>300||typeof v.nextAt!=='string'||v.nextAt!==''&&!Number.isFinite(Date.parse(v.nextAt))||v.canSend&&(!v.names.length||v.names.length>100||!!v.reason))throw new AvailabilityReminderError()
 return {ok:true,owner,scope:{teamName:scope.teamName,leagueName:scope.leagueName,flight:scope.flight},messageId:id,matchDate:v.matchDate,opponent:v.opponent,token:v.token,names:[...v.names],waitingCount:v.waitingCount,excludedCount:v.excludedCount,canSend:v.canSend,reason:v.reason,nextAt:v.nextAt}
}
export function freezeAvailabilityReminder(review:AvailabilityReminderReview,operationId:string):AvailabilityReminderAction{if(!review.canSend||!fixtureId(operationId))throw new AvailabilityReminderError(true);return Object.freeze({messageId:review.messageId,operationId,expectedToken:review.token})}
export async function postAvailabilityReminder(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,action:AvailabilityReminderAction,lookup=false,send:ReminderSend=transport):Promise<AvailabilityReminderReceipt>{
 if(scope.chatRoomId||!fixtureId(action.messageId)||!fixtureId(action.operationId)||!/^[a-f0-9]{64}$/.test(action.expectedToken))throw new AvailabilityReminderError(true)
 const auth=await session(client,owner,current),r=await send('POST',{url:'https://www.tenaceiq.com/api/mobile/captain/availability-reminder',headers:{Authorization:'Bearer '+auth.access_token,'Cache-Control':'no-store','Content-Type':'application/json'},webFetchExtra:{cache:'no-store'},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:30000,data:{teamName:scope.teamName,leagueName:scope.leagueName,flight:scope.flight,...action,lookup}});await session(client,owner,current)
 if(r.status!==200)throw new AvailabilityReminderError([400,401,403,409].includes(r.status))
 const v=envelope(r.data,owner,scope,action.messageId)
 if(v.operationId!==action.operationId||!['recorded','notifications_saved'].includes(v.state)||!Number.isInteger(v.count)||v.count<0||v.count>100||v.state==='recorded'&&v.count!==0||v.state==='notifications_saved'&&v.count===0||typeof v.at!=='string'||!Number.isFinite(Date.parse(v.at)))throw new AvailabilityReminderError()
 return {ok:true,owner,scope:{teamName:scope.teamName,leagueName:scope.leagueName,flight:scope.flight},messageId:action.messageId,operationId:action.operationId,state:v.state,count:v.count,at:v.at}
}
