import type {SupabaseClient} from '@supabase/supabase-js'
import {html} from './match-details'
import {calendarDraft,personalDraft,sameCalendarDraft,type CalendarDraft,type CalendarIntent,type NativeCalendar} from '../../lib/native-calendar-contract'
import {calendarRequest,readCalendar,readCalendarItem,calendarWindow,shiftCalendarDay,shiftCalendarPeriod,localCalendarDate,calendarOccurrences,calendarExport,type CalendarOccurrence} from './calendar-data'
import {exportCoachFile,cancelCoachFile} from './native-coach-files'
import websiteUi from '../generated/website-ui.json'

const label=(day:string)=>new Date(day+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'})
const repeatNames:Record<string,string>={'':'Does not repeat','FREQ=DAILY':'Every day','FREQ=WEEKLY':'Every week','FREQ=MONTHLY':'Every month on this day'}
type Panel='agenda'|'editor'|'review'|'delete'|'respond'|'export'|'recovery'|'leave'
export function openCalendar(client:SupabaseClient,owner:string,current:()=>boolean,trigger?:HTMLElement){
 const dialog=document.createElement('dialog');dialog.className='native-calendar-screen';dialog.setAttribute('aria-label','Your calendar')
 let disposed=false,busy=false,calendar:NativeCalendar|null=null,notice='',failed=false,mode:'week'|'month'='week',anchor=localCalendarDate(),day='',filter='all',shown=100,panel:Panel='agenda',returnPanel:Panel='agenda'
 let draft:CalendarDraft|null=null,baseline='',selected:CalendarOccurrence|null=null,pending:CalendarIntent|null=null,zone='America/Chicago',reply:'available'|'unavailable'='available'
 const active=()=>!disposed&&current()
 const range=()=>calendarWindow(anchor,mode)
 const occurrences=()=>calendar?calendarOccurrences(calendar):[]
 const visible=()=>occurrences().filter(e=>(!day||e.date===day)&&(filter==='all'||filter==='personal'&&e.source==='personal'||filter==='competition'&&e.source==='competition'||filter==='coach'&&e.source==='coach'))
 const focus=()=>dialog.querySelector<HTMLElement>('h2, h1')?.focus({preventScroll:true})
 const dispose=()=>{if(disposed)return;disposed=true;void cancelCoachFile(owner).catch(()=>{});calendar=null;draft=null;pending=null;dialog.close();dialog.remove();if(current()&&trigger?.isConnected)trigger.focus({preventScroll:true})}
 const dirty=()=>!!draft&&panel!=='agenda'
 const back=()=>{
  if(busy){notice='Finishing this calendar check…';status();return true}
  if(panel==='leave'){panel=returnPanel;render();return true}
  if(pending){returnPanel=panel;panel='leave';render();focus();return true}
  if(panel==='editor'||panel==='review'){returnPanel=panel;panel='leave';render();focus();return true}
  if(panel!=='agenda'){panel='agenda';selected=null;render();focus();return true}
  dispose();return true
 }
 const status=()=>{const p=dialog.querySelector<HTMLElement>('[data-cal-status]');if(p)p.textContent=notice}
 const refresh=async(message='',keepPanel=false)=>{
  if(!active())return
  busy=true;failed=false;notice=message||'Loading your tennis dates…';render()
  const expected=range()
  try{const value=await calendarRequest(client,owner,active,expected);if(!active())return;calendar=readCalendar(value,owner,expected);notice=message;shown=100;if(!keepPanel)panel='agenda'}
  catch{if(active()){calendar=null;failed=true;notice=(message?message+' ':'')+'Your calendar couldn’t load. Check your connection and retry.'}}
  finally{if(active()){busy=false;render();focus()}}
 }
 const confirmed=async(message:string)=>{pending=null;draft=null;baseline='';selected=null;panel='agenda';await refresh(message)}
 const perform=async(intent:CalendarIntent)=>{
  if(!active()||busy||pending)return
  busy=true;pending=intent;notice='Saving your calendar change…';render()
  try{
   const result=await calendarRequest(client,owner,active,{},intent);if(!active())return
   if(intent.action==='respond'){if(result.eventId!==intent.eventId||result.response!==intent.response||typeof result.updatedAt!=='string')throw Error();await confirmed(typeof result.warning==='string'&&result.warning?result.warning:'Availability reply saved. Refresh if the organizer changes the date.')}
   else{const saved=readCalendarItem(result.item);if(intent.action==='delete'?saved!==null:!saved||!sameCalendarDraft(personalDraft(saved),intent.item))throw Error();if(saved){anchor=saved.date;day='';filter='all'}await confirmed(intent.action==='delete'?'Personal event deleted.':'Personal event saved.')}
  }catch{if(active()){panel='recovery';notice='We couldn’t confirm the result. Check the saved entry before trying again.'}}
  finally{if(active()){busy=false;render();focus()}}
 }
 const recover=async()=>{
  if(!pending||busy||!active())return
  const intent=pending;busy=true;notice='Checking the saved result…';render()
  try{
   if(intent.action==='respond'){
    const expected=range(),value=readCalendar(await calendarRequest(client,owner,active,expected),owner,expected);if(!active())return;calendar=value
    const e=value.competitions.find(e=>e.id===intent.eventId)
    if(e&&e.responseStatus===intent.response&&!e.responseIsStale&&Object.entries(intent.snapshot).every(([k,v])=>e[k as keyof typeof intent.snapshot]===v)){await confirmed('Your availability reply is saved.');return}
    pending=null;panel='agenda';selected=null;notice='The current reply differs or this date moved. Open the date to review its latest schedule.'
   }else{
    const id=intent.action==='delete'?intent.id:intent.item.id,result=await calendarRequest(client,owner,active,{item:id}),saved=readCalendarItem(result.item);if(!active())return
    if(intent.action==='delete'&&!saved||intent.action!=='delete'&&saved&&sameCalendarDraft(personalDraft(saved),intent.item)){if(saved){anchor=saved.date;day='';filter='all'}await confirmed(intent.action==='delete'?'Deletion confirmed.':'Your personal event is saved.');return}
    pending=null
    if(saved){draft=personalDraft(saved);baseline=saved.updatedAt;panel='editor';notice='The saved entry differs. Review this latest version before making a change.'}
    else if(intent.action!=='delete'){draft=intent.action==='update'?{...intent.item,id:'player-calendar-'+crypto.randomUUID()}:intent.item;baseline='';panel='editor';notice=intent.action==='update'?'That event is no longer saved. Review a new personal copy.':'No saved entry was found. Review this event before saving it.'}
    else{panel='agenda';notice='Refresh to check your calendar.'}
   }
  }catch{if(active())notice='The saved result is still unavailable. Keep this screen open and check again when connected.'}
  finally{if(active()){busy=false;render();focus()}}
 }
 const setDraft=(item?:CalendarDraft,stamp='')=>{draft=item||{id:'player-calendar-'+crypto.randomUUID(),title:'',date:day||anchor,time:'',location:'',kind:'practice',recurrenceRule:'',availabilityStatus:'',venueDirectoryId:'',venuePreferenceId:''};baseline=stamp;panel='editor';notice='';render();dialog.querySelector<HTMLInputElement>('[name="title"]')?.focus()}
 const field=(name:string,title:string,value:string,type='text',max=160)=>`<label>${title}<input name="${name}" type="${type}" value="${html(value)}" ${type==='date'?'min="1900-01-01" max="2199-12-31"':''} ${type==='text'?'maxlength="'+max+'"':''}></label>`
 const details=(e:{title:string;date:string;time:string;location:string})=>`<h3>${html(e.title)}</h3><p>${html(label(e.date))} · ${html(e.time?e.time.slice(0,5):'All day / time not set')}</p>${e.location?'<p>'+html(e.location)+'</p>':''}`
 const agenda=()=>{
  const window=range(),events=occurrences(),dates:string[]=[]
  for(let d=window.from;d<=window.to;d=shiftCalendarDay(d,1))dates.push(d)
  const lead=mode==='month'?(new Date(window.from+'T12:00:00Z').getUTCDay()+6)%7:0
  const list=visible(),local=localCalendarDate(),period=mode==='month'?new Date(window.from+'T12:00:00').toLocaleDateString(undefined,{month:'long',year:'numeric'}):label(window.from)+' – '+label(window.to)
  let last=''
  return `<section class="cal-hero"><div><small class="stat-eyebrow">Play. Plan. Improve.</small><h2 tabindex="-1">Your week in tennis.</h2><p>Personal plans and shared dates.</p></div><span aria-hidden="true">${websiteUi.icons.leagues}</span></section><div class="cal-toolbar"><div class="cal-switch" role="group" aria-label="Calendar view">${(['week','month'] as const).map(m=>'<button data-cal-mode="'+m+'" aria-pressed="'+(mode===m)+'" '+(busy?'disabled':'')+'>'+m[0].toUpperCase()+m.slice(1)+'</button>').join('')}</div><button class="secondary" data-cal-today ${busy?'disabled':''}>Today</button></div><div class="cal-period"><button class="secondary" data-cal-step="-1" aria-label="Previous ${mode}" ${busy?'disabled':''}>‹</button><h3>${html(period)}</h3><button class="secondary" data-cal-step="1" aria-label="Next ${mode}" ${busy?'disabled':''}>›</button></div><div class="cal-grid" aria-label="Choose a date">${['M','T','W','T','F','S','S'].map(d=>'<span class="cal-weekday" aria-hidden="true">'+d+'</span>').join('')}${'<span></span>'.repeat(lead)}${dates.map(d=>{const found=events.filter(e=>e.date===d);return '<button data-cal-day="'+d+'" aria-label="'+html(label(d)+', '+found.length+' events')+'" aria-pressed="'+(day===d)+'" '+(d===local?'aria-current="date"':'')+' '+(busy?'disabled':'')+'><span>'+Number(d.slice(8))+'</span><span class="cal-dots" aria-hidden="true">'+['personal','competition','coach'].filter(source=>found.some(e=>e.source===source)).map(source=>'<i class="'+source+'"></i>').join('')+'</span></button>'}).join('')}</div><div class="cal-legend"><span>● Personal</span><span>● Competition</span><span>● Coach</span></div><div class="cal-toolbar cal-filter-toolbar"><button class="secondary" data-cal-all aria-pressed="${!day}" ${busy?'disabled':''}>All dates</button><label class="cal-type"><span>Show</span><select data-cal-filter ${busy?'disabled':''}><option value="all">All types</option><option value="personal">Personal</option><option value="competition">Competitions</option><option value="coach">Coach</option></select></label></div>${calendar?.warnings.map(w=>'<p class="cal-warning" role="alert">'+html(w)+'</p>').join('')||''}<div class="cal-agenda-title"><h2 tabindex="-1">${day?html(label(day)):'Your agenda'}</h2><span>${list.length} ${list.length===1?'date':'dates'}</span></div>${!calendar?'<p>'+(!busy?'Your dates are unavailable. Retry to check the calendar.':'Loading dates…')+'</p>':list.length?list.slice(0,shown).map(e=>{const heading=e.date!==last?'<h3 class="cal-date">'+html(label(e.date))+'</h3>':'';last=e.date;return heading+`<button type="button" class="cal-event ${e.source}" data-cal-event="${html(e.key)}"><span class="cal-event-time">${html(e.time?e.time.slice(0,5):'All day')}</span><span class="cal-event-copy"><small>${e.source==='competition'?html(e.kind):e.source==='coach'?'Coach':'Personal'}${e.recurring?' · Repeats':''}</small><strong>${html(e.title)}</strong>${e.location?'<span>'+html(e.location)+'</span>':''}${e.readiness?'<span>'+html(e.readiness)+'</span>':''}</span><span aria-hidden="true">›</span></button>`}).join('')+(list.length>shown?'<button class="secondary" data-cal-more>Show more dates</button>':''):'<div class="cal-empty"><h3>No dates in this view.</h3><p>Try all dates, another type or add a personal plan.</p></div>'}<p class="cal-footnote">Competition dates come from your approved entries. Team-room practices and dates saved only in a browser aren’t included. Personal availability notes don’t send an RSVP.</p>`
 }
 const content=()=>{
  if(panel==='agenda')return agenda()
  if(panel==='leave')return `<section class="cal-panel"><h2 tabindex="-1">Leave this calendar change?</h2><p>${pending?'The saved result is still unconfirmed. Your calendar will need a fresh check when you return.':'Your unsaved changes will be discarded.'}</p><button data-cal-stay>Keep reviewing</button><button class="secondary" data-cal-discard>Discard and close</button></section>`
  if(panel==='recovery')return '<section class="cal-panel"><h2 tabindex="-1">Check the saved result</h2><p>The connection ended before we could confirm your change. Check your saved calendar before trying again.</p><button data-cal-recover '+(busy?'disabled':'')+'>Check saved entry</button></section>'
  if(panel==='editor'&&draft)return `<form class="cal-form"><h2 tabindex="-1">${baseline?'Edit personal event':'Add personal event'}</h2>${field('title','Title',draft.title)}<div class="cal-form-pair">${field('date','Date',draft.date,'date')}${field('time','Time (optional)',draft.time,'time')}</div>${field('location','Location (optional)',draft.location)}<label>Type<select name="kind">${['practice','match','lesson','reminder','availability'].map(k=>'<option value="'+k+'" '+(draft!.kind===k?'selected':'')+'>'+k[0].toUpperCase()+k.slice(1)+'</option>').join('')}</select></label><label>Repeat<select name="recurrenceRule">${Object.entries(repeatNames).map(([k,v])=>'<option value="'+k+'" '+(draft!.recurrenceRule===k?'selected':'')+'>'+v+'</option>').join('')}</select></label><label data-cal-availability ${draft.kind==='availability'?'':'hidden'}>Personal availability<select name="availabilityStatus"><option value="available" ${draft.availabilityStatus==='available'?'selected':''}>Available</option><option value="unavailable" ${draft.availabilityStatus==='unavailable'?'selected':''}>Unavailable</option></select></label><p>${draft.recurrenceRule?'Edits apply to the whole repeating series. Monthly dates skip months without that day.':'Leave time empty for an all-day entry.'} Personal events don’t book a court, send a team message or reply to a competition.</p><button type="submit">Review event</button>${baseline&&selected?'<button type="button" class="secondary" data-cal-delete-review>'+(selected.recurring?'Delete repeating series':'Delete event')+'</button>':''}<button type="button" class="secondary" data-cal-back>Cancel</button></form>`
  if(panel==='review'&&draft)return `<section class="cal-panel"><h2 tabindex="-1">Review personal event</h2>${details(draft)}<p>${html(draft.kind)} · ${html(repeatNames[draft.recurrenceRule])}</p>${draft.kind==='availability'?'<p>Personal note: '+html(draft.availabilityStatus)+'. No competition reply is sent.</p>':''}${draft.recurrenceRule?'<p>This saves the whole repeating series.</p>':''}<button data-cal-save ${busy?'disabled':''}>${baseline?'Save changes':'Save personal event'}</button><button class="secondary" data-cal-edit ${busy?'disabled':''}>Keep editing</button></section>`
  if(panel==='delete'&&selected)return `<section class="cal-panel"><h2 tabindex="-1">Delete ${selected.recurring?'repeating series':'personal event'}?</h2>${details(selected)}<p>${selected.recurring?'Every occurrence from this personal series will be removed.':'This removes this personal event from your saved calendar.'}</p><button data-cal-delete ${busy?'disabled':''}>Delete ${selected.recurring?'whole series':'event'}</button><button class="secondary" data-cal-agenda ${busy?'disabled':''}>Keep event</button></section>`
  if(panel==='respond'&&selected){const e=calendar?.competitions.find(c=>c.id===selected!.id);return `<section class="cal-panel"><h2 tabindex="-1">${selected.source==='competition'?'Your availability':'Shared Coach date'}</h2>${details(selected)}<p>${html(selected.detail)}</p>${e?'<p>'+html(e.responseIsStale?'The schedule changed. Review this date before replying.':selected.readiness)+'</p>'+(e.status==='Completed'?'<p>This match is completed.</p>':'<label>Your reply<select data-cal-reply><option value="available" '+(reply==='available'?'selected':'')+'>I can play</option><option value="unavailable" '+(reply==='unavailable'?'selected':'')+'>I can’t play</option></select></label><p>This sends your reply for the date, time and location shown above. It doesn’t reschedule the match.</p><button data-cal-respond '+(busy?'disabled':'')+'>Confirm availability reply</button>'):'<p>Shared Coach dates are managed with your coach. Open Coach & training to review your plan.</p>'}<button class="secondary" data-cal-agenda ${busy?'disabled':''}>Back to calendar</button></section>`}
  if(panel==='export'){const list=visible();return `<section class="cal-panel"><h2 tabindex="-1">Export these dates</h2><p>${list.length} ${list.length===1?'date':'dates'} · ${day?html(label(day)):html(label(range().from)+' – '+label(range().to))} · ${html(filter==='all'?'All types':filter)}</p><label>Times are in<select data-cal-zone>${[...new Set(['America/Chicago',Intl.DateTimeFormat().resolvedOptions().timeZone,'America/New_York','America/Denver','America/Los_Angeles','Pacific/Honolulu','America/Anchorage'])].map(z=>'<option '+(z===zone?'selected':'')+' value="'+html(z)+'">'+html(z.replaceAll('_',' '))+'</option>').join('')}</select></label><p>Saved times have no time zone. Choose the zone where these events take place. Timed events use 90-minute slots; Coach lessons use 60 minutes. All-day entries stay all day.</p><p>This is a one-time calendar file for the dates and type shown. Repeating entries export only occurrences in this view. Later changes won’t sync.</p>${calendar?.warnings.length?'<p class="cal-warning">Some sources are unavailable. This file includes only the dates that loaded.</p>':''}<button data-cal-export ${busy||!list.length?'disabled':''}>Share calendar file</button><button class="secondary" data-cal-agenda ${busy?'disabled':''}>Back to calendar</button></section>`}
  return ''
 }
 const render=()=>{
  if(!active())return
  const scroll=dialog.querySelector('.cal-body')?.scrollTop||0
  dialog.innerHTML=`<header class="cal-heading"><div><small class="stat-eyebrow">Your tennis</small><h1 tabindex="-1">Calendar</h1></div><button class="secondary" data-cal-close>Close</button></header><div class="cal-body"><p data-cal-status role="${failed||pending?'alert':'status'}">${html(notice)}</p>${content()}</div>${panel==='agenda'?'<footer class="cal-actions"><button data-cal-new '+(busy||!calendar?'disabled':'')+'>＋ Add event</button><button class="secondary" data-cal-export-review '+(busy||!visible().length?'disabled':'')+'>Export</button><button class="secondary" data-cal-refresh '+(busy?'disabled':'')+'>'+ (failed?'Retry':'Refresh')+'</button></footer>':''}`
  dialog.querySelector('.cal-body')!.scrollTop=scroll
  const on=(selector:string,fn:(button:HTMLButtonElement)=>void)=>dialog.querySelectorAll<HTMLButtonElement>(selector).forEach(button=>button.onclick=()=>{if(active()&&!busy)fn(button)})
  dialog.querySelector('[data-cal-close]')!.addEventListener('click',back)
  on('[data-cal-back]',back);on('[data-cal-stay]',()=>{panel=returnPanel;render()});on('[data-cal-discard]',dispose)
  on('[data-cal-refresh]',()=>void refresh());on('[data-cal-new]',()=>setDraft());on('[data-cal-recover]',()=>void recover())
  on('[data-cal-today]',()=>{anchor=localCalendarDate();day=anchor;void refresh()})
  on('[data-cal-mode]',b=>{mode=b.dataset.calMode as typeof mode;day='';void refresh()})
  on('[data-cal-step]',b=>{const next=shiftCalendarPeriod(anchor,mode,Number(b.dataset.calStep));try{calendarWindow(next,mode)}catch{return}anchor=next;day='';void refresh()})
  on('[data-cal-day]',b=>{day=day===b.dataset.calDay?'':b.dataset.calDay!;shown=100;render()})
  on('[data-cal-all]',()=>{day='';shown=100;render()});on('[data-cal-more]',()=>{shown+=100;render()})
  const select=dialog.querySelector<HTMLSelectElement>('[data-cal-filter]');if(select){select.value=filter;select.onchange=()=>{filter=select.value;shown=100;render()}}
  on('[data-cal-event]',b=>{
   selected=occurrences().find(e=>e.key===b.dataset.calEvent)||null;if(!selected)return
   if(selected.source==='personal'){const p=calendar!.personal.find(p=>p.id===selected!.id)!;draft=personalDraft(p);baseline=p.updatedAt;panel='editor';notice='';render();focus()}
   else{reply=calendar?.competitions.find(e=>e.id===selected!.id)?.responseStatus==='unavailable'?'unavailable':'available';panel='respond';notice='';render();focus()}
  })
  on('[data-cal-agenda]',()=>{draft=null;selected=null;panel='agenda';notice='';render()})
  const form=dialog.querySelector<HTMLFormElement>('form')
  if(form&&draft){
   const sync=()=>{const data=new FormData(form),location=String(data.get('location')||''),kind=String(data.get('kind'));draft={...draft!,title:String(data.get('title')||''),date:String(data.get('date')||''),time:String(data.get('time')||''),location,kind:kind as CalendarDraft['kind'],recurrenceRule:String(data.get('recurrenceRule')||'') as CalendarDraft['recurrenceRule'],availabilityStatus:kind==='availability'?String(data.get('availabilityStatus')||'available') as CalendarDraft['availabilityStatus']:'',...(location!==draft!.location?{venueDirectoryId:'',venuePreferenceId:''}:{})};form.querySelector<HTMLElement>('[data-cal-availability]')!.hidden=kind!=='availability'}
   form.oninput=sync;form.onchange=sync;form.onsubmit=e=>{e.preventDefault();sync();try{draft=calendarDraft(draft);panel='review';notice='';render();focus()}catch(error){notice=error instanceof Error?error.message:'Review this event.';status()}}
  }
  on('[data-cal-edit]',()=>{panel='editor';render()});on('[data-cal-delete-review]',()=>{panel='delete';render();focus()})
  on('[data-cal-save]',()=>{if(draft)void perform({action:baseline?'update':'create',item:draft,expectedUpdatedAt:baseline})})
  on('[data-cal-delete]',()=>{if(selected)void perform({action:'delete',id:selected.id,expectedUpdatedAt:baseline})})
  const replySelect=dialog.querySelector<HTMLSelectElement>('[data-cal-reply]');if(replySelect)replySelect.onchange=()=>{reply=replySelect.value as typeof reply}
  on('[data-cal-respond]',()=>{const e=calendar?.competitions.find(e=>e.id===selected?.id);if(e)void perform({action:'respond',eventId:e.id,response:reply,snapshot:{title:e.title,date:e.date,time:e.time,location:e.location},expectedResponseUpdatedAt:e.responseUpdatedAt||'',requestId:crypto.randomUUID()})})
  on('[data-cal-export-review]',()=>{panel='export';notice='';render();focus()})
  const zoneSelect=dialog.querySelector<HTMLSelectElement>('[data-cal-zone]');if(zoneSelect)zoneSelect.onchange=()=>{zone=zoneSelect.value}
  on('[data-cal-export]',()=>{busy=true;notice='Preparing calendar file…';render();void (async()=>{try{const blob=new Blob([calendarExport(visible(),zone)],{type:'text/calendar'});await exportCoachFile(owner,active,blob,'TenAceIQ-'+range().from+'-'+range().to+'.ics');if(active())notice='Calendar file prepared. Add it to your preferred calendar to finish.'}catch{if(active())notice='Calendar export wasn’t completed. You can try sharing again.'}finally{if(active()){busy=false;render()}}})()})
 }
 dialog.addEventListener('cancel',e=>{e.preventDefault();back()});document.body.append(dialog);dialog.showModal();void refresh()
 return {dispose,isOpen:()=>!disposed&&dialog.open,back,hasDraft:dirty}
}
