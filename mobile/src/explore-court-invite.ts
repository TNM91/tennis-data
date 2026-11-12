import {Clipboard} from '@capacitor/clipboard'
import {Share} from '@capacitor/share'
import {eventCalendarStart,formatCalendarDay,isValidCalendarDate} from '../../lib/calendar-date'
import {todayDateKey} from '../../lib/team-room-match-flow'
import websiteUi from '../generated/website-ui.json'
import {stLouisHittingClubs,type ExploreCourt} from './explore-court-catalog'
import {courtDirections} from './explore-court-directions'
import {readSavedCourts,toggleSavedCourt,type CourtPreference} from './explore-saved-courts'
import {html} from './match-details'

const courtTimeZone='America/Chicago'
const courtTimeFormat=new Intl.DateTimeFormat('en-US',{timeZone:courtTimeZone,hour:'numeric',minute:'2-digit',timeZoneName:'short'})
const courtsById=new Map(stLouisHittingClubs.map(court=>[court.id,court]))

export function openCourtInvite(trigger:HTMLElement,current:()=>boolean,owner?:string,selectedCourt?:string,onSaved?:()=>void){
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
    ${owner?`<div class="court-invite-preferences" role="group" aria-label="Save this court">
     <button type="button" class="secondary" data-invite-favorite aria-pressed="false">Favorite</button>
     <button type="button" class="secondary" data-invite-home aria-pressed="false">Home court</button>
    </div>`:''}
    <label>Date (optional)<input type="date" name="date" min="${todayDateKey(new Date(),courtTimeZone)}"></label>
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
  </form>`
 const form=dialog.querySelector('form')!
 const fields=form.querySelector('fieldset')!
 const courtField=form.querySelector('select')!
 const day=form.querySelector<HTMLInputElement>('[name="date"]')!
 const time=form.querySelector<HTMLInputElement>('[name="time"]')!
 const preview=form.querySelector<HTMLElement>('[data-invite-preview]')!
 const status=form.querySelector<HTMLElement>('[role="status"]')!
 const manual=form.querySelector<HTMLLabelElement>('[data-invite-manual]')!
 const textBox=manual.querySelector('textarea')!
 const share=form.querySelector<HTMLButtonElement>('[data-invite-share]')!
 const copy=form.querySelector<HTMLButtonElement>('[data-invite-copy]')!
 const favoriteButton=form.querySelector<HTMLButtonElement>('[data-invite-favorite]')
 const homeButton=form.querySelector<HTMLButtonElement>('[data-invite-home]')
 let busy=false
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

 function message(){
  const court=courtsById.get(courtField.value)??stLouisHittingClubs[0]
  const date=isValidCalendarDate(day.value)?formatCalendarDay(day.value):''
  const start=day.value&&time.value?eventCalendarStart(day.value,time.value,courtTimeZone):null
  const when=date?` on ${date}${start?' at '+courtTimeFormat.format(start):''}`:''
  const {apple,google}=courtDirections(court)
  const directions=`Apple Maps: ${apple}\nGoogle Maps: ${google}`
  return {body:`Want to hit at ${court.name}${when}?${start?'':' What time works for you?'}`,directions,start}
 }

 function update(){
  time.disabled=!day.value
  if(!day.value)time.value=''
  preview.textContent=message().body
  favoriteButton?.setAttribute('aria-pressed',String(saved.favorites.includes(courtField.value)))
  homeButton?.setAttribute('aria-pressed',String(saved.home===courtField.value))
  status.textContent=''
  manual.hidden=true
 }

 async function deliver(button:HTMLButtonElement){
  if(busy||!active())return
  day.min=todayDateKey(new Date(),courtTimeZone)
  const {body,directions,start}=message()
  const invalidDay=day.value&&(!isValidCalendarDate(day.value)||day.value<day.min)
  const timeError=!time.value?'':!start?'Choose a valid Central time.':start.getTime()<Date.now()?'Choose a future time.':''
  if(invalidDay||timeError){
   status.textContent=invalidDay?'Choose today or a future date.':timeError
   const field=invalidDay?day:time
   field.focus()
   return
  }
  if(!form.reportValidity())return
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
 share.onclick=()=>{void deliver(share)}
 copy.onclick=()=>{void deliver(copy)}
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
