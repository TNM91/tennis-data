import type {SupabaseClient} from '@supabase/supabase-js'
import {mapPlayerCalendarItemRow,type PlayerCalendarItemRow} from './player-calendar-items'
import {playerCalendarSelect} from './player-calendar-storage'
import {applyCalendarVenueLocations} from './venue-calendar-storage'
import {mapApprovedCompetitionSchedule} from './player-competition-schedule'
import {mapCoachAssignmentRow,type CoachAssignmentRow} from './coach-storage'
import {buildCoachStudentCalendarEvents} from './coach-calendar'
import {calendarPayload,personalDraft,sameCalendarDraft,type CalendarIntent,type CalendarRange,type NativeCalendar,type CalendarSharedDate} from './native-calendar-contract'

export class CalendarFault extends Error {constructor(public status:number,message:string){super(message)}}
const conflict=()=>new CalendarFault(409,'This date changed. Refresh and review it before saving again.')
const stamp=(previous:string)=>new Date(Math.max(Date.now(),Date.parse(previous)+1)).toISOString()
const inRange=(date:string,range:CalendarRange)=>date>=range.from&&date<=range.to
function rows<T>(result:{data:T[]|null;error:unknown},limit=500):T[]{if(result.error||!Array.isArray(result.data)||result.data.length>limit)throw Error('Calendar source unavailable');return result.data}

