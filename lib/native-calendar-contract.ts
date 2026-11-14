import {isValidCalendarDate} from './calendar-date'
import {buildPlayerCalendarItemPayload,type PlayerCalendarItem,type PlayerCalendarItemInput} from './player-calendar-items'
import {hittingPlanStart,isHittingPlanEntry,readHittingPlan,type HittingPlan} from './hitting-plan'
import {isScorecardPracticeEntry,readScorecardPractice,type ScorecardPractice} from './level-up/scorecard-practice'
import type {PlayerCompetitionScheduleEvent} from './player-competition-schedule'
import type {CalendarTeamPractice} from './native-calendar-practices-contract'
import {fixtureId,readReviewedNextMatch,type ReviewedNextMatch} from './team-fixtures-contract'
import type {TeamRoomScope} from './team-room'

export type CalendarRange={from:string;to:string}
export type CalendarSharedDate={id:string;title:string;date:string;time:string;location:string;detail:string;kind:'lesson'|'reminder'}
export type CalendarCompetitionView={id:string;divisionId?:string}
export type NativeCalendarCompetition=PlayerCompetitionScheduleEvent&{publishedView?:CalendarCompetitionView;scorecardFormat?:'singles'|'doubles';timeZone?:string}
export type CalendarTeamMatch={roomId:string;revision:string;match:ReviewedNextMatch;scope:TeamRoomScope&{leagueLabel?:string}}
export type NativeCalendar={owner:string;range:CalendarRange;personal:PlayerCalendarItem[];competitions:NativeCalendarCompetition[];coach:CalendarSharedDate[];practices?:CalendarTeamPractice[];practicesUnavailable?:boolean;teamMatches?:CalendarTeamMatch[];warnings:string[]}
export const COMPETITION_DATES_UNAVAILABLE='League and tournament dates couldn’t load. Refresh to check them.'
export const TEAM_MATCH_DATES_UNAVAILABLE='Team match dates couldn’t load. Refresh to check them.'
export const calendarTeamMatchesHeader='X-TenAceIQ-Team-Matches'

export function readCalendarTeamMatches(value:unknown,range:CalendarRange):CalendarTeamMatch[]{
 if(!Array.isArray(value)||value.length>50)throw Error(TEAM_MATCH_DATES_UNAVAILABLE)
 const seen=new Set<string>()
 return value.map(raw=>{
  const {roomId,revision,match:fixture,scope:team}=calendarObject(raw),scope=calendarObject(team)
  const match=readReviewedNextMatch(fixture)
  if(!fixtureId(roomId)||!fixtureId(revision)||seen.has(roomId)||!match||match.date<range.from||match.date>range.to||
    /\p{Cc}/u.test(match.opponent+match.facility))throw Error(TEAM_MATCH_DATES_UNAVAILABLE)
  const {teamName,leagueName,flight,leagueLabel}=scope
  if(typeof teamName!=='string'||!calendarText(teamName,160)||typeof leagueName!=='string'||!calendarText(leagueName,160)||
    typeof flight!=='string'||flight.length>80||(leagueLabel!==undefined&&(typeof leagueLabel!=='string'||leagueLabel.length>160))||
    /\p{Cc}/u.test(teamName+leagueName+flight+(leagueLabel??'')))throw Error(TEAM_MATCH_DATES_UNAVAILABLE)
  seen.add(roomId)
  return {roomId,revision,match,scope:{teamName,leagueName,flight,...(leagueLabel?{leagueLabel}:{})}}
 })
}
export function readCalendarCompetitionView(event:PlayerCompetitionScheduleEvent,value:unknown):CalendarCompetitionView|undefined{
 if(!value||typeof value!=='object')return
 const {id,divisionId}=value as Record<string,unknown>
 const validId=/^[a-zA-Z0-9_-]{1,80}$/
 if(typeof id!=='string'||!validId.test(id))return
 if(divisionId===undefined)return id===event.competitionId?{id}:undefined
 if(event.kind==='tournament'&&typeof divisionId==='string'&&validId.test(divisionId)&&divisionId===event.competitionId&&id!==divisionId)return {id,divisionId}
}
export type CalendarDraft={id:string;title:string;date:string;time:string;location:string;kind:PlayerCalendarItem['kind'];recurrenceRule:PlayerCalendarItem['recurrenceRule'];availabilityStatus:PlayerCalendarItem['availabilityStatus'];venueDirectoryId:string;venuePreferenceId:string;hittingPlan?:HittingPlan;practiceFocus?:ScorecardPractice}
export type CalendarIntent=
 |{action:'create'|'update';item:CalendarDraft;expectedUpdatedAt:string}
 |{action:'delete';id:string;expectedUpdatedAt:string}
 |{action:'respond';eventId:string;response:'available'|'unavailable';snapshot:{title:string;date:string;time:string;location:string};expectedResponseUpdatedAt:string;requestId:string}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const nativePersonalId=new RegExp('^player-calendar-'+uuid.source.slice(1,-1)+'$','i')
