import {Clipboard} from '@capacitor/clipboard'
import {CONTACT_EMAILS} from '../../lib/contact-details'
import {courtFeedbackList} from './court-feedback-view'
import {clubBookingPhone,type ExploreCourt} from './explore-court-catalog'
import {openCourtDirections} from './explore-court-directions'
import {openCourtInvite,type CourtInviteCalendar} from './explore-court-invite'
import {html} from './match-details'
import {Browser} from './native-browser'
import type {CourtFeedbackVisit} from './personal-match-data'
import {matchDate} from './recent-results'

export type LoadCourtFeedback=(courtId:string,current:()=>boolean)=>Promise<CourtFeedbackVisit|null>
type CourtInfoOptions={owner?:string;loadFeedback?:LoadCourtFeedback;onSaved?:()=>void;calendar?:CourtInviteCalendar}

export function openCourtInfo(court:ExploreCourt,trigger:HTMLElement,current:()=>boolean,{owner,loadFeedback,onSaved,calendar}:CourtInfoOptions={}){
 if(!court.source||court.access==='private')return
 const source=court.source
 const dialog=document.createElement('dialog')
 dialog.className='captain-lineup-dialog scorecard-share-dialog court-info-dialog'
 dialog.setAttribute('aria-labelledby','court-info-title')
 dialog.setAttribute('aria-describedby','court-info-venue')
 const prefix=court.name+', '
 const destination=court.destination.startsWith(prefix)?court.destination.slice(prefix.length):court.destination
 const club=court.access==='club'
 const access=[club?'Check guest access':'Public access',court.accessNote].filter(Boolean).join(' · ')
 const phone=clubBookingPhone(court)
 const report=`Court: ${court.name}\r\nListed address: ${destination}\r\n\r\nWhat should we check?\r\n`
 const mailto=`mailto:${CONTACT_EMAILS.support}?subject=${encodeURIComponent('Court issue: '+court.name)}&body=${encodeURIComponent(report)}`
 dialog.innerHTML=`<div class="court-invite-heading">
  <h2 id="court-info-title" tabindex="-1">Court info</h2>
  <button class="secondary" type="button" data-court-info-close>Close</button>
 </div>
 <div id="court-info-venue" class="court-directions-venue"><strong>${html(court.name)}</strong><span>${html(destination)}</span><span>${html(access)}</span></div>
 <div class="court-info-actions court-info-venue-actions" role="group" aria-label="Court actions">
  ${club?'<button class="court-info-primary" type="button" data-court-info-invite aria-haspopup="dialog">Invite here</button>':''}
  <button class="${club?'secondary':'court-info-primary'}" type="button" data-court-info-directions aria-haspopup="dialog">Directions</button>
  ${phone?`<a class="court-info-call" href="${html(phone.href)}" aria-describedby="court-info-phone">Call club</a>`:''}
  <button class="secondary" type="button" data-court-info-source>${club?'Court rentals':'Official court listing'}</button>
 </div>
 ${phone?`<p id="court-info-phone" class="court-invite-help">${html(phone.label)}</p>`:''}
 ${club?'<p class="court-invite-help">Check court time, guest access, and staffed hours.</p>':''}
 <p role="status" class="court-invite-status" data-court-info-status></p>
 ${loadFeedback?`<details class="court-info-ratings">
  <summary>Your court ratings</summary>
  <p role="status" data-court-ratings-status></p>
  <div data-court-ratings-result></div>
  <button class="secondary" type="button" data-court-ratings-retry hidden>Retry ratings</button>
 </details>`:''}
 <details class="court-info-report"><summary>Report a court issue</summary>
  <p>Flag an incorrect address, access change, closure, or safety concern. The email draft includes the court and its listed address.</p>
  <div class="court-info-actions">
   <a class="court-info-primary" href="${html(mailto)}">Open email draft</a>
   <button class="secondary" type="button" data-court-info-copy>Copy report details</button>
  </div>
  <p class="court-invite-help">Send to ${CONTACT_EMAILS.support}.</p>
  <p role="status" class="court-invite-status" data-court-report-status></p>
  <label data-court-report-manual hidden>Report details<textarea readonly rows="5">${html(report)}</textarea></label>
 </details>`
 let child:ReturnType<typeof openCourtDirections>|undefined
 let preferencesChanged=false
 const active=()=>dialog.open&&current()
 const dispose=()=>{
  if(!dialog.open)return
  dialog.close();child?.dispose();dialog.remove()
  if(current()){
   if(trigger.isConnected)trigger.focus({preventScroll:true})
   if(preferencesChanged)onSaved?.()
  }
 }
 const back=()=>{
  if(child?.isOpen())child.dispose()
  else dispose()
  return true
 }
 const directionsButton=dialog.querySelector<HTMLButtonElement>('[data-court-info-directions]')!
 directionsButton.onclick=()=>{if(active()&&!child?.isOpen())child=openCourtDirections(court,directionsButton,active)}
 const inviteButton=dialog.querySelector<HTMLButtonElement>('[data-court-info-invite]')
 if(inviteButton)inviteButton.onclick=()=>{
  if(active()&&!child?.isOpen())child=openCourtInvite(inviteButton,active,owner,court.id,()=>{preferencesChanged=true},calendar)
 }
 const ratings=dialog.querySelector<HTMLDetailsElement>('.court-info-ratings')
 if(ratings&&loadFeedback){
  const ratingStatus=ratings.querySelector<HTMLElement>('[data-court-ratings-status]')!
  const result=ratings.querySelector<HTMLElement>('[data-court-ratings-result]')!
  const retry=ratings.querySelector<HTMLButtonElement>('[data-court-ratings-retry]')!
  let loaded=false,reading=false
  const read=async()=>{
   if(!active()||!ratings.open||loaded||reading)return
   const retryFocused=document.activeElement===retry
   reading=true;retry.hidden=true;ratingStatus.textContent='Loading your court ratings…'
   try{
    const visit=await loadFeedback(court.id,active)
    if(!active())return
    loaded=true
    ratingStatus.textContent=visit?'Last rated match · '+matchDate(visit.date):'No saved ratings for this court yet.'
    result.innerHTML=visit?courtFeedbackList(visit.ratings):''
    if(retryFocused&&ratings.open)ratings.querySelector('summary')?.focus({preventScroll:true})
   }catch{
    if(active()){
     ratingStatus.textContent='Couldn’t load your court ratings.'
     retry.hidden=false
     if(retryFocused&&ratings.open)retry.focus({preventScroll:true})
    }
   }finally{reading=false}
  }
  ratings.ontoggle=()=>{void read()}
  retry.onclick=()=>{void read()}
 }
 const listing=dialog.querySelector<HTMLButtonElement>('[data-court-info-source]')!
 const listingStatus=dialog.querySelector<HTMLElement>('[data-court-info-status]')!
 listing.onclick=async()=>{
  if(!active()||listing.disabled)return
  listing.disabled=true;listingStatus.textContent=''
  try{await Browser.open({url:source})}
  catch{if(active())listingStatus.textContent='Couldn’t open the official listing. Try again.'}
  finally{if(active())listing.disabled=false}
 }
 const copy=dialog.querySelector<HTMLButtonElement>('[data-court-info-copy]')!
 const reportStatus=dialog.querySelector<HTMLElement>('[data-court-report-status]')!
 const manual=dialog.querySelector<HTMLElement>('[data-court-report-manual]')!
 copy.onclick=async()=>{
  if(!active()||copy.disabled)return
  copy.disabled=true;manual.hidden=true;reportStatus.textContent=''
  try{
   await Clipboard.write({string:report})
   if(active())reportStatus.textContent='Report details copied.'
  }catch{
   if(!active())return
   reportStatus.textContent='Select and copy the report details below.'
   manual.hidden=false
   const field=manual.querySelector('textarea')!
   field.focus();field.select()
  }finally{if(active())copy.disabled=false}
 }
 dialog.querySelector<HTMLButtonElement>('[data-court-info-close]')!.onclick=dispose
 dialog.oncancel=event=>{event.preventDefault();back()}
 document.body.append(dialog);dialog.showModal();dialog.querySelector('h2')!.focus({preventScroll:true})
 return {dispose,back,isOpen:()=>dialog.open}
}
