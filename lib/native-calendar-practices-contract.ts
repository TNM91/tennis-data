import {calendarDate,calendarObject,calendarRange,calendarText,type CalendarRange} from './native-calendar-contract'
import {practiceId} from './native-player-practice-contract'
export type CalendarTeamPractice={id:string;title:string;date:string;time:string;endTime:string;location:string;status:'proposed'|'confirmed'|'completed'|'cancelled';response:'in'|'out'|'maybe'|'unanswered'|'waitlist';captainConfirmed:boolean;scope:{teamName:string;leagueName:string;flight:string}}
export function practiceCalendarTime(value:unknown){
 const raw=calendarText(value??'',80);if(!raw)return ''
 const match=raw.match(/^(\d{1,2}):([0-5]\d)$/)
 if(!match||Number(match[1])>23)throw Error('Practice time unavailable')
 return match[1].padStart(2,'0')+':'+match[2]
}
export function readCalendarPractices(value:unknown,owner:string,range:CalendarRange):CalendarTeamPractice[]{
 const row=calendarObject(value),window=calendarObject(row.range)
 if(row.ok!==true||row.owner!==owner||window.from!==range.from||window.to!==range.to||!Array.isArray(row.practices)||row.practices.length>100||JSON.stringify(row).length>200000)throw Error('Team practice dates unavailable')
 calendarRange(window.from,window.to)
 const ids=new Set<string>()
 return row.practices.map(raw=>{
  const p=calendarObject(raw),scope=calendarObject(p.scope),id=calendarText(p.id,36),date=calendarDate(p.date),title=calendarText(p.title,300),time=practiceCalendarTime(p.time),endTime=practiceCalendarTime(p.endTime),location=calendarText(p.location,300)
  const teamName=calendarText(scope.teamName,160),leagueName=calendarText(scope.leagueName,160),flight=calendarText(scope.flight,120)
  if(!practiceId(id)||ids.has(id)||!title||!teamName||!leagueName||date<range.from||date>range.to||endTime&&(!time||endTime<=time)||!['proposed','confirmed','completed','cancelled'].includes(String(p.status))||!['in','out','maybe','unanswered','waitlist'].includes(String(p.response))||typeof p.captainConfirmed!=='boolean'||p.captainConfirmed&&p.response!=='in')throw Error('Team practice dates unavailable')
  ids.add(id);return {id,title,date,time,endTime,location,status:p.status as CalendarTeamPractice['status'],response:p.response as CalendarTeamPractice['response'],captainConfirmed:p.captainConfirmed,scope:{teamName,leagueName,flight}}
 })
}
