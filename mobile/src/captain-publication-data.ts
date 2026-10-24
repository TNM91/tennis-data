import {CapacitorHttp,type HttpOptions,type HttpResponse} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamScope} from './team-room-data'
import type {CaptainMatch} from './captain-data'
import {lineupRecord} from '../../lib/native-captain-lineup-contract'
export type PublishedCourt={label:string;players:string[];defaulted?:boolean}
export type PublicationReview={scope:TeamScope;fixtureId:string;matchDate:string;opponent:string;draftVersion:string;expectedCardToken:string;proposal:{canShare:boolean;reason:string;arrivalTime:string;facility:string;lineup:PublishedCourt[]};shared:{active:boolean;messageId:string;lineupId:string;lineup:PublishedCourt[];confirmedCount:number;totalCount:number;courts:{label:string;status:string}[];canFinalize:boolean;alreadyFinal:boolean;pendingFinal:boolean}}
export type PublicationIntent={kind:'proposal'|'final';publicationId:string;review:PublicationReview}
export type PublicationTransport=(method:'GET'|'POST',options:HttpOptions)=>Promise<HttpResponse>
export class PublicationError extends Error{constructor(message:string,public status:number){super(message)}}
const nativeSend:PublicationTransport=(method,options)=>method==='GET'?CapacitorHttp.get(options):CapacitorHttp.post(options)
async function request(client:SupabaseClient,owner:string,current:()=>boolean,url:URL,body:unknown,send:PublicationTransport){
 const session=await client.auth.getSession();if(session.error||session.data.session?.user.id!==owner||!current())throw new PublicationError('Sign in again to review your team lineup.',401)
 let response:HttpResponse;try{response=await send(body?'POST':'GET',{url:url.toString(),headers:{Authorization:`Bearer ${session.data.session.access_token}`,'Content-Type':'application/json'},...(body?{data:body}:{}),disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:30000})}catch{throw new PublicationError('Delivery could not be confirmed. Retry the same request.',0)}
 if(!current())throw new PublicationError('This team review is no longer open.',401)
 const row=lineupRecord(response.data)
 if(response.status!==200||row.ok!==true)throw new PublicationError(response.status===403?'Captain access is required for this team.':response.status===409?'The saved or shared lineup changed. Close and reopen this review.':response.status===400?'Check the lineup before publishing.':'Delivery could not be confirmed. Retry the same request.',response.status)
 return row
}
const text=(value:unknown,max:number)=>{if(typeof value!=='string'||value.length>max)throw new PublicationError('The lineup review could not be confirmed.',503);return value}
function courts(value:unknown):PublishedCourt[]{if(!Array.isArray(value)||value.length>12)throw new PublicationError('The court plan could not be confirmed.',503);return value.map(value=>{const c=lineupRecord(value);if(!Array.isArray(c.players)||c.players.length>4)throw new PublicationError('The court plan could not be confirmed.',503);return {label:text(c.label,80),players:c.players.map(p=>text(p,120)),...(c.defaulted===true?{defaulted:true}:{})}})}
export async function loadPublicationReview(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,match:CaptainMatch,send:PublicationTransport=nativeSend):Promise<PublicationReview>{
 const url=new URL('https://www.tenaceiq.com/api/team-rooms');for(const [key,value] of [['team',scope.teamName],['league',scope.leagueName],['flight',scope.flight],['fixture',match.id],['nativeCaptainReview','1']])url.searchParams.set(key,value)
 const row=await request(client,owner,current,url,null,send),returned=lineupRecord(row.scope),proposal=lineupRecord(row.proposal),shared=lineupRecord(row.shared)
 if(returned.teamName!==scope.teamName||returned.leagueName!==scope.leagueName||returned.flight!==scope.flight||row.fixtureId!==match.id||row.matchDate!==match.date||row.opponent!==match.opponent||!Array.isArray(shared.courts)||shared.courts.length>12||!Number.isInteger(shared.totalCount)||!Number.isInteger(shared.confirmedCount)||Number(shared.totalCount)>12||Number(shared.confirmedCount)<0||Number(shared.confirmedCount)>Number(shared.totalCount)||!(/^[a-f0-9]{64}$/).test(String(row.expectedCardToken)))throw new PublicationError('The selected fixture could not be confirmed.',503)
 const lineup=courts(shared.lineup),total=Number(shared.totalCount),confirmed=Number(shared.confirmedCount)
 return {scope:{...scope},fixtureId:match.id,matchDate:match.date,opponent:match.opponent,draftVersion:text(row.draftVersion,80),expectedCardToken:text(row.expectedCardToken,64),proposal:{canShare:proposal.canShare===true,reason:text(proposal.reason,240),arrivalTime:text(proposal.arrivalTime,80),facility:text(proposal.facility,240),lineup:courts(proposal.lineup)},shared:{active:shared.active===true,messageId:text(shared.messageId,120),lineupId:text(shared.lineupId,240),lineup,confirmedCount:confirmed,totalCount:total,courts:shared.courts.map(value=>{const c=lineupRecord(value);return {label:text(c.label,80),status:text(c.status,40)}}),canFinalize:shared.canFinalize===true&&shared.active===true&&total>0&&confirmed===total&&lineup.length===total,alreadyFinal:shared.alreadyFinal===true,pendingFinal:shared.pendingFinal===true}}
}
export async function sendPublication(client:SupabaseClient,owner:string,current:()=>boolean,intent:PublicationIntent,send:PublicationTransport=nativeSend){
 const r=intent.review
 const body={...r.scope,fixtureId:r.fixtureId,draftVersion:r.draftVersion,expectedCardToken:r.expectedCardToken,nativeClient:true,...(intent.kind==='proposal'?{action:'publish_native_lineup',publicationId:intent.publicationId}:{action:'send_final_lineup',messageId:r.shared.messageId,lineupId:r.shared.lineupId})}
 const row=await request(client,owner,current,new URL('https://www.tenaceiq.com/api/team-rooms'),body,send)
 if(intent.kind==='proposal'){if(typeof row.messageId!=='string'||!row.messageId)throw new PublicationError('Delivery could not be confirmed. Retry the same request.',0)}else{const receipt=lineupRecord(row.finalLineup);if(receipt.lineupId!==r.shared.lineupId||receipt.sourceMessageId!==r.shared.messageId||typeof receipt.announcementMessageId!=='string'||!receipt.announcementMessageId)throw new PublicationError('Final delivery could not be confirmed. Retry the same request.',0)}
 return {draftFinalized:row.draftFinalized===true}
}
