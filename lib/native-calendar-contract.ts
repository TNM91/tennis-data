import {isValidCalendarDate} from './calendar-date'
import {buildPlayerCalendarItemPayload,type PlayerCalendarItem,type PlayerCalendarItemInput} from './player-calendar-items'
import type {PlayerCompetitionScheduleEvent} from './player-competition-schedule'

export type CalendarRange={from:string;to:string}
export type CalendarSharedDate={id:string;title:string;date:string;time:string;location:string;detail:string;kind:'lesson'|'reminder'}
export type NativeCalendar={owner:string;range:CalendarRange;personal:PlayerCalendarItem[];competitions:PlayerCompetitionScheduleEvent[];coach:CalendarSharedDate[];warnings:string[]}
export type CalendarDraft={id:string;title:string;date:string;time:string;location:string;kind:PlayerCalendarItem['kind'];recurrenceRule:PlayerCalendarItem['recurrenceRule'];availabilityStatus:PlayerCalendarItem['availabilityStatus'];venueDirectoryId:string;venuePreferenceId:string}
export type CalendarIntent=
 |{action:'create'|'update';item:CalendarDraft;expectedUpdatedAt:string}
 |{action:'delete';id:string;expectedUpdatedAt:string}
 |{action:'respond';eventId:string;response:'available'|'unavailable';snapshot:{title:string;date:string;time:string;location:string};expectedResponseUpdatedAt:string;requestId:string}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function calendarObject(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Refresh your calendar and try again.');return value as Record<string,unknown>}
export function calendarText(value:unknown,max=300){if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw Error('Choose a shorter calendar value.');return value.trim()}
export function calendarId(value:unknown){const id=calendarText(value,300);if(!id||/[\r\n]/.test(id))throw Error('Choose a saved calendar entry.');return id}
export function calendarDate(value:unknown){const date=calendarText(value,10);if(!isValidCalendarDate(date)||date<'1900-01-01'||date>'2199-12-31')throw Error('Choose a valid calendar date.');return date}
export function calendarRevision(value:unknown){const v=calendarText(value,50);if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)||!Number.isFinite(Date.parse(v)))throw Error('Refresh this calendar entry before changing it.');return v}
export function calendarRange(from:unknown,to:unknown):CalendarRange{const a=calendarDate(from),b=calendarDate(to),days=(Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000;if(days<0||days>61)throw Error('Choose a calendar view of up to 62 days.');return {from:a,to:b}}
function keys(value:Record<string,unknown>,allowed:string[]){if(Object.keys(value).some(k=>!allowed.includes(k)))throw Error('Refresh your calendar and review this change.')}
export function calendarDraft(value:unknown):CalendarDraft{
 const r=calendarObject(value);keys(r,['id','title','date','time','location','kind','recurrenceRule','availabilityStatus','venueDirectoryId','venuePreferenceId'])
 const id=calendarId(r.id),title=calendarText(r.title,160),date=calendarDate(r.date),time=calendarText(r.time,5),location=calendarText(r.location,160)
 if(!title||time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||!['practice','match','lesson','reminder','availability'].includes(String(r.kind))||!['','FREQ=DAILY','FREQ=WEEKLY','FREQ=MONTHLY'].includes(String(r.recurrenceRule))||!['','available','unavailable'].includes(String(r.availabilityStatus)))throw Error('Review the title, date, time and event type.')
 const venueDirectoryId=calendarText(r.venueDirectoryId??'',80),venuePreferenceId=calendarText(r.venuePreferenceId??'',80)
 if(venueDirectoryId&&!uuid.test(venueDirectoryId)||venuePreferenceId&&!uuid.test(venuePreferenceId))throw Error('Choose a saved venue again.')
 if(r.kind==='availability'&&!r.availabilityStatus||r.kind!=='availability'&&r.availabilityStatus)throw Error('Choose a personal availability status only for an availability note.')
 return {id,title,date,time,location,kind:r.kind as CalendarDraft['kind'],recurrenceRule:r.recurrenceRule as CalendarDraft['recurrenceRule'],availabilityStatus:r.availabilityStatus as CalendarDraft['availabilityStatus'],venueDirectoryId,venuePreferenceId}
}
export function calendarIntent(value:unknown):CalendarIntent{
 const r=calendarObject(value)
 if(r.action==='create'||r.action==='update'){
  keys(r,['action','item','expectedUpdatedAt']);const item=calendarDraft(r.item)
  if(r.action==='create'&&!new RegExp('^player-calendar-'+uuid.source.slice(1,-1)+'$','i').test(item.id))throw Error('Start a new calendar entry.')
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
export function personalDraft(item:PlayerCalendarItem):CalendarDraft{return {id:item.id,title:item.title,date:item.date,time:item.time.slice(0,5),location:item.location,kind:item.kind,recurrenceRule:item.recurrenceRule,availabilityStatus:item.availabilityStatus,venueDirectoryId:item.venueDirectoryId||'',venuePreferenceId:item.venuePreferenceId||''}}
export function calendarPayload(draft:CalendarDraft,owner:string){const value=buildPlayerCalendarItemPayload(draft as PlayerCalendarItemInput,owner);if(!value)throw Error('Review this calendar entry.');return value}
export function sameCalendarDraft(a:CalendarDraft,b:CalendarDraft){return (Object.keys(a) as (keyof CalendarDraft)[]).every(k=>k==='location'&&(a.venueDirectoryId||a.venuePreferenceId)?a.venueDirectoryId===b.venueDirectoryId&&a.venuePreferenceId===b.venuePreferenceId:a[k]===b[k])}
