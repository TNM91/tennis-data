import type {SupabaseClient} from '@supabase/supabase-js'
import {CapacitorHttp,type HttpOptions,type HttpResponse} from '@capacitor/core'
import {calendarObject as obj,calendarText as text,calendarId as id,calendarDate as date,calendarRevision as revision,calendarRange,calendarDraft,type CalendarRange,type NativeCalendar,type CalendarIntent} from '../../lib/native-calendar-contract'
import type {PlayerCalendarItem} from '../../lib/player-calendar-items'
import type {PlayerCompetitionScheduleEvent} from '../../lib/player-competition-schedule'
import {buildTennisCalendarFeed} from '../../lib/tiq-league-schedule-calendar'

export function readCalendarItem(raw:unknown):PlayerCalendarItem|null{
 if(raw===null)return null
 const r=obj(raw),draft=calendarDraft(r && {id:r.id,title:r.title,date:r.date,time:r.time,location:r.location,kind:r.kind,recurrenceRule:r.recurrenceRule,availabilityStatus:r.availabilityStatus,venueDirectoryId:r.venueDirectoryId||'',venuePreferenceId:r.venuePreferenceId||''})
 return {...draft,createdAt:revision(r.createdAt),updatedAt:revision(r.updatedAt)}
}
const time=(v:unknown)=>{const s=text(v,20);if(s&&!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(s))throw Error('Calendar time unavailable.');return s}
const unique=<T extends {id:string}>(list:T[])=>{if(new Set(list.map(e=>e.id)).size!==list.length)throw Error('Refresh the calendar.');return list}
export function readCalendar(value:unknown,owner:string,range:CalendarRange):NativeCalendar{
 const r=obj(value),window=obj(r.range)
 if(r.ok!==true||r.owner!==owner||window.from!==range.from||window.to!==range.to||JSON.stringify(r).length>3000000||!Array.isArray(r.personal)||r.personal.length>500||!Array.isArray(r.competitions)||r.competitions.length>1000||!Array.isArray(r.coach)||r.coach.length>1000||!Array.isArray(r.warnings)||r.warnings.length>4)throw Error('Calendar account or dates changed. Refresh to try again.')
 const personal=unique(r.personal.map(p=>{const item=readCalendarItem(p);if(!item)throw Error();return item}))
 const competitions=unique(r.competitions.map(raw=>{
  const e=obj(raw)
  if(!['league','tournament'].includes(String(e.kind))||!['match','competition'].includes(String(e.eventType))||!['','available','unavailable'].includes(String(e.responseStatus??''))||typeof e.responseIsStale!=='boolean')throw Error('Competition dates unavailable.')
  return {id:id(e.id),kind:e.kind,eventType:e.eventType,competitionId:id(e.competitionId),competitionName:text(e.competitionName,2000),title:text(e.title,2000),date:date(e.date),time:time(e.time),location:text(e.location,2000),opponent:text(e.opponent,2000),detail:text(e.detail,8000),href:'',status:text(e.status,80),responseStatus:e.responseStatus||'',responseUpdatedAt:e.responseUpdatedAt?revision(e.responseUpdatedAt):'',responseIsStale:e.responseIsStale} as PlayerCompetitionScheduleEvent
 }))
 const coach=unique(r.coach.map(raw=>{const e=obj(raw);if(!['lesson','reminder'].includes(String(e.kind)))throw Error();return {id:id(e.id),title:text(e.title,2000),date:date(e.date),time:time(e.time),location:text(e.location,2000),detail:text(e.detail,8000),kind:e.kind as 'lesson'|'reminder'}}))
 if([...competitions,...coach].some(e=>e.date<range.from||e.date>range.to))throw Error('Calendar range changed.')
 return {owner,range,personal,competitions,coach,warnings:r.warnings.map(w=>text(w,300))}
}
export class CalendarRequestFault extends Error{constructor(public status:number,message:string){super(message)}}
export async function calendarRequest(client:SupabaseClient,owner:string,current:()=>boolean,query:Record<string,string>={},intent?:CalendarIntent,send:(o:HttpOptions)=>Promise<HttpResponse>=o=>intent?CapacitorHttp.post(o):CapacitorHttp.get(o)){
 const own=async()=>{const {data,error}=await client.auth.getSession();if(error||!current()||data.session?.user.id!==owner||!data.session.access_token)throw Error('Sign in again to open your calendar.');return data.session}
 const session=await own()
 const result=await send({url:'https://www.tenaceiq.com/api/mobile/calendar'+(Object.keys(query).length?'?'+new URLSearchParams(query):''),headers:{Authorization:'Bearer '+session.access_token,'Cache-Control':'no-store',...(intent?{'Content-Type':'application/json'}:{})},...(intent?{data:intent}:{}),webFetchExtra:{cache:'no-store'},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:30000})
 await own()
 const r=obj(result.data)
 if(result.status!==200||r.ok!==true)throw new CalendarRequestFault(result.status,result.status===409?'This date changed. Check the saved entry and review it again.':'The calendar result couldn’t be confirmed. Check the saved entry before trying again.')
 if(r.owner!==owner||JSON.stringify(r).length>3000000)throw Error('Calendar account changed.')
 return r
}
export const localCalendarDate=(now=new Date())=>[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-')
export function shiftCalendarDay(day:string,days:number){date(day);const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
export function calendarWindow(day:string,mode:'week'|'month'):CalendarRange{
 date(day);const d=new Date(day+'T12:00:00Z')
 if(mode==='week'){const from=shiftCalendarDay(day,-((d.getUTCDay()+6)%7));return calendarRange(from,shiftCalendarDay(from,6))}
 const first=day.slice(0,7)+'-01',next=new Date(first+'T12:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);return calendarRange(first,shiftCalendarDay(next.toISOString().slice(0,10),-1))
}
export function shiftCalendarPeriod(day:string,mode:'week'|'month',direction:number){
 if(mode==='week')return shiftCalendarDay(day,direction*7)
 const d=new Date(day.slice(0,7)+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+direction);return d.toISOString().slice(0,10)
}
export type CalendarOccurrence={key:string;id:string;source:'personal'|'competition'|'coach';title:string;date:string;time:string;location:string;detail:string;kind:string;recurring:boolean;readiness:string}
export function calendarOccurrences(calendar:NativeCalendar):CalendarOccurrence[]{
 const entries:CalendarOccurrence[]=[]
 for(const p of calendar.personal){
  for(let day=calendar.range.from;day<=calendar.range.to;day=shiftCalendarDay(day,1)){
   const offset=(Date.parse(day+'T12:00:00Z')-Date.parse(p.date+'T12:00:00Z'))/86400000
   const matches=offset>=0&&(day===p.date||p.recurrenceRule==='FREQ=DAILY'||p.recurrenceRule==='FREQ=WEEKLY'&&offset%7===0||p.recurrenceRule==='FREQ=MONTHLY'&&day.slice(8)===p.date.slice(8))
   if(matches)entries.push({key:'personal:'+p.id+':'+day,id:p.id,source:'personal',title:p.title,date:day,time:p.time,location:p.location,detail:p.kind==='availability'?(p.availabilityStatus==='available'?'Personal note · Available':'Personal note · Unavailable'):'Personal '+p.kind,kind:p.kind,recurring:!!p.recurrenceRule,readiness:''})
  }
 }
 for(const c of calendar.competitions)entries.push({key:'competition:'+c.id,id:c.id,source:'competition',title:c.title,date:c.date,time:c.time,location:c.location,detail:[c.competitionName,c.detail,c.status].filter(Boolean).join(' · '),kind:c.kind,recurring:false,readiness:c.responseIsStale?'Date changed · Reply again':c.responseStatus==='available'?'Available':c.responseStatus==='unavailable'?'Can’t play':'No reply yet'})
 for(const c of calendar.coach)entries.push({...c,key:'coach:'+c.id,source:'coach',recurring:false,readiness:'Shared by your coach'})
 return entries.sort((a,b)=>(a.date+'T'+(a.time||'00:00')+a.title).localeCompare(b.date+'T'+(b.time||'00:00')+b.title))
}
export function calendarExport(entries:CalendarOccurrence[],zone:string){
 if(entries.length>10000||!zone||zone.length>80)throw Error('Choose a smaller calendar export.')
 try{new Intl.DateTimeFormat('en-US',{timeZone:zone}).format()}catch{throw Error('Choose a valid time zone.')}
 return buildTennisCalendarFeed(entries.map(e=>({id:e.key,title:e.title,date:e.date,time:e.time,location:e.location,description:[e.detail,e.readiness,e.recurring?'One occurrence from a repeating personal entry.':''].filter(Boolean).join('\n'),durationMinutes:e.source==='coach'&&e.kind==='lesson'?60:90})),{calendarName:'TenAceIQ · Your tennis',timeZone:zone,includeEventUrls:false})
}