// The web My Lab uses a timestamp ID for manual entries. Imported schedules and message quick-add use separate IDs.
export const firstPartyPersonalCalendarId=(id:string)=>nativePersonalId.test(id)||/^calendar-\d{13}-[0-9a-f]+$/i.test(id)
export function calendarObject(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Refresh your calendar and try again.');return value as Record<string,unknown>}
export function calendarText(value:unknown,max=300){if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw Error('Choose a shorter calendar value.');return value.trim()}
export function calendarId(value:unknown){const id=calendarText(value,300);if(!id||/[\r\n]/.test(id))throw Error('Choose a saved calendar entry.');return id}
export function calendarDate(value:unknown){const date=calendarText(value,10);if(!isValidCalendarDate(date)||date<'1900-01-01'||date>'2199-12-31')throw Error('Choose a valid calendar date.');return date}
export function calendarRevision(value:unknown){const v=calendarText(value,50);if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)||!Number.isFinite(Date.parse(v)))throw Error('Refresh this calendar entry before changing it.');return v}
export function calendarRange(from:unknown,to:unknown):CalendarRange{const a=calendarDate(from),b=calendarDate(to),days=(Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000;if(days<0||days>61)throw Error('Choose a calendar view of up to 62 days.');return {from:a,to:b}}
function keys(value:Record<string,unknown>,allowed:string[]){if(Object.keys(value).some(k=>!allowed.includes(k)))throw Error('Refresh your calendar and review this change.')}
export function calendarDraft(value:unknown):CalendarDraft{
 const r=calendarObject(value);keys(r,['id','title','date','time','location','kind','recurrenceRule','availabilityStatus','venueDirectoryId','venuePreferenceId','hittingPlan','practiceFocus'])
 const id=calendarId(r.id),title=calendarText(r.title,160),date=calendarDate(r.date),time=calendarText(r.time,5),location=calendarText(r.location,160)
 if(!title||time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||!['practice','match','lesson','reminder','availability'].includes(String(r.kind))||!['','FREQ=DAILY','FREQ=WEEKLY','FREQ=MONTHLY'].includes(String(r.recurrenceRule))||!['','available','unavailable'].includes(String(r.availabilityStatus)))throw Error('Review the title, date, time and event type.')
 const venueDirectoryId=calendarText(r.venueDirectoryId??'',80),venuePreferenceId=calendarText(r.venuePreferenceId??'',80)
 if(venueDirectoryId&&!uuid.test(venueDirectoryId)||venuePreferenceId&&!uuid.test(venuePreferenceId))throw Error('Choose a saved venue again.')
 if(r.kind==='availability'&&!r.availabilityStatus||r.kind!=='availability'&&r.availabilityStatus)throw Error('Choose a personal availability status only for an availability note.')
 const draft:CalendarDraft={id,title,date,time,location,kind:r.kind as CalendarDraft['kind'],recurrenceRule:r.recurrenceRule as CalendarDraft['recurrenceRule'],availabilityStatus:r.availabilityStatus as CalendarDraft['availabilityStatus'],venueDirectoryId,venuePreferenceId}
 if(r.hittingPlan!==undefined){
  if(!nativePersonalId.test(id)||!isHittingPlanEntry(draft)||!location||!hittingPlanStart(draft))throw Error('Choose a club, date and valid Central start time for this hitting plan.')
  draft.hittingPlan=readHittingPlan(r.hittingPlan)
 }
 if(r.practiceFocus!==undefined){
  if(!nativePersonalId.test(id)||!isScorecardPracticeEntry(draft))throw Error('Schedule this drill as a single practice.')
  draft.practiceFocus=readScorecardPractice(r.practiceFocus)
 }
 return draft
}
export function calendarIntent(value:unknown):CalendarIntent{
 const r=calendarObject(value)
 if(r.action==='create'||r.action==='update'){
  keys(r,['action','item','expectedUpdatedAt']);const item=calendarDraft(r.item)
  if(r.action==='create'&&!nativePersonalId.test(item.id))throw Error('Start a new calendar entry.')
  return {action:r.action,item,expectedUpdatedAt:r.action==='update'?calendarRevision(r.expectedUpdatedAt):''}
 }
 if(r.action==='delete'){keys(r,['action','id','expectedUpdatedAt']);return {action:'delete',id:calendarId(r.id),expectedUpdatedAt:calendarRevision(r.expectedUpdatedAt)}}
 if(r.action==='respond'){
  keys(r,['action','eventId','response','snapshot','expectedResponseUpdatedAt','requestId']);const s=calendarObject(r.snapshot);keys(s,['title','date','time','location'])
  const title=calendarText(s.title,2000),date=calendarDate(s.date),time=calendarText(s.time,20),location=calendarText(s.location,2000),requestId=calendarText(r.requestId,36)
  if(!uuid.test(requestId)||!['available','unavailable'].includes(String(r.response))||time&&!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time))throw Error('Review this competition date before replying.')
  return {action:'respond',eventId:calendarId(r.eventId),response:r.response as 'available'|'unavailable',snapshot:{title,date,time,location},expectedResponseUpdatedAt:r.expectedResponseUpdatedAt?calendarRevision(r.expectedResponseUpdatedAt):'',requestId}
 }
 throw Error('Choose a calendar action.')
}
export function personalDraft(item:PlayerCalendarItem):CalendarDraft{return {id:item.id,title:item.title,date:item.date,time:item.time.slice(0,5),location:item.location,kind:item.kind,recurrenceRule:item.recurrenceRule,availabilityStatus:item.availabilityStatus,venueDirectoryId:item.venueDirectoryId||'',venuePreferenceId:item.venuePreferenceId||'',...(item.hittingPlan?{hittingPlan:item.hittingPlan}:{}),...(item.practiceFocus?{practiceFocus:item.practiceFocus}:{})}}
export function calendarPayload(draft:CalendarDraft,owner:string){const value=buildPlayerCalendarItemPayload(draft as PlayerCalendarItemInput,owner);if(!value)throw Error('Review this calendar entry.');return value}
export function sameCalendarDraft(a:CalendarDraft,b:CalendarDraft){
 return a.hittingPlan?.clubId===b.hittingPlan?.clubId&&a.hittingPlan?.confirmedFor===b.hittingPlan?.confirmedFor&&
  a.practiceFocus?.cardId===b.practiceFocus?.cardId&&a.practiceFocus?.target===b.practiceFocus?.target&&
  (Object.keys(a) as (keyof CalendarDraft)[]).every(k=>k==='hittingPlan'||k==='practiceFocus'||(k==='location'&&(a.venueDirectoryId||a.venuePreferenceId)
   ?a.venueDirectoryId===b.venueDirectoryId&&a.venuePreferenceId===b.venuePreferenceId:a[k]===b[k]))
}
