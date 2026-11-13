import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {formatCaptainPracticeDate} from '../../lib/captain-practice-invite'
import {isValidCalendarDate} from '../../lib/calendar-date'
import {practiceId} from '../../lib/native-player-practice-contract'
import {practiceReminderLimit,type PracticeReminderReview,type PracticeReminderSend} from '../../lib/native-practice-reminder-contract'
import {updateTimestamp} from '../../lib/native-updates-contract'
import type {NativePractice} from './captain-practices-data'
import {html} from './match-details'
import type {TeamScope} from './team-room-data'

export function openPracticeReminder(client:SupabaseClient,owner:string,scope:TeamScope,practice:NativePractice,current:()=>boolean){
 const dialog=document.createElement('dialog')
 const previous=document.activeElement as HTMLElement|null
 dialog.className='captain-lineup-dialog training-dialog'
 dialog.setAttribute('aria-label','Practice reminder')
 let disposed=false,busy=false,review:PracticeReminderReview|null=null,pending:PracticeReminderSend|null=null
 let count:number|null=null,notice='',stale=false
 const active=()=>!disposed&&current()
 const focus=()=>dialog.querySelector<HTMLElement>('h1')?.focus({preventScroll:true})
 const dispose=()=>{
  disposed=true
  document.removeEventListener('visibilitychange',resume)
  dialog.remove()
  if(current()&&previous?.isConnected)previous.focus({preventScroll:true})
 }
 const close=()=>{if(!busy)dispose()}
 const request=async(body?:PracticeReminderSend)=>{
  const {data,error}=await client.auth.getSession()
  if(error||data.session?.user.id!==owner||!data.session.access_token||!active())throw Error('Sign in again to view the reminder.')
  const options={
   url:'https://www.tenaceiq.com/api/mobile/captain/practices/reminder?'+new URLSearchParams({
    team:scope.teamName,league:scope.leagueName,flight:scope.flight,eventId:practice.id,
   }),
   headers:{Authorization:'Bearer '+data.session.access_token,'Cache-Control':'no-store','Content-Type':'application/json'},
   responseType:'json' as const,disableRedirects:true,connectTimeout:12000,readTimeout:20000,
   webFetchExtra:{cache:'no-store' as const},
  }
  const result=body?await CapacitorHttp.post({...options,data:body}):await CapacitorHttp.get(options)
  if(!active())throw Error('Practice reminder closed.')
  if([403,404,409].includes(result.status)){
   stale=true
   throw Error('This practice changed. Refresh the recipient list before sending.')
  }
  const value=result.data
  if(result.status!==200||value?.ok!==true||value.owner!==owner||value.eventId!==practice.id||
     value.scope?.teamName!==scope.teamName||value.scope?.leagueName!==scope.leagueName||value.scope?.flight!==scope.flight)
   throw Error('Practice reminder unavailable.')
  return value
 }
 const load=async()=>{
  if(!active()||busy)return
  busy=true;review=null;pending=null;stale=false;notice='';render()
  try{
   const value=await request()
   if(!active())return
   if(!updateTimestamp(value.updatedAt)||typeof value.date!=='string'||!isValidCalendarDate(value.date)||
      typeof value.alreadySent!=='boolean'||!Array.isArray(value.recipients)||
      value.recipients.length>practiceReminderLimit||
      value.recipients.some((r:PracticeReminderReview['recipients'][number])=>!practiceId(r?.id)||typeof r.name!=='string'||!r.name.trim()||r.name.length>300)||
      new Set(value.recipients.map((r:PracticeReminderReview['recipients'][number])=>r.id)).size!==value.recipients.length)throw Error()
   review={updatedAt:value.updatedAt,date:value.date,alreadySent:value.alreadySent,recipients:value.recipients}
   notice=''
  }catch{if(active())notice=stale?'This practice is unavailable for reminders.':'Couldn’t check recipients. Refresh to try again.'}
  finally{busy=false;if(active()){render();focus()}}
 }
 const send=async()=>{
  if(!active()||busy||stale||!review?.recipients.length||review.alreadySent||count!==null)return
  pending??={requestId:crypto.randomUUID(),updatedAt:review.updatedAt,recipientIds:review.recipients.map(r=>r.id)}
  busy=true;notice='';render()
  try{
   const result=await request(pending)
   if(!active())return
   if(!Number.isInteger(result.count)||result.count<0||result.count>pending.recipientIds.length)throw Error()
   count=result.count;notice=''
  }catch{if(active())notice=stale?'This practice changed or a reminder was already sent. Refresh before sending.':'Send could not be confirmed. Retry this same reminder to check it.'}
  finally{busy=false;if(active()){render();focus()}}
 }
 const render=()=>{
  if(!active())return
  dialog.innerHTML=`<h1 tabindex="-1">${count===null?'Remind players':count?'Reminder sent':'No reminder needed'}</h1>
  <p>${html(practice.title)}${review?' · '+html(formatCaptainPracticeDate(review.date)):''}</p>
  ${count!==null?`<p>${count?`Reminder added to Updates for ${count} ${count===1?'player':'players'}.`:'Nobody on this list still needs a reminder.'}</p>`:
   review?.alreadySent?'<p>A reminder has already been sent for this practice.</p>':
   review?.recipients.length?`<p>These players will get a reminder in Updates if they still haven’t replied.</p>
    <ul>${review.recipients.map(r=>`<li>${html(r.name)}</li>`).join('')}</ul>`:
   review?'<p>No players are eligible for a reminder.</p>':''}
  <p role="status">${html(busy?(pending?'Rechecking replies and sending…':'Checking practice replies…'):notice)}</p>
  ${count===null&&!stale&&review&&!review.alreadySent&&review.recipients.length?
   `<button type="button" data-send ${busy?'disabled':''}>${pending?'Retry same reminder':'Send reminder'}</button>`:''}
  ${count===null&&(!pending||stale)&&!review?.alreadySent?
   `<button type="button" class="secondary" data-refresh ${busy?'disabled':''}>Refresh recipients</button>`:''}
  <button type="button" class="secondary" data-close ${busy?'disabled':''}>Back to sign-ups</button>`
  dialog.querySelector('[data-send]')?.addEventListener('click',()=>{void send()})
  dialog.querySelector('[data-refresh]')?.addEventListener('click',()=>{void load()})
  dialog.querySelector('[data-close]')?.addEventListener('click',close)
 }
 const resume=()=>{
  if(!active()||document.visibilityState!=='visible')return
  render()
 }
 dialog.oncancel=e=>{e.preventDefault();close()}
 document.addEventListener('visibilitychange',resume)
 document.body.append(dialog)
 dialog.showModal()
 void load()
 focus()
 return {dispose,back:close,isOpen:()=>!disposed}
}
