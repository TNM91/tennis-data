import {replacementReminderIsCurrent} from './replacement-reminder-target'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamRoomScope} from './team-room'
import {loadNativePublication,nativeSharedLineupIsComplete,confirmNativeFinalReceipt} from './native-captain-publication'
import {lineupRecord} from './native-captain-lineup-contract'
import {buildCaptainLockedLineupId} from './captain-lineup-confirmation'
import {readTeamRoomFinalLineupReceipt,buildPublishedLineupChangeAnnouncement} from './team-room-final-lineup'
import {normalizeLineupRows,buildLineupChangeNotice,buildLineupChanges,parseReminderTargets} from './team-room-match-flow'
import {keepTeamRoomArrivalCheckInsForLineup,keepTeamRoomArrivalOutreachForLineup} from './team-room-arrival'
const str=(v:unknown)=>typeof v==='string'?v:''
const key=(v:string)=>v.trim().toLowerCase().replace(/\s+/g,' ')
const fail=(status:number,message:string)=>({ok:false as const,status,message})
const uuid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
export type ReplacementIntent={publicationId:string;expectedCardToken:string;courtLabel:string;outgoingPlayerName:string;replacementKey:string;supersede?:boolean}
function intentOf(value:unknown):ReplacementIntent|null{const r=lineupRecord(value);return uuid(str(r.publicationId))&&str(r.expectedCardToken)&&str(r.courtLabel)&&str(r.outgoingPlayerName)&&str(r.replacementKey)?{publicationId:str(r.publicationId),expectedCardToken:str(r.expectedCardToken),courtLabel:str(r.courtLabel),outgoingPlayerName:str(r.outgoingPlayerName),replacementKey:str(r.replacementKey),...(r.supersede===true?{supersede:true}:{})}:null}
async function changeDelivered(service:SupabaseClient,room:string,source:string,notice:Record<string,unknown>){
 const id=str(notice.publishedAnnouncementMessageId);if(!id)return false
 const result=await service.from('internal_messages').select('metadata').eq('id',id).eq('conversation_id',room).is('deleted_at',null).maybeSingle(),m=lineupRecord(result.data?.metadata)
 return !result.error&&m.finalLineupChangeAnnouncement===true&&m.sourceMessageId===source&&m.previousFinalLineupId===notice.previousFinalLineupId&&m.courtLabel===notice.courtLabel
}
export async function loadNativeReplacement(service:SupabaseClient,owner:string,scope:TeamRoomScope,fixture:string){
 const state=await loadNativePublication(service,owner,scope,fixture);if(!state.ok)return state
 const metadata=state.card?.metadata||{},notice=lineupRecord(metadata.lineupChangeNotice),receipt=lineupRecord(metadata.nativeReplacement),lineup=normalizeLineupRows(metadata.lineup)
 let reason=''
 if(!state.card||metadata.cardType!=='projected_lineup'||!nativeSharedLineupIsComplete(metadata.lineup))reason='Send a complete final lineup before choosing a replacement.'
 const final=readTeamRoomFinalLineupReceipt(metadata.finalLineup)
 const changeProof=state.card&&notice.publishedLineupChange===true?await changeDelivered(service,state.conversationId,state.card.id,notice):false
 const finalMatches=final&&state.card&&final.sourceMessageId===state.card.id&&final.lineupId===buildCaptainLockedLineupId({messageId:state.card.id,lineup})
 const confirmed=finalMatches&&(await confirmNativeFinalReceipt(service,state.conversationId,final)||changeProof&&notice.response==='accepted'&&notice.publishedAnnouncementMessageId===final.announcementMessageId)
 const declined=notice.publishedLineupChange===true&&notice.response==='declined'&&changeProof
 if(!reason&&!confirmed&&!declined)reason='A delivered final lineup is required before replacing a player.'
 const pending=receipt.owner===owner&&notice.pending===true?intentOf(receipt):null
 const currentCourt=lineup.find(c=>c.label===notice.courtLabel)
 const waiting=!!state.card&&nativeSharedLineupIsComplete(metadata.lineup)&&changeProof&&notice.pending===false&&!notice.response&&!!currentCourt&&!currentCourt.defaulted
  &&JSON.stringify(currentCourt.players)===JSON.stringify(notice.afterPlayers)&&currentCourt.players.includes(str(notice.replacementPlayerName))
 let scheduledReminderAt=''
 if(waiting){
  const schedule=await service.from('team_room_reminder_schedules').select('targets,reminder_at,status,updated_at').eq('conversation_id',state.conversationId).eq('message_id',state.card!.id).maybeSingle()
  if(schedule.error)return fail(503,'Reminder settings could not be checked.')
  const row=schedule.data,relevant=parseReminderTargets(row?.targets).some(t=>t.needsLineupChangeResponse&&replacementReminderIsCurrent(metadata,t.lineupChangeRequestId||'',str(row?.updated_at)))
  const inFlight=row?.status==='sent'&&notice.deadlineStatus==='scheduled'&&Date.parse(str(row.updated_at))>Date.now()-5*60*1000
  if(relevant&&(row?.status==='scheduled'||inFlight))scheduledReminderAt=str(row?.reminder_at)||'scheduled'
 }
 const lastReminder=Date.parse(str(notice.reminderSentAt)),nextReminder=Number.isFinite(lastReminder)?lastReminder+6*60*60*1000:0

 if(notice.pending===true||notice.publishedLineupChange===true&&!['accepted','declined'].includes(str(notice.response)))reason='Wait for the current replacement reply before choosing another player.'
 // Only unique current roster names can be mapped back to legacy shared cards.
 const roster=state.roster.filter(p=>p.name&&p.name.length<=120&&state.roster.filter(other=>key(other.name)===key(p.name)).length===1)
 const assigned=new Set(lineup.flatMap(c=>c.players.map(key)))
 const candidates=roster.filter(p=>!assigned.has(key(p.name))).slice(0,100).map(p=>({key:p.key,name:p.name}))
 if(!reason&&!candidates.length)reason='No unassigned roster player is available to choose.'
 return {ok:true as const,status:200,state,lineup,notice,receipt,review:{scope,fixtureId:fixture,matchDate:state.match.date,opponent:state.match.opponent,messageId:state.card?.id||'',expectedCardToken:state.token,lineup,candidates,canReplace:!reason,canSupersede:waiting&&candidates.length>0,followUp:{canManage:waiting&&!scheduledReminderAt,scheduledReminderAt,requestId:waiting?str(notice.publishedAnnouncementMessageId):'',deadlineAt:str(notice.deadlineAt),reminderAvailable:waiting&&!scheduledReminderAt&&Date.now()>=nextReminder,reminderAvailableAt:nextReminder?new Date(nextReminder).toISOString():''},reason,pending,currentChange:notice.publishedLineupChange===true?{courtLabel:str(notice.courtLabel),replacementPlayerName:str(notice.replacementPlayerName),response:str(notice.response),pending:notice.pending===true}:null}}
}
/** CAS one changed court, finish one fixed announcement, then open player replies. No automatic retry. */
export async function publishNativeReplacement(service:SupabaseClient,owner:string,scope:TeamRoomScope,body:Record<string,unknown>){
 const intent=intentOf(body);if(!intent)return fail(400,'Choose the court and replacement again.')
 const loaded=await loadNativeReplacement(service,owner,scope,str(body.fixtureId));if(!loaded.ok)return loaded
 const {state}=loaded;if(!state.card||state.card.id!==body.messageId)return fail(409,'Reopen the current shared lineup.')
 let metadata=state.card.metadata,receipt=lineupRecord(metadata.nativeReplacement),notice=lineupRecord(metadata.lineupChangeNotice)
 const replay=receipt.publicationId===intent.publicationId&&receipt.owner===owner
 if(replay){if(JSON.stringify(intentOf(receipt))!==JSON.stringify(intent))return fail(409,'This replacement request changed. Reopen the review.')}else{
  if((!loaded.review.canReplace&&!(intent.supersede===true&&loaded.review.canSupersede))||state.token!==intent.expectedCardToken)return fail(409,loaded.review.reason||'The shared lineup changed. Reopen the review.')
  if(intent.supersede===true&&(!loaded.review.canSupersede||intent.courtLabel!==loaded.notice.courtLabel||intent.outgoingPlayerName!==loaded.notice.replacementPlayerName))return fail(409,'Choose the player with the outstanding replacement request.')
  const replacement=loaded.review.candidates.find(p=>p.key===intent.replacementKey),court=loaded.lineup.find(c=>c.label===intent.courtLabel)
  if(!replacement||!court||court.defaulted||!court.players.includes(intent.outgoingPlayerName))return fail(400,'Choose an assigned player and an unassigned roster replacement.')
  const lineup=loaded.lineup.map(c=>c===court?{...c,players:c.players.map(name=>name===intent.outgoingPlayerName?replacement.name:name)}:c)
  const change=buildLineupChangeNotice(loaded.lineup,lineup,{courtLabel:court.label,outgoingPlayerName:intent.outgoingPlayerName,replacementPlayerName:replacement.name})
  if(!change||!nativeSharedLineupIsComplete(lineup))return fail(400,'Check the replacement court.')
  const previousFinal=readTeamRoomFinalLineupReceipt(metadata.finalLineup),previousId=previousFinal?.lineupId||str(notice.previousFinalLineupId)
  const now=new Date().toISOString()
  receipt={...intent,owner,lineup,previousFinalLineupId:previousId,announcementMessageId:crypto.randomUUID()}
  notice={...change,pending:true,notifiedAt:'',notifiedCount:0,response:'',respondedAt:'',responderProfileId:'',responderName:'',deadlineAt:'',deadlineStatus:'',reminderSentAt:'',publishedLineupChange:true,previousFinalLineupId:previousId,publishedAnnouncementMessageId:receipt.announcementMessageId,publishedAt:now,publishedByUserId:owner,publishedByName:'Team captain'}
  const next={...metadata,lineup,lineupVersion:Math.max(1,Number(metadata.lineupVersion)||0)+1,lineupChanges:buildLineupChanges(loaded.lineup,lineup),lineupChangedAt:now,lineupChangeNotice:notice,nativeReplacement:receipt,nativeReplacementReply:null,finalLineup:null,arrivalCheckIns:keepTeamRoomArrivalCheckInsForLineup(lineup,metadata.arrivalCheckIns),arrivalOutreach:keepTeamRoomArrivalOutreachForLineup(lineup,metadata.arrivalOutreach)}
  const saved=await service.from('internal_messages').update({metadata:next,edited_at:now}).eq('id',state.card.id).eq('conversation_id',state.conversationId).is('deleted_at',null).filter('metadata','eq',JSON.stringify(metadata)).select('id').maybeSingle()
  if(saved.error)return fail(503,'Delivery could not be confirmed. Retry the same replacement.')
  if(!saved.data)return fail(409,'The shared lineup changed. Reopen the review.')
  metadata=next
 }
 // The exact committed intent and its court must still be current before recovery.
 const current=await service.from('internal_messages').select('metadata').eq('id',state.card.id).eq('conversation_id',state.conversationId).is('deleted_at',null).maybeSingle()
 if(current.error)return fail(503,'Delivery could not be confirmed. Retry the same replacement.')
 metadata=lineupRecord(current.data?.metadata);const stored=lineupRecord(metadata.nativeReplacement);notice=lineupRecord(metadata.lineupChangeNotice)
 const court=normalizeLineupRows(metadata.lineup).find(c=>c.label===notice.courtLabel)
 if(metadata.cardType!=='projected_lineup'||metadata.matchCompletedAt||JSON.stringify(intentOf(stored))!==JSON.stringify(intent)||JSON.stringify(normalizeLineupRows(metadata.lineup))!==JSON.stringify(stored.lineup)||notice.previousFinalLineupId!==stored.previousFinalLineupId||stored.publicationId!==intent.publicationId||stored.owner!==owner||notice.publishedAnnouncementMessageId!==receipt.announcementMessageId||!court||JSON.stringify(court.players)!==JSON.stringify(notice.afterPlayers))return fail(409,'This replacement was superseded. Reopen the review.')
 const bodyText=buildPublishedLineupChangeAnnouncement({courtLabel:str(notice.courtLabel),outgoingPlayerName:str(notice.outgoingPlayerName),replacementPlayerName:str(notice.replacementPlayerName),afterPlayers:court.players,matchDate:state.match.date,opponent:state.match.opponent})
 if(!await changeDelivered(service,state.conversationId,state.card.id,notice)){
  if(notice.pending!==true)return fail(409,'The delivered replacement could not be confirmed. Refresh the team.')
  const inserted=await service.from('internal_messages').insert({id:receipt.announcementMessageId,conversation_id:state.conversationId,sender_user_id:owner,body:bodyText,message_kind:'announcement',metadata:{finalLineupChangeAnnouncement:true,lineupId:buildCaptainLockedLineupId({messageId:state.card.id,lineup:normalizeLineupRows(metadata.lineup)}),sourceMessageId:state.card.id,previousFinalLineupId:notice.previousFinalLineupId,courtLabel:notice.courtLabel}}).select('id').maybeSingle()
  if(inserted.error&&inserted.error.code!=='23505')return fail(503,'Delivery could not be confirmed. Retry the same replacement.')
  if(!await changeDelivered(service,state.conversationId,state.card.id,notice))return fail(503,'Delivery could not be confirmed. Retry the same replacement.')
 }
 let winner=false
 if(notice.pending===true){
  const nextNotice={...notice,pending:false,notifiedAt:new Date().toISOString()}
  const opened=await service.from('internal_messages').update({metadata:{...metadata,lineupChangeNotice:nextNotice}}).eq('id',state.card.id).eq('conversation_id',state.conversationId).is('deleted_at',null).filter('metadata','eq',JSON.stringify(metadata)).select('id').maybeSingle()
  if(opened.error)return fail(503,'Delivery could not be confirmed. Retry the same replacement.')
  if(!opened.data)return fail(409,'The lineup changed. Reopen the replacement review.')
  winner=true;notice=nextNotice
 }
 return {ok:true as const,status:200,replayed:!winner,messageId:state.card.id,announcementMessageId:str(receipt.announcementMessageId),publicationId:intent.publicationId,conversationId:state.conversationId,notice,body:bodyText}
}
