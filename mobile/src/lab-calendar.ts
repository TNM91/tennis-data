import type {SupabaseClient} from '@supabase/supabase-js'
import {CapacitorHttp,type HttpOptions,type HttpResponse} from '@capacitor/core'
import {isValidCalendarDate} from '../../lib/calendar-date'
import {html} from './match-details'
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
export function mountCourtCalendar(host:HTMLElement,client:SupabaseClient,owner:string,current:()=>boolean,open?:(button:HTMLButtonElement)=>void){
 if(open){host.innerHTML='<h2>Your calendar</h2><button type="button" class="secondary app-tool"><span class="app-tool-icon" aria-hidden="true">'+websiteUi.icons.leagues+'</span><span class="app-tool-copy"><strong>Make room for tennis</strong><span>Your agenda, personal plans and competition dates.</span></span><span aria-hidden="true">›</span></button>';const button=host.querySelector<HTMLButtonElement>('button')!;button.onclick=()=>{if(current())open(button)};return}
 host.innerHTML='<h2>Your calendar</h2><button type="button" class="secondary">Load calendar</button><p role="status">Check your next saved match and calendar dates.</p><div data-calendar-content></div>'
 const button=host.querySelector<HTMLButtonElement>('button')!,status=host.querySelector<HTMLElement>('[role="status"]')!,content=host.querySelector<HTMLElement>('[data-calendar-content]')!
 button.onclick=async()=>{if(button.disabled||!current())return;button.disabled=true;content.replaceChildren();status.textContent='Loading your calendar…'
 try{const calendar=await loadCourtCalendar(client,owner,()=>current()&&host.isConnected);if(!current()||!host.isConnected)return;content.innerHTML=courtCalendarHtml(calendar);status.textContent='Calendar loaded.';button.textContent='Refresh calendar';content.querySelector<HTMLButtonElement>('[data-native-ui-action="calendar"]')?.addEventListener('click',()=>{const list=content.querySelector<HTMLDetailsElement>('details')!;list.open=true;list.querySelector('summary')?.focus()})}
 catch{if(current()&&host.isConnected)status.textContent='Calendar unavailable. Check your connection and try again.'}
 finally{if(current()&&host.isConnected)button.disabled=false}}
}
