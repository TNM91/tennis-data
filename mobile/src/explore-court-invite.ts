import {Clipboard} from '@capacitor/clipboard'
import {Share} from '@capacitor/share'
import type {SupabaseClient} from '@supabase/supabase-js'
import {isValidCalendarDate} from '../../lib/calendar-date'
import {hittingPlanTimeZone as courtTimeZone} from '../../lib/hitting-plan'
import {calendarDraft,personalDraft,sameCalendarDraft,type CalendarDraft} from '../../lib/native-calendar-contract'
import type {PlayerCalendarItem} from '../../lib/player-calendar-items'
import {todayDateKey} from '../../lib/team-room-match-flow'
import websiteUi from '../generated/website-ui.json'
import {calendarRequest,readCalendarItem,shiftCalendarDay} from './calendar-data'
import {clubBookingPhone,hittingPlanLocation,stLouisHittingClubs,type ExploreCourt} from './explore-court-catalog'
import {courtInviteMessage} from './court-invite-message'
import {readSavedCourts,toggleSavedCourt,type CourtPreference} from './explore-saved-courts'
import {html} from './match-details'

const courtsById=new Map(stLouisHittingClubs.map(court=>[court.id,court]))
export type CourtInviteCalendar={client:SupabaseClient;changed:()=>void;open:(saved:PlayerCalendarItem)=>void}

