import {localCalendarDate,shiftCalendarDay} from '../../mobile/src/calendar-data'
import {personalDraft,calendarIntent,type CalendarDraft} from '../../lib/native-calendar-contract'
import type {PlayerCalendarItem} from '../../lib/player-calendar-items'
const owner='11111111-1111-4111-8111-111111111111',today=localCalendarDate(),updated='2026-10-31T10:00:00.123456+00:00'
export const calendarFixture={fail:false,loseWrite:false,defer:false,release:()=>{},requests:[] as {method:string;query:string;body:unknown}[],personal:[{id:'player-calendar-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',title:'Serve + first ball',date:shiftCalendarDay(today,-7),time:'18:00',location:'Northside courts',kind:'practice',recurrenceRule:'FREQ=WEEKLY',availabilityStatus:'',createdAt:updated,updatedAt:updated,venueDirectoryId:'',venuePreferenceId:''}] as PlayerCalendarItem[],competitions:[{id:'league:city-league:match-one',kind:'league',eventType:'match',competitionId:'city-league',competitionName:'City League',title:'City League: vs Riverside Rally — doubles under the lights',date:today,time:'19:30',location:'Northside Tennis Center · Court 3',opponent:'Riverside Rally',detail:'Week 4',href:'',status:'Confirmed',responseStatus:'',responseUpdatedAt:'',responseIsStale:false}],coach:[{id:'coach-lesson-one',title:'Lesson: Jordan Lee',date:today,time:'08:30',location:'Court 2',detail:'Focus: return position',kind:'lesson'}]}
export async function calendarPreview(method:string,url:URL,body:unknown){
 const intent=body?JSON.parse(String(body)):null;calendarFixture.requests.push({method,query:url.search,body:intent})
 if(calendarFixture.defer){calendarFixture.defer=false;await new Promise<void>(resolve=>{calendarFixture.release=resolve})}
 if(calendarFixture.fail){calendarFixture.fail=false;return Response.json({ok:false},{status:503})}
 if(method==='POST'){
  const action=calendarIntent(intent)
  if(action.action==='respond'){const e=calendarFixture.competitions.find(e=>e.id===action.eventId)!;e.responseStatus=action.response;e.responseUpdatedAt=new Date().toISOString()}
  else if(action.action==='delete')calendarFixture.personal=calendarFixture.personal.filter(p=>p.id!==action.id)
  else{const p=calendarFixture.personal.find(p=>p.id===action.item.id);if(action.action==='update'&&!p)return Response.json({ok:false},{status:409});if(p&&p.updatedAt!==action.expectedUpdatedAt&&JSON.stringify(personalDraft(p))!==JSON.stringify(action.item))return Response.json({ok:false},{status:409});const value={...action.item,createdAt:p?.createdAt||updated,updatedAt:new Date().toISOString()};calendarFixture.personal=[...calendarFixture.personal.filter(p=>p.id!==action.item.id),value]}
  if(calendarFixture.loseWrite){calendarFixture.loseWrite=false;throw Error('Synthetic lost response')}
  if(action.action==='respond'){const e=calendarFixture.competitions.find(e=>e.id===action.eventId)!;return Response.json({ok:true,owner,eventId:e.id,response:e.responseStatus,updatedAt:e.responseUpdatedAt,warning:''})}
  return Response.json({ok:true,owner,item:action.action==='delete'?null:calendarFixture.personal.find(p=>p.id===action.item.id)})
 }
 const id=url.searchParams.get('item');if(id)return Response.json({ok:true,owner,item:calendarFixture.personal.find(p=>p.id===id)||null})
 const from=url.searchParams.get('from')!,to=url.searchParams.get('to')!
 return Response.json({ok:true,owner,range:{from,to},personal:calendarFixture.personal.filter(p=>p.date<=to&&(p.date>=from||p.recurrenceRule)),competitions:calendarFixture.competitions.filter(e=>e.date>=from&&e.date<=to),coach:calendarFixture.coach.filter(e=>e.date>=from&&e.date<=to),warnings:[]})
}
export function calendarSavedDraft(value:CalendarDraft){return {...value,createdAt:updated,updatedAt:updated}}
