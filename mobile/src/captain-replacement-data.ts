import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamScope} from './team-room-data'
import type {CaptainMatch} from './captain-data'
import {publicationRequest,PublicationError,type PublicationTransport,type PublishedCourt} from './captain-publication-data'
import {lineupRecord} from '../../lib/native-captain-lineup-contract'
export type ReplacementChoice={publicationId:string;expectedCardToken:string;courtLabel:string;outgoingPlayerName:string;replacementKey:string}
export type ReplacementReview={scope:TeamScope;fixtureId:string;matchDate:string;opponent:string;messageId:string;expectedCardToken:string;lineup:PublishedCourt[];candidates:{key:string;name:string}[];canReplace:boolean;reason:string;pending:ReplacementChoice|null;currentChange:{courtLabel:string;replacementPlayerName:string;response:string;pending:boolean}|null}
const text=(v:unknown,max:number)=>{if(typeof v!=='string'||v.length>max)throw new PublicationError('The replacement review could not be confirmed.',503);return v}
const digest=(v:unknown)=>{const token=text(v,64);if(!/^[a-f0-9]{64}$/.test(token))throw new PublicationError('Refresh the replacement review.',503);return token}
function choice(value:unknown):ReplacementChoice|null{if(value===null)return null;const r=lineupRecord(value),publicationId=text(r.publicationId,36);if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(publicationId))throw new PublicationError('Refresh the replacement review.',503);return {publicationId,expectedCardToken:digest(r.expectedCardToken),courtLabel:text(r.courtLabel,80),outgoingPlayerName:text(r.outgoingPlayerName,120),replacementKey:text(r.replacementKey,120)}}
export async function loadReplacementReview(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,match:CaptainMatch,send?:PublicationTransport):Promise<ReplacementReview>{
 const url=new URL('https://www.tenaceiq.com/api/team-rooms');for(const [k,v] of [['team',scope.teamName],['league',scope.leagueName],['flight',scope.flight],['fixture',match.id],['nativeCaptainReplacement','1']])url.searchParams.set(k,v)
 const r=await publicationRequest(client,owner,current,url,null,send),returned=lineupRecord(r.scope)
 if(returned.teamName!==scope.teamName||returned.leagueName!==scope.leagueName||returned.flight!==scope.flight||r.fixtureId!==match.id||r.matchDate!==match.date||r.opponent!==match.opponent||!Array.isArray(r.lineup)||r.lineup.length>12||!Array.isArray(r.candidates)||r.candidates.length>100)throw new PublicationError('The selected fixture could not be confirmed.',503)
 const lineup=r.lineup.map(value=>{const c=lineupRecord(value);if(!Array.isArray(c.players)||c.players.length>2)throw new PublicationError('Check the shared lineup.',503);return {label:text(c.label,80),players:c.players.map(p=>text(p,120)),...(c.defaulted===true?{defaulted:true}:{})}}),change=lineupRecord(r.currentChange)
 return {scope:{...scope},fixtureId:match.id,matchDate:match.date,opponent:match.opponent,messageId:text(r.messageId,120),expectedCardToken:digest(r.expectedCardToken),lineup,candidates:r.candidates.map(value=>{const p=lineupRecord(value);return {key:text(p.key,120),name:text(p.name,120)}}),canReplace:r.canReplace===true,reason:text(r.reason,240),pending:choice(r.pending),currentChange:r.currentChange?{courtLabel:text(change.courtLabel,80),replacementPlayerName:text(change.replacementPlayerName,120),response:text(change.response,20),pending:change.pending===true}:null}
}
export async function sendReplacement(client:SupabaseClient,owner:string,current:()=>boolean,review:ReplacementReview,intent:ReplacementChoice,send?:PublicationTransport){
 const r=await publicationRequest(client,owner,current,new URL('https://www.tenaceiq.com/api/team-rooms'),{...review.scope,fixtureId:review.fixtureId,messageId:review.messageId,...intent,action:'publish_native_replacement',nativeClient:true},send)
 if(r.messageId!==review.messageId||r.publicationId!==intent.publicationId||typeof r.announcementMessageId!=='string'||!r.announcementMessageId)throw new PublicationError('Delivery could not be confirmed. Retry the same replacement.',0)
}
