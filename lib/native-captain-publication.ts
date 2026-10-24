import {createHash} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamRoomScope} from './team-room'
import {buildTeamRoomScopeId} from './team-room'
import {loadNativeLineup} from './native-captain-lineup'
import {readLineupPlan,lineupRecord} from './native-captain-lineup-contract'
import {buildTeamSeasonCalendars} from './team-season-calendar'
import {buildLineupChanges,normalizeLineupRows} from './team-room-match-flow'
import {buildCaptainLockedLineupAnnouncement,buildCaptainLockedLineupId} from './captain-lineup-confirmation'
import {readTeamRoomFinalLineupReceipt} from './team-room-final-lineup'
const str=(v:unknown)=>typeof v==='string'?v:''
const nameKey=(value:string)=>value.trim().toLocaleLowerCase().replace(/\s+/g,' ')
const fail=(status:number,message:string)=>({ok:false as const,status,message})
export function nativePublicationToken(id:string,metadata:unknown){return createHash('sha256').update(JSON.stringify([id,metadata])).digest('hex')}
/** Shared legacy cards must also be complete before the native client can finalize them. */
export function nativeSharedLineupIsComplete(value:unknown){
 if(!Array.isArray(value)||!value.length||value.length>12)return false
 const labels=new Set<string>(),names=new Set<string>()
 for(const item of value){const c=lineupRecord(item),label=str(c.label).trim();if(!label||label.length>80||labels.has(nameKey(label)))return false;labels.add(nameKey(label));if(c.defaulted===true)continue
  if(!Array.isArray(c.players)||c.players.length<1||c.players.length>2)return false
  for(const player of c.players){const name=str(player).trim();if(!name||name.length>120||names.has(nameKey(name)))return false;names.add(nameKey(name))}
 }
 return names.size>0
}
function cardId(room:string,date:string){const hex=createHash('sha256').update(`tenaceiq-native-card:${room}:${date}`).digest('hex');return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`}
/** Exact Captain access, roster and fixture checks precede all shared-card reads/writes. */
export async function loadNativePublication(service:SupabaseClient,owner:string,scope:TeamRoomScope,matchId:string){
 const draft=await loadNativeLineup(service,owner,scope,matchId);if(!draft.ok)return draft
 const room=await service.from('internal_conversations').select('id').eq('related_entity_type','team_room').eq('related_entity_id',buildTeamRoomScopeId(scope)).maybeSingle()
 if(room.error||!room.data)return fail(503,'Open the team again before publishing.')
 const escaped=scope.teamName.replace(/\\/g,'\\\\').replace(/"/g,'\\"')
 const fixtures=await service.from('matches').select('id,home_team,away_team,match_date,league_name,flight,line_number,match_type,status').eq('league_name',scope.leagueName).eq('flight',scope.flight).eq('match_date',draft.match.date).is('line_number',null).or(`home_team.eq."${escaped}",away_team.eq."${escaped}"`).limit(3)
 if(fixtures.error)return fail(503,'The fixture could not be confirmed.')
 const sameDay=buildTeamSeasonCalendars(scope.teamName,fixtures.data||[],'').flatMap(s=>s.matches)
 if((fixtures.data?.length||0)>=3||sameDay.length!==1||sameDay[0].id!==matchId)return fail(409,'This team has more than one fixture that day. Shared match cards cannot safely combine these fixtures.')
 const cards=await service.from('internal_messages').select('id,metadata').eq('conversation_id',room.data.id).is('deleted_at',null).contains('metadata',{teamRoomCard:true,matchDate:draft.match.date}).order('created_at',{ascending:false}).limit(2)
 if(cards.error)return fail(503,'The shared lineup could not be checked.')
 if((cards.data?.length||0)>1)return fail(409,'More than one shared card matches this date. Resolve those cards before publishing.')
 const row=cards.data?.[0],metadata=lineupRecord(row?.metadata)
 if(row&&((metadata.matchId&&metadata.matchId!==matchId)||(metadata.opponent&&metadata.opponent!==draft.match.opponent)||metadata.matchCompletedAt))return fail(409,'This match card changed. Refresh the team before publishing.')
 let reason='',lineup:{label:string;players:string[];defaulted?:boolean}[]=[]
 try{
  const plan=readLineupPlan(draft.plan,draft.roster)
  if(!draft.version)throw Error('Save your working lineup before sharing it.')
  if(plan.courts.length>12)throw Error('Shared team cards support up to 12 courts.')
  const labels=new Set<string>(),names=new Set<string>()
  lineup=plan.courts.map(court=>{
   if(court.label.length>80||labels.has(nameKey(court.label)))throw Error('Use distinct court labels of 80 characters or fewer.')
   labels.add(nameKey(court.label))
   const players=court.defaulted?[]:court.players.map(key=>{const person=draft.roster.find(p=>p.key===key);if(!person||person.name.length>120||names.has(nameKey(person.name)))throw Error('Fill each court with distinct roster players before sharing.');names.add(nameKey(person.name));return person.name})
   return {label:court.label,players,...(court.defaulted?{defaulted:true}:{})}
  })
  if(!names.size)throw Error('Assign at least one playing court before sharing.')
 }catch(cause){reason=cause instanceof Error?cause.message:'Check your saved lineup.'}
 const final=readTeamRoomFinalLineupReceipt(metadata.finalLineup)
 if(lineupRecord(metadata.lineupChangeNotice).publishedLineupChange===true)reason='Use a captain lineup change to manage this published replacement.'
 if(final)reason='A final lineup was already sent. Use a captain lineup change to replace a player.'
 const proposal={cardType:'projected_lineup',title:'Proposed lineup',matchDate:draft.match.date,opponent:draft.match.opponent,matchId,matchTime:draft.plan.arrivalTime,facility:draft.plan.location,lineup,captainConfirmedLineup:false,teamRoomCard:true}
 return {ok:true as const,status:200,scope,match:draft.match,roster:draft.roster,draftVersion:draft.version,draftId:draft.draftId,draftSent:draft.sent,deliveryMessageId:draft.deliveryMessageId,conversationId:str(room.data.id),card:row?{id:str(row.id),metadata}:null,token:nativePublicationToken(str(row?.id),row?.metadata||null),proposal,canShare:!reason,reason}
}
/** At-most-once publication effects. A committed card is the replay receipt, even if a notification failed. */
export async function publishNativeLineup(service:SupabaseClient,owner:string,scope:TeamRoomScope,body:Record<string,unknown>){
 const requestId=str(body.publicationId);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))return fail(400,'Reopen the publication review.')
 const state=await loadNativePublication(service,owner,scope,str(body.fixtureId));if(!state.ok)return state
 const receipt=lineupRecord(state.card?.metadata.nativePublication)
 if(receipt.id===requestId&&receipt.owner===owner){if(receipt.draftVersion!==body.draftVersion)return fail(409,'This publication request changed. Reopen the review.');return {ok:true as const,status:200,replayed:true,messageId:state.card!.id,conversationId:state.conversationId}}
 if(!state.canShare)return fail(409,state.reason)
 if(body.draftVersion!==state.draftVersion||body.expectedCardToken!==state.token)return fail(409,'The saved or shared lineup changed. Reopen the publication review.')
 const previous=state.card?.metadata||{},previousLineup=normalizeLineupRows(previous.lineup),changes=buildLineupChanges(previousLineup,state.proposal.lineup)
 const same=previous.cardType==='projected_lineup'&&!changes.length&&previous.matchTime===state.proposal.matchTime&&previous.facility===state.proposal.facility&&previous.opponent===state.proposal.opponent
 if(same)return {ok:true as const,status:200,replayed:true,messageId:state.card!.id,conversationId:state.conversationId}
 const now=new Date().toISOString(),version=Math.max(1,Number(previous.lineupVersion)||0)+(changes.length&&Number(previous.lineupVersion)>0?1:0)
 const metadata={...previous,...state.proposal,lineupVersion:version,lineupChanges:changes,lineupChangedAt:now,lineupChangeNotice:null,finalLineup:null,arrivalCheckIns:[],arrivalOutreach:[],nativePublication:{id:requestId,owner,draftVersion:state.draftVersion}}
 const payload={body:`Proposed lineup for ${state.match.date} vs ${state.match.opponent}. Please confirm whether you can play.`,message_kind:'announcement',metadata}
 const result=state.card?await service.from('internal_messages').update({...payload,edited_at:now}).eq('id',state.card.id).eq('conversation_id',state.conversationId).is('deleted_at',null).filter('metadata','eq',JSON.stringify(previous)).select('id').maybeSingle():await service.from('internal_messages').insert({...payload,id:cardId(state.conversationId,state.match.date),conversation_id:state.conversationId,sender_user_id:owner}).select('id').maybeSingle()
 if(result.error&&result.error.code!=='23505')return fail(503,'Publication could not be confirmed. Retry the same request.')
 if(!result.data){
  const current=await loadNativePublication(service,owner,scope,str(body.fixtureId));if(!current.ok)return current
  const proof=lineupRecord(current.card?.metadata.nativePublication)
  if(proof.id===requestId&&proof.owner===owner&&proof.draftVersion===body.draftVersion)return {ok:true as const,status:200,replayed:true,messageId:current.card!.id,conversationId:current.conversationId}
  return fail(409,'The shared lineup changed. Reopen the review before publishing.')
 }
 return {ok:true as const,status:200,replayed:false,messageId:str(result.data.id),conversationId:state.conversationId,matchDate:state.match.date,body:payload.body}
}
export async function confirmNativeFinalReceipt(service:SupabaseClient,roomId:string,value:unknown){
 const receipt=readTeamRoomFinalLineupReceipt(value);if(!receipt)return false
 const result=await service.from('internal_messages').select('metadata').eq('id',receipt.announcementMessageId).eq('conversation_id',roomId).is('deleted_at',null).maybeSingle()
 const metadata=lineupRecord(result.data?.metadata)
 if(result.error||metadata.sourceMessageId!==receipt.sourceMessageId)return false
 if((metadata.finalLineupAnnouncement===true||metadata.finalLineupChangeAnnouncement===true)&&metadata.lineupId===receipt.lineupId)return true
 // Older website change announcements did not store the locked lineup ID.
 if(metadata.finalLineupChangeAnnouncement!==true)return false
 const source=await service.from('internal_messages').select('metadata').eq('id',receipt.sourceMessageId).eq('conversation_id',roomId).is('deleted_at',null).maybeSingle()
 const card=lineupRecord(source.data?.metadata),notice=lineupRecord(card.lineupChangeNotice),stored=readTeamRoomFinalLineupReceipt(card.finalLineup)
 return !source.error&&!card.matchCompletedAt&&stored?.announcementMessageId===receipt.announcementMessageId&&stored.lineupId===receipt.lineupId
  &&notice.response==='accepted'&&notice.publishedAnnouncementMessageId===receipt.announcementMessageId&&notice.previousFinalLineupId===metadata.previousFinalLineupId&&notice.courtLabel===metadata.courtLabel
  &&buildCaptainLockedLineupId({messageId:receipt.sourceMessageId,lineup:normalizeLineupRows(card.lineup)})===receipt.lineupId
}

/** Reconcile only the unchanged owner draft whose courts actually match the delivered shared lineup. */
export async function markNativeDraftFinal(service:SupabaseClient,owner:string,scope:TeamRoomScope,fixtureId:string,version:string,value:unknown){
 try{
  const state=await loadNativePublication(service,owner,scope,fixtureId),receipt=readTeamRoomFinalLineupReceipt(value)
  if(!state.ok||!receipt||!state.card||receipt.sourceMessageId!==state.card.id||readTeamRoomFinalLineupReceipt(state.card.metadata.finalLineup)?.announcementMessageId!==receipt.announcementMessageId||!state.draftId||!await confirmNativeFinalReceipt(service,state.conversationId,receipt))return false
  if(JSON.stringify(normalizeLineupRows(state.card.metadata.lineup))!==JSON.stringify(normalizeLineupRows(state.proposal.lineup))||state.card.metadata.matchTime!==state.proposal.matchTime||state.card.metadata.facility!==state.proposal.facility)return false
  if(state.draftSent&&state.deliveryMessageId===receipt.announcementMessageId)return true
  if(state.draftVersion!==version)return false
  const now=new Date(Math.max(Date.now(),(Date.parse(version)||0)+1)).toISOString()
  const saved=await service.from('captain_lineup_drafts').update({status:'final',finalized_at:now,delivery_status:'sent',delivered_at:now,team_room_message_id:receipt.announcementMessageId,updated_at:now}).eq('id',state.draftId).eq('user_id',owner).eq('updated_at',version).select('id').maybeSingle()
  return !saved.error&&!!saved.data
 }catch{return false}
}

/** Caller checks current Captain authority and locked court readiness; the stored claim fixes one announcement ID. */
export async function completeNativeFinalAnnouncement(service:SupabaseClient,roomId:string,value:unknown){
 const receipt=readTeamRoomFinalLineupReceipt(value);if(!receipt)return fail(409,'Reopen the current lineup review.')
 const source=await service.from('internal_messages').select('metadata').eq('id',receipt.sourceMessageId).eq('conversation_id',roomId).is('deleted_at',null).maybeSingle()
 if(source.error)return fail(503,'Delivery could not be confirmed. Retry the same request.')
 const metadata=lineupRecord(source.data?.metadata),stored=readTeamRoomFinalLineupReceipt(metadata.finalLineup),lineup=normalizeLineupRows(metadata.lineup)
 if(metadata.cardType!=='projected_lineup'||metadata.matchCompletedAt||stored?.announcementMessageId!==receipt.announcementMessageId||stored.lineupId!==receipt.lineupId||stored.sourceMessageId!==receipt.sourceMessageId||buildCaptainLockedLineupId({messageId:receipt.sourceMessageId,lineup})!==receipt.lineupId)return fail(409,'The final lineup changed. Reopen the review.')
 if(await confirmNativeFinalReceipt(service,roomId,receipt))return {ok:true as const,inserted:false,body:''}
 const body=buildCaptainLockedLineupAnnouncement({lineup,matchDate:str(metadata.matchDate),opponent:str(metadata.opponent),arrivalTime:str(metadata.matchTime),facility:str(metadata.facility)}).slice(0,2400)
 const result=await service.from('internal_messages').insert({id:receipt.announcementMessageId,conversation_id:roomId,sender_user_id:receipt.sentByUserId,body,message_kind:'announcement',metadata:{finalLineupAnnouncement:true,lineupId:receipt.lineupId,sourceMessageId:receipt.sourceMessageId}}).select('id').maybeSingle()
 if(result.error&&result.error.code!=='23505')return fail(503,'Delivery could not be confirmed. Retry the same request.')
 if(!await confirmNativeFinalReceipt(service,roomId,receipt))return fail(503,'Delivery could not be confirmed. Retry the same request.')
 return {ok:true as const,inserted:!!result.data,body}
}