export async function calendarPersonal(client:SupabaseClient,owner:string,id:string){
 const found=await client.from('player_calendar_items').select(playerCalendarSelect).eq('player_user_id',owner).eq('id',id).maybeSingle()
 if(found.error)throw Error('Calendar read unavailable')
 if(!found.data)return null
 if(found.data.player_user_id!==owner||found.data.id!==id)throw Error('Calendar owner changed')
 return mapPlayerCalendarItemRow((await applyCalendarVenueLocations(client,owner,[found.data as PlayerCalendarItemRow]))[0])
}
export async function calendarCompetitions(client:SupabaseClient,owner:string){
 const [t,l,r]=await Promise.all([
  client.from('tiq_tournament_entries').select('id,tournament_id,player_name,linked_player_id,submitted_by_user_id').eq('submitted_by_user_id',owner).eq('status','approved').limit(101),
  client.from('tiq_player_league_entries').select('id,league_id,player_name,player_id,created_by_user_id').eq('created_by_user_id',owner).eq('entry_status','active').limit(101),
  client.from('player_schedule_responses').select('event_id,response,event_snapshot,updated_at,player_user_id').eq('player_user_id',owner).limit(501),
 ])
 const tournamentEntries=rows(t,100),leagueEntries=rows(l,100),responses=rows(r)
 if(tournamentEntries.some(r=>r.submitted_by_user_id!==owner)||leagueEntries.some(r=>r.created_by_user_id!==owner)||responses.some(r=>r.player_user_id!==owner))throw Error('Calendar owner changed')
 const tournamentIds=[...new Set(tournamentEntries.map(r=>r.tournament_id))],leagueIds=[...new Set(leagueEntries.map(r=>r.league_id))]
 const empty={data:[],error:null}
 const [a,b,c]=await Promise.all([
  tournamentIds.length?client.from('tiq_tournaments').select('id,name,format,starts_on,location_label,entrants,results,schedule').in('id',tournamentIds).limit(101):empty,
  leagueIds.length?client.from('tiq_leagues').select('id,league_name,season_label,starts_on,location_label,default_facility').in('id',leagueIds).limit(101):empty,
  leagueIds.length?client.from('tiq_league_schedule_items').select('id,league_id,participant_a_name,participant_a_id,participant_b_name,participant_b_id,scheduled_date,scheduled_time,facility,status,notes').in('league_id',leagueIds).neq('status','cancelled').limit(501):empty,
 ])
 const tournaments=rows(a,100),leagues=rows(b,100),leagueSchedule=rows(c)
 if(tournaments.some(t=>!tournamentIds.includes(t.id)||!Array.isArray(t.entrants)||t.entrants.length>128)||leagues.some(l=>!leagueIds.includes(l.id))||leagueSchedule.some(s=>!leagueIds.includes(s.league_id)))throw Error('Competition calendar unavailable')
 const events=mapApprovedCompetitionSchedule({tournamentEntries,leagueEntries,tournaments,leagues,leagueSchedule,responses})
 if(events.length>1000)throw Error('Competition calendar too large')
 return events
}
async function calendarCoach(client:SupabaseClient,owner:string,range:CalendarRange):Promise<CalendarSharedDate[]>{
 const links=rows(await client.from('coach_player_links').select('id,player_user_id,player_name,status').eq('player_user_id',owner).neq('status','paused').limit(101),100)
 if(links.some(l=>l.player_user_id!==owner))throw Error('Coach calendar owner changed')
 if(!links.length)return []
 const assignments=rows(await client.from('coach_assignments').select('id,student_link_id,title,focus,due_date,status,assignment_json,updated_at').in('student_link_id',links.map(l=>l.id)).not('status','in','(draft,archived)').limit(501))
 if(assignments.some(a=>!links.some(l=>l.id===a.student_link_id)))throw Error('Coach calendar link changed')
 return links.flatMap(link=>buildCoachStudentCalendarEvents(assignments.filter(a=>a.student_link_id===link.id).map(a=>mapCoachAssignmentRow(a as CoachAssignmentRow)),{id:link.id,playerName:link.player_name}).filter(e=>inRange(e.date,range)).map(e=>({id:e.id,title:e.title,date:e.date,time:e.time||'',location:e.location||'',detail:e.description||'',kind:e.id.startsWith('coach-lesson-')?'lesson' as const:'reminder' as const})))
}
export async function loadNativeCalendar(client:SupabaseClient,owner:string,range:CalendarRange):Promise<NativeCalendar>{
 const [p,c,h]=await Promise.allSettled([
  client.from('player_calendar_items').select(playerCalendarSelect).eq('player_user_id',owner).lte('scheduled_date',range.to).or('scheduled_date.gte.'+range.from+',recurrence_rule.in.(FREQ=DAILY,FREQ=WEEKLY,FREQ=MONTHLY)').order('scheduled_date').order('id').limit(501).then(async result=>{const found=rows(result);if(found.some(r=>r.player_user_id!==owner))throw Error();return (await applyCalendarVenueLocations(client,owner,found as PlayerCalendarItemRow[])).map(mapPlayerCalendarItemRow)}),
  calendarCompetitions(client,owner),calendarCoach(client,owner,range),
 ])
 // Personal dates are the writable baseline. Never present a failed read as an empty account.
 if(p.status==='rejected')throw Error('Personal calendar unavailable')
 return {owner,range,personal:p.value,competitions:c.status==='fulfilled'?c.value.filter(e=>inRange(e.date,range)):[],coach:h.status==='fulfilled'?h.value:[],warnings:[...(c.status==='rejected'?['League and tournament dates couldn’t load. Refresh to check them.']:[]),...(h.status==='rejected'?['Shared Coach dates couldn’t load. Refresh to check them.']:[])]}
}
export async function writeCalendarPersonal(client:SupabaseClient,owner:string,intent:Exclude<CalendarIntent,{action:'respond'}>){
 const id=intent.action==='delete'?intent.id:intent.item.id
 const before=await calendarPersonal(client,owner,id)
 if(intent.action==='delete'){
  if(!before)return {item:null}
  if(before.updatedAt!==intent.expectedUpdatedAt)throw conflict()
  const saved=await client.from('player_calendar_items').delete().eq('player_user_id',owner).eq('id',id).eq('updated_at',intent.expectedUpdatedAt).select('id').maybeSingle()
  if(saved.error)throw Error('Calendar deletion unconfirmed')
  if(!saved.data)throw conflict()
  if(await calendarPersonal(client,owner,id))throw conflict()
  return {item:null}
 }
 if(before&&sameCalendarDraft(personalDraft(before),intent.item))return {item:before}
 if(intent.action==='create'&&before||intent.action==='update'&&(!before||before.updatedAt!==intent.expectedUpdatedAt))throw conflict()
 const raw=calendarPayload(intent.item,owner)
 const [payload]=await applyCalendarVenueLocations(client,owner,[raw as PlayerCalendarItemRow])
 const result=intent.action==='create'?await client.from('player_calendar_items').insert(payload):await client.from('player_calendar_items').update({...payload,updated_at:stamp(before!.updatedAt)}).eq('player_user_id',owner).eq('id',id).eq('updated_at',intent.expectedUpdatedAt).select('id').maybeSingle()
 if(result.error)throw result.error.code==='23505'?conflict():Error('Calendar save unconfirmed')
 if(intent.action==='update'&&!result.data)throw conflict()
 const item=await calendarPersonal(client,owner,id)
 if(!item||!sameCalendarDraft(personalDraft(item),intent.item))throw conflict()
 return {item}
}
export async function respondNativeCalendar(client:SupabaseClient,owner:string,intent:Extract<CalendarIntent,{action:'respond'}>){
 const event=(await calendarCompetitions(client,owner)).find(e=>e.id===intent.eventId)
 if(!event||event.status==='Completed'||Object.entries(intent.snapshot).some(([k,v])=>event[k as keyof typeof intent.snapshot]!==v))throw conflict()
 const query=()=>client.from('player_schedule_responses').select('id,player_user_id,event_id,response,event_snapshot,updated_at').eq('player_user_id',owner).eq('competition_kind',event.kind).eq('competition_id',event.competitionId).eq('event_id',event.id)
 const previous=await query().maybeSingle();if(previous.error)throw Error('Availability unavailable')
 const same=(r:NonNullable<typeof previous.data>)=>r.player_user_id===owner&&r.event_id===event.id&&r.response===intent.response&&Object.entries(intent.snapshot).every(([k,v])=>r.event_snapshot?.[k]===v)
 if(previous.data&&same(previous.data))return {eventId:event.id,response:intent.response,updatedAt:previous.data.updated_at,warning:''}
 if((previous.data?.updated_at||'')!==intent.expectedResponseUpdatedAt)throw conflict()
 const payload={player_user_id:owner,competition_kind:event.kind,competition_id:event.competitionId,event_id:event.id,response:intent.response,event_snapshot:intent.snapshot,updated_at:previous.data?stamp(previous.data.updated_at):new Date().toISOString()}
 const saved=previous.data?await client.from('player_schedule_responses').update(payload).eq('player_user_id',owner).eq('competition_kind',event.kind).eq('competition_id',event.competitionId).eq('event_id',event.id).eq('updated_at',intent.expectedResponseUpdatedAt).select('id').maybeSingle():await client.from('player_schedule_responses').insert(payload)
 if(saved.error||previous.data&&!saved.data)throw conflict()
 const checked=await query().maybeSingle();if(checked.error||!checked.data||!same(checked.data))throw Error('Availability save unconfirmed')
 let warning=''
 try{
  const [organizer,entry]=await Promise.all([
   client.from(event.kind==='league'?'tiq_leagues':'tiq_tournaments').select('created_by_user_id').eq('id',event.competitionId).maybeSingle(),
   client.from(event.kind==='league'?'tiq_player_league_entries':'tiq_tournament_entries').select('player_name').eq(event.kind==='league'?'league_id':'tournament_id',event.competitionId).eq(event.kind==='league'?'created_by_user_id':'submitted_by_user_id',owner).limit(1).maybeSingle(),
  ])
  if(organizer.error||entry.error)throw Error()
  if(organizer.data?.created_by_user_id&&organizer.data.created_by_user_id!==owner){const alert=await client.from('internal_notifications').insert({id:intent.requestId,recipient_profile_id:organizer.data.created_by_user_id,actor_user_id:owner,notification_type:'schedule',title:(entry.data?.player_name||'A player')+(intent.response==='available'?' is available':' can’t play'),body:`${event.title} · ${event.date}${event.time?' at '+event.time:''}`,href:event.kind==='league'?'/league-coordinator#league-registry':'/league-coordinator/tournaments#tournament-builder'});if(alert.error)throw Error()}
 }catch{warning='Reply saved; the organizer alert couldn’t be confirmed.'}
 return {eventId:event.id,response:intent.response,updatedAt:checked.data.updated_at,warning}
}
