import {localCalendarDate} from '../../mobile/src/calendar-data'
import type {CalendarTeamPractice} from '../../lib/native-calendar-practices-contract'
const owner='11111111-1111-4111-8111-111111111111',stamp='2026-10-31T10:00:00.123456+00:00',scope={teamName:'Baseline Aces',leagueName:'City League',flight:'4.0'}
const first:CalendarTeamPractice={id:'44444444-4444-4444-8444-444444444444',title:'Team practice: Return + first ball <img src=x>',date:localCalendarDate(),time:'18:00',endTime:'20:15',location:'Northside Tennis Center · Courts 2 and 3',status:'confirmed',response:'waitlist',captainConfirmed:false,scope}
export const calendarTeamFixture={enabled:false,fail:false,deny:false,defer:false,release:()=>{},loseWrite:false,requests:[] as {method:string;path:string;query:string;body:Record<string,unknown>|null}[],items:[first,{...first,id:'55555555-5555-4555-8555-555555555555',title:'Cancelled practice',time:'20:30',endTime:'21:30',status:'cancelled',response:'out'}] as CalendarTeamPractice[],notes:{} as Record<string,string>,revisions:{} as Record<string,string>}
export async function calendarTeamPreview(method:string,url:URL,body:unknown){
 const f=calendarTeamFixture,intent=body?JSON.parse(String(body)) as Record<string,unknown>:null;f.requests.push({method,path:url.pathname,query:url.search,body:intent})
 if(url.pathname==='/api/mobile/calendar/practices'){
  if(f.defer){f.defer=false;await new Promise<void>(resolve=>{f.release=resolve})}
  if(f.fail)return Response.json({ok:false},{status:503})
  return Response.json({ok:true,owner,range:{from:url.searchParams.get('from'),to:url.searchParams.get('to')},practices:f.enabled&&!f.deny?f.items.filter(p=>p.date>=url.searchParams.get('from')!&&p.date<=url.searchParams.get('to')!):[]})
 }
 const id=url.searchParams.get('eventId'),p=f.items.find(p=>p.id===id)
 if(!p||f.deny||url.searchParams.get('team')!==p.scope.teamName||url.searchParams.get('league')!==p.scope.leagueName||url.searchParams.get('flight')!==p.scope.flight)return Response.json({ok:false},{status:403})
 if(method==='PATCH'&&intent){p.response=intent.response as typeof p.response;p.captainConfirmed=false;f.notes[p.id]=String(intent.note||'');f.revisions[p.id]=new Date().toISOString();if(f.loseWrite){f.loseWrite=false;throw Error('Synthetic lost RSVP response')}}
 return Response.json({ok:true,owner,scope:p.scope,more:false,practices:[{id:p.id,title:p.title,date:p.date,time:p.time,endTime:p.endTime,facility:p.location,focus:'Return deep through the middle.',status:p.status,updatedAt:stamp,capacity:1,inCount:p.response==='in'?1:0,waitlistCount:p.response==='waitlist'?1:0,mine:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Jordan Lee',response:p.response==='waitlist'?'in':p.response,displayStatus:p.response,note:f.notes[p.id]||'',confirmedAt:p.captainConfirmed?stamp:null,updatedAt:f.revisions[p.id]||stamp}}]})
}