export function openCourtInvite(trigger:HTMLElement,current:()=>boolean,owner?:string,selectedCourt?:string,onSaved?:()=>void,calendar?:CourtInviteCalendar){
 const dialog=document.createElement('dialog')
 let saved=readSavedCourts(owner)
 let preferencesChanged=false
 dialog.className='captain-lineup-dialog scorecard-share-dialog court-invite-dialog'
 dialog.setAttribute('aria-labelledby','court-invite-title')
 dialog.innerHTML=`<div class="court-invite-heading">
   <h2 id="court-invite-title" tabindex="-1">Invite to hit</h2>
   <button type="button" class="secondary" data-invite-close>Close</button>
  </div>
  <form>
   <fieldset class="court-invite-fields">
    <legend class="sr-only">Hitting invite details</legend>
    <label>Tennis club<span class="explore-picker"><select name="court"></select>${websiteUi.actionIcons.down}</span></label>
    <div class="court-invite-club-contact" data-invite-club-contact hidden>
     <a data-invite-call aria-describedby="invite-club-phone">Call club</a><span id="invite-club-phone"></span>
    </div>
    ${owner?`<div class="court-invite-preferences" role="group" aria-label="Save this court">
     <button type="button" class="secondary" data-invite-favorite aria-pressed="false">Favorite</button>
     <button type="button" class="secondary" data-invite-home aria-pressed="false">Home court</button>
    </div>`:''}
    <div class="court-invite-preferences court-invite-date-options" role="group" aria-label="Quick dates">
     <button type="button" class="secondary" data-invite-day="0" aria-pressed="false">Today</button>
     <button type="button" class="secondary" data-invite-day="1" aria-pressed="false">Tomorrow</button>
     <button type="button" class="secondary" data-invite-day="flexible" aria-pressed="true">Flexible</button>
    </div>
    <label>Date (optional)<input type="date" name="date"></label>
    <label>Central time (optional)<input type="time" name="time" disabled></label>
   </fieldset>
   <div class="court-invite-preview" role="group" aria-label="Invite preview">
    <p data-invite-preview></p><small>Includes Apple Maps and Google Maps directions</small>
   </div>
   <p class="court-invite-help">Meet during staffed hours and tell someone you trust your plans.</p>
   <p class="court-invite-status" role="status"></p>
   <label data-invite-manual hidden>Invite text<textarea readonly></textarea></label>
   <div class="scorecard-share-actions">
    <button type="button" data-invite-share>Share invite</button>
    <button type="button" class="secondary" data-invite-copy>Copy invite</button>
   </div>
   ${calendar&&owner?`<div class="court-invite-calendar">
    <button type="button" class="secondary" data-invite-save>Save to Calendar</button>
    <button type="button" class="secondary" data-invite-calendar hidden>View in Calendar</button>
   </div>`:''}
  </form>`
 const form=dialog.querySelector('form')!
 const fields=form.querySelector('fieldset')!
 const courtField=form.querySelector('select')!
 const contact=form.querySelector<HTMLElement>('[data-invite-club-contact]')!
 const callClub=contact.querySelector<HTMLAnchorElement>('[data-invite-call]')!
 const phoneLabel=contact.querySelector<HTMLElement>('#invite-club-phone')!
 const day=form.querySelector<HTMLInputElement>('[name="date"]')!
 const time=form.querySelector<HTMLInputElement>('[name="time"]')!
 const quickDates=form.querySelectorAll<HTMLButtonElement>('[data-invite-day]')
 const preview=form.querySelector<HTMLElement>('[data-invite-preview]')!
 const status=form.querySelector<HTMLElement>('[role="status"]')!
 const manual=form.querySelector<HTMLLabelElement>('[data-invite-manual]')!
 const textBox=manual.querySelector('textarea')!
 const share=form.querySelector<HTMLButtonElement>('[data-invite-share]')!
 const copy=form.querySelector<HTMLButtonElement>('[data-invite-copy]')!
 const save=form.querySelector<HTMLButtonElement>('[data-invite-save]')
 const viewCalendar=form.querySelector<HTMLButtonElement>('[data-invite-calendar]')
 const favoriteButton=form.querySelector<HTMLButtonElement>('[data-invite-favorite]')
 const homeButton=form.querySelector<HTMLButtonElement>('[data-invite-home]')
 let busy=false
 const planIds=new Map<string,string>()
 const savedPlans=new Map<string,PlayerCalendarItem>()
 const slot=()=>`${courtField.value}|${day.value}|${time.value}`
 const selectedClub=()=>courtsById.get(courtField.value)??stLouisHittingClubs[0]
 const today=()=>todayDateKey(new Date(),courtTimeZone)
 const presetDate=(button:HTMLButtonElement,baseDate:string)=>button.dataset.inviteDay==='flexible'
  ?'':shiftCalendarDay(baseDate,Number(button.dataset.inviteDay))
 const active=()=>dialog.open&&current()
 const dispose=()=>{
  if(!dialog.open)return
  dialog.close();dialog.remove()
  if(current()){
   if(trigger.isConnected)trigger.focus({preventScroll:true})
   if(preferencesChanged)onSaved?.()
  }
 }

 function renderCourts(selected:string){
  const option=(court:ExploreCourt)=>`<option value="${html(court.id)}">${html(court.name)}</option>`
  const home=stLouisHittingClubs.filter(court=>court.id===saved.home)
  const favorites=stLouisHittingClubs.filter(court=>court.id!==saved.home&&saved.favorites.includes(court.id))
  const others=stLouisHittingClubs.filter(court=>court.id!==saved.home&&!saved.favorites.includes(court.id))
  const groups:[string,ExploreCourt[]][]=[['Home court',home],['Favorites',favorites],['Other clubs',others]]
  courtField.innerHTML=home.length||favorites.length?groups.map(([label,list])=>
   list.length?`<optgroup label="${label}">${list.map(option).join('')}</optgroup>`:'').join(''):stLouisHittingClubs.map(option).join('')
  courtField.value=selected
 }

 function toggleSaved(preference:CourtPreference){
  if(!active()||busy||!owner)return
  const id=courtField.value
  if(!courtsById.has(id))return
  try{
   const result=toggleSavedCourt(owner,id,preference)
   saved=result.saved;preferencesChanged=true
   renderCourts(id);update()
   status.textContent=result.message
  }catch{status.textContent='Couldn’t save the court on this device. Try again.'}
 }

 function message(court=selectedClub()){
  return courtInviteMessage(court,{date:day.value,time:time.value})
 }

 function update(){
  day.min=today()
  quickDates.forEach(button=>button.setAttribute('aria-pressed',String(day.value===presetDate(button,day.min))))
  time.disabled=!day.value
  if(!day.value)time.value=''
  const court=selectedClub(),phone=clubBookingPhone(court)
  preview.textContent=message(court).body
  contact.hidden=!phone
  if(phone){
   callClub.href=phone.href
   phoneLabel.textContent=phone.label
  }
  favoriteButton?.setAttribute('aria-pressed',String(saved.favorites.includes(courtField.value)))
  homeButton?.setAttribute('aria-pressed',String(saved.home===courtField.value))
  status.textContent=''
  manual.hidden=true
  if(save&&viewCalendar){save.hidden=savedPlans.has(slot());viewCalendar.hidden=!save.hidden}
 }

 function validateSchedule(){
  day.min=today()
  const {start}=message()
  const invalidDay=day.value&&(!isValidCalendarDate(day.value)||day.value<day.min)
  const timeError=!time.value?'':!start?'Choose a valid Central time.':start.getTime()<Date.now()?'Choose a future time.':''
  if(invalidDay||timeError){
   status.textContent=invalidDay?'Choose today or a future date.':timeError
   ;(invalidDay?day:time).focus()
   return false
  }
  return form.reportValidity()
 }

 async function savePlan(){
  if(!calendar||!owner||!save||!viewCalendar||busy||!active()||!validateSchedule())return
  if(!day.value||!time.value){
   status.textContent='Choose a date and start time to save a proposed hit.'
   ;(day.value?time:day).focus()
   return
  }
  const key=slot(),court=selectedClub()
  const id=planIds.get(key)??'player-calendar-'+crypto.randomUUID()
  planIds.set(key,id)
  let draft:CalendarDraft
  try{draft=calendarDraft({id,title:`Hit at ${court.name}`,date:day.value,time:time.value,location:hittingPlanLocation(court),
   kind:'match',recurrenceRule:'',availabilityStatus:'',venueDirectoryId:'',venuePreferenceId:'',hittingPlan:{clubId:court.id}})}
  catch(error){status.textContent=error instanceof Error?error.message:'Check the date and time for this hit.';return}
  busy=true;fields.disabled=true;share.disabled=true;copy.disabled=true;save.disabled=true
  status.textContent='Saving your hitting plan…';manual.hidden=true
  try{
   let result
   try{result=await calendarRequest(calendar.client,owner,active,{},{action:'create',item:draft,expectedUpdatedAt:''})}
   catch{
    if(!active())return
    result=await calendarRequest(calendar.client,owner,active,{item:id})
   }
   if(!active())return
   const saved=readCalendarItem(result.item)
   if(!saved||!sameCalendarDraft(personalDraft(saved),draft))throw Error()
   savedPlans.set(key,saved)
   calendar.changed()
   update()
   status.textContent='Saved as proposed. Confirm the plan in Calendar once you’ve agreed on a time.'
  }catch{if(active())status.textContent='Couldn’t confirm the save. Try again to check the same plan.'}
  finally{
   busy=false
   if(active()){
    fields.disabled=false;share.disabled=false;copy.disabled=false;save.disabled=false
    ;(savedPlans.has(key)?viewCalendar:save).focus({preventScroll:true})
   }
  }
 }

 async function deliver(button:HTMLButtonElement){
  if(busy||!active()||!validateSchedule())return
  const {body,directions}=message()
  const text=`${body}\n\n${directions}`
  const copying=button===copy
  busy=true;fields.disabled=true;share.disabled=true;copy.disabled=true
  status.textContent='';manual.hidden=true
  try{
   if(copying)await Clipboard.write({string:text})
   else await Share.share({title:'Tennis hitting invite',text,dialogTitle:'Share hitting invite'})
   if(active())status.textContent=copying?'Invite copied.':'Share sheet closed.'
  }catch(error){
   if(!active())return
   const canceled=!copying&&error instanceof Error&&(error.name==='AbortError'||error.message==='Share canceled')
   if(!canceled)status.textContent=copying?'Select and copy the invite text below.':'Couldn’t open sharing. You can copy the invite instead.'
   if(copying){textBox.value=text;manual.hidden=false}
  }finally{
   busy=false
   if(active()){
    fields.disabled=false;share.disabled=false;copy.disabled=false
    if(manual.hidden)button.focus({preventScroll:true})
    else{textBox.focus();textBox.select()}
   }
  }
 }

 form.oninput=update
 form.onsubmit=event=>{event.preventDefault();void deliver(share)}
 quickDates.forEach(button=>{button.onclick=()=>{
  day.value=presetDate(button,today())
  update()
 }})
 share.onclick=()=>{void deliver(share)}
 copy.onclick=()=>{void deliver(copy)}
 if(save)save.onclick=()=>{void savePlan()}
 if(viewCalendar)viewCalendar.onclick=()=>{
  const saved=savedPlans.get(slot())
  if(active()&&!busy&&saved)calendar?.open(saved)
 }
 if(favoriteButton)favoriteButton.onclick=()=>toggleSaved('favorite')
 if(homeButton)homeButton.onclick=()=>toggleSaved('home')
 dialog.querySelector<HTMLButtonElement>('[data-invite-close]')!.onclick=dispose
 dialog.oncancel=event=>{event.preventDefault();dispose()}
 const defaultCourt=courtsById.get(saved.home)?.id||stLouisHittingClubs.find(court=>saved.favorites.includes(court.id))?.id||stLouisHittingClubs[0].id
 renderCourts(selectedCourt&&courtsById.has(selectedCourt)?selectedCourt:defaultCourt)
 update()
 document.body.append(dialog);dialog.showModal()
 dialog.querySelector('h2')!.focus({preventScroll:true})
 return {dispose,isOpen:()=>dialog.open}
}
