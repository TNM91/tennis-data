import type {SupabaseClient} from '@supabase/supabase-js'
import {CapacitorHttp,type HttpOptions,type HttpResponse} from '@capacitor/core'
import {isValidCalendarDate} from '../../lib/calendar-date'
import {html} from './match-details'
import {calendarOccurrences,isCurrentCalendarOccurrence,isPracticeInProgress,localCalendarDate,shiftCalendarDay,type CalendarOccurrence} from './calendar-data'
import {loadCalendarSources} from './calendar-practices-data'
import {formatCaptainPracticeTimeRange} from '../../lib/captain-practice-invite'
import type {NativeCalendar} from '../../lib/native-calendar-contract'
import websiteUi from '../generated/website-ui.json'
export type CourtEvent={id:string;source:'personal'|'competition';title:string;date:string;time:string;location:string;detail:string;kind:string;readiness:string;recurrence:string}
export type CourtCalendar={events:CourtEvent[];competitionUnavailable:boolean}
const object=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Calendar unavailable.');return v as Record<string,unknown>}
const text=(v:unknown,max=2000)=>{if(typeof v!=='string'||v.length>max)throw Error('Calendar unavailable.');return v}
export function parseCourtCalendar(value:unknown):CourtCalendar{
 const r=object(value)
 if(r.ok!==true||!Array.isArray(r.items)||!Array.isArray(r.competitionItems)||r.items.length>10000||r.competitionItems.length>10000||JSON.stringify(r).length>8000000)throw Error('Calendar unavailable.')
 const competitionUnavailable=text(r.competitionWarning).length>0
 const events:CourtEvent[]=[]
 for(const source of ['personal','competition'] as const)for(const raw of source==='personal'?r.items:r.competitionItems){
  const e=object(raw),date=text(e.date,10),time=text(e.time,20),id=text(e.id,300)
  if(!id||!isValidCalendarDate(date)||time&&!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(time))throw Error('Calendar unavailable.')
  const kind=text(source==='personal'?e.kind:e.eventType,30),response=e.responseStatus
  const recurrence=source==='personal'?text(e.recurrenceRule,30):''
  if(source==='personal'&&!['practice','match','lesson','reminder','availability'].includes(kind)||source==='competition'&&!['match','competition'].includes(kind)||!['','FREQ=DAILY','FREQ=WEEKLY','FREQ=MONTHLY'].includes(recurrence))throw Error('Calendar unavailable.')
  if(source==='competition'&&(response!==undefined&&!['','available','unavailable'].includes(String(response))||e.responseIsStale!==undefined&&typeof e.responseIsStale!=='boolean'))throw Error('Calendar unavailable.')
  events.push({id,source,title:text(e.title)||'Calendar event',date,time,location:text(e.location),detail:source==='competition'?text(e.detail):'',kind,recurrence,readiness:source==='personal'?'Personal calendar':response==='unavailable'?'Marked unavailable':response==='available'&&!e.responseIsStale?'Availability confirmed':'Availability needs a reply'})
 }
 if(new Set(events.map(e=>e.source+':'+e.id)).size!==events.length)throw Error('Calendar unavailable.')
 return {events:events.sort((a,b)=>(a.date+'T'+a.time).localeCompare(b.date+'T'+b.time)),competitionUnavailable}
}
export async function loadCourtCalendar(client:SupabaseClient,owner:string,current:()=>boolean,send:(o:HttpOptions)=>Promise<HttpResponse>=o=>CapacitorHttp.get(o)){
 const own=async()=>{const {data,error}=await client.auth.getSession();if(error||!current()||data.session?.user.id!==owner)throw Error('Calendar unavailable.');return data.session}
 const session=await own(),r=await send({url:'https://www.tenaceiq.com/api/player/calendar-items',headers:{Authorization:'Bearer '+session.access_token,'Cache-Control':'no-store'},webFetchExtra:{cache:'no-store'},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:30000})
 await own();if(r.status!==200)throw Error('Calendar unavailable.');return parseCourtCalendar(r.data)
}
export function courtCalendarHtml(calendar:CourtCalendar,now=new Date()){
 const today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-'),upcoming=calendar.events.filter(e=>e.date>=today)
 // Match the website's next-match rule. Recurring personal entries retain their saved date;
 // do not invent occurrences that the account endpoint did not return.
 const next=calendar.competitionUnavailable?undefined:upcoming.find(e=>e.kind==='match')
 const dateLabel=(e:CourtEvent)=>new Date(e.date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'})+(e.time?' · '+e.time.slice(0,5):' · Time not set')
 const values:Record<string,string>=next?{TIQ_EVENT_TITLE:next.title,TIQ_EVENT_DATE:dateLabel(next),TIQ_EVENT_DETAIL:[next.detail,next.location].filter(Boolean).join(' · ')||'Saved match',TIQ_EVENT_READINESS:next.readiness}:{}
 const card=next?'<div class="website-ui website-lab">'+websiteUi.nextCourt.replace(/TIQ_EVENT_[A-Z]+/g,key=>html(values[key]||''))+'</div>':''
 return card+(calendar.competitionUnavailable?'<p role="alert">Competition dates are unavailable. These personal dates may not include your next match. Refresh to try again.</p>':'')+'<details id="lab-calendar-dates"><summary>Saved calendar dates</summary><p>Account calendar entries and league or tournament dates. Team-room practices and dates saved only in a browser are not included. Availability replies and calendar edits are available on the website.</p>'+(upcoming.length?upcoming.slice(0,100).map(e=>'<article><h3>'+html(e.title)+'</h3><p>'+html(dateLabel(e))+'</p><p>'+html([e.kind,e.location,e.detail,e.readiness].filter(Boolean).join(' · '))+'</p>'+(e.recurrence?'<p>Repeats '+html(e.recurrence.replace('FREQ=','').toLowerCase())+' from the saved date. Future occurrences are not expanded here.</p>':'')+'</article>').join('')+(upcoming.length>100?'<p>Showing the next 100 saved entries.</p>':''):'<p>No upcoming saved dates in the calendars loaded.</p>')+'</details>'
}
export function createCalendarHighlights(client:SupabaseClient,currentOwner:()=>string|undefined){
 let version=0
 let cached:{owner:string;date:string;expires:number;read:Promise<NativeCalendar|null>}|null=null
 const clear=()=>{version++;cached=null}
 const readWeek=(owner:string)=>{
  const today=localCalendarDate()
  if(cached?.owner===owner&&cached.date===today&&Date.now()<cached.expires)return cached.read
  const request=++version
  const active=()=>request===version&&currentOwner()===owner
  const read=loadCalendarSources(client,owner,active,{from:today,to:shiftCalendarDay(today,6)}).catch(()=>null)
  cached={owner,date:today,expires:Date.now()+5*60_000,read}
  void read.then(value=>{if(active()&&cached&&(!value||value.warnings.length))cached.expires=Date.now()+30_000})
  return read
 }
 const mount=(host:HTMLElement,owner:string,current:()=>boolean,linked:boolean,
  open:(button:HTMLButtonElement,event:CalendarOccurrence|undefined,onClose:(changed:boolean)=>void)=>void,kind:'up-next'|'match'='up-next')=>{
  const matchOnly=kind==='match'
  host.innerHTML=`<button type="button" class="secondary app-tool">
   <span class="app-tool-icon" aria-hidden="true">${websiteUi.icons.calendar}</span>
   <span class="app-tool-copy">
    <small data-next-kicker>Up next</small>
    <strong data-next-title>Open Calendar</strong>
    <span data-next-details>Matches, lessons and practice.</span>
    <span class="lab-next-action" data-next-action hidden>View event</span>
   </span><span aria-hidden="true">›</span>
  </button>`
  const button=host.querySelector<HTMLButtonElement>('button')!
  const kicker=button.querySelector<HTMLElement>('[data-next-kicker]')!
  const title=button.querySelector<HTMLElement>('[data-next-title]')!
  const details=button.querySelector<HTMLElement>('[data-next-details]')!
  const action=button.querySelector<HTMLElement>('[data-next-action]')!
  const active=()=>host.isConnected&&current()
  let event:CalendarOccurrence|undefined
  const paint=(calendar:NativeCalendar|null)=>{
   if(!active())return
   const now=new Date()
   const incomplete=!calendar||calendar.warnings.length>0
   const matches=matchOnly&&calendar
    ?new Map(calendar.competitions.filter(item=>item.eventType==='match').map(item=>[item.id,item]))
    :null
   event=calendar?calendarOccurrences(calendar).find(item=>
    (!matches||item.source==='competition'&&matches.has(item.id))&&isCurrentCalendarOccurrence(item,calendar,now)):undefined
   if(matchOnly){
    if(!event&&host.contains(document.activeElement)){
     host.parentElement?.querySelector<HTMLElement>('h1')?.focus({preventScroll:true})
    }
    host.hidden=!event
    if(!event)return
   }
   kicker.textContent=matchOnly?'Your next match':event&&isPracticeInProgress(event,now)?'Scheduled now':event&&incomplete?'Next loaded date':'Up next'
   const match=event?matches?.get(event.id):undefined
   title.textContent=match?.opponent?'vs '+match.opponent:event?.title??'Open Calendar'
   action.hidden=!event
   if(!event){details.textContent=incomplete?'Check your tennis dates.':'No events in the next 7 days.';return}
   action.textContent=matchOnly?'View match · '+event.readiness:event.source==='team'?'View practice':'View event'
   const date=event.date===localCalendarDate(now)?'Today':new Date(event.date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})
   const time=formatCaptainPracticeTimeRange(event.time.slice(0,5),event.endTime)
   details.textContent=[match?.opponent?match.competitionName:'',date,time,event.location].filter(Boolean).join(' · ')
  }
  button.onclick=()=>{
   if(!active())return
   button.focus({preventScroll:true})
   open(button,event,changed=>{
    if(!changed)return
    clear()
    if(linked&&active())void readWeek(owner).then(paint)
   })
  }
  if(linked)void readWeek(owner).then(paint)
 }
 return {mount,clear}
}
