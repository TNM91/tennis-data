import {Clipboard} from '@capacitor/clipboard'
import {CONTACT_EMAILS} from '../../lib/contact-details'
import type {ExploreCourt} from './explore-court-catalog'
import {html} from './match-details'
import {Browser} from './native-browser'

export function openCourtInfo(court:ExploreCourt,trigger:HTMLElement,current:()=>boolean){
 if(!court.source||court.access==='private')return
 const source=court.source
 const dialog=document.createElement('dialog')
 dialog.className='captain-lineup-dialog scorecard-share-dialog court-info-dialog'
 dialog.setAttribute('aria-labelledby','court-info-title')
 const prefix=court.name+', '
 const destination=court.destination.startsWith(prefix)?court.destination.slice(prefix.length):court.destination
 const access=[court.access==='club'?'Check guest access':'Public access',court.accessNote].filter(Boolean).join(' · ')
 const report=`Court: ${court.name}\r\nListed address: ${destination}\r\n\r\nWhat should we check?\r\n`
 const mailto=`mailto:${CONTACT_EMAILS.support}?subject=${encodeURIComponent('Court issue: '+court.name)}&body=${encodeURIComponent(report)}`
 dialog.innerHTML=`<div class="court-invite-heading">
  <h2 id="court-info-title" tabindex="-1">Court info</h2>
  <button class="secondary" type="button" data-court-info-close>Close</button>
 </div>
 <div class="court-directions-venue"><strong>${html(court.name)}</strong><span>${html(destination)}</span><span>${html(access)}</span></div>
 <button class="secondary court-info-source" type="button" data-court-info-source>Official court listing</button>
 <p role="status" class="court-invite-status" data-court-info-status></p>
 <details class="court-info-report"><summary>Report a court issue</summary>
  <p>Flag an incorrect address, access change, closure, or safety concern. The email draft includes the court and its listed address.</p>
  <div class="court-info-actions">
   <a class="court-info-email" href="${html(mailto)}">Open email draft</a>
   <button class="secondary" type="button" data-court-info-copy>Copy report details</button>
  </div>
  <p class="court-invite-help">Send to ${CONTACT_EMAILS.support}.</p>
  <p role="status" class="court-invite-status" data-court-report-status></p>
  <label data-court-report-manual hidden>Report details<textarea readonly rows="5">${html(report)}</textarea></label>
 </details>`
 const active=()=>dialog.open&&current()
 const dispose=()=>{
  if(!dialog.open)return
  dialog.close();dialog.remove()
  if(current()&&trigger.isConnected)trigger.focus({preventScroll:true})
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
 dialog.oncancel=event=>{event.preventDefault();dispose()}
 document.body.append(dialog);dialog.showModal();dialog.querySelector('h2')!.focus({preventScroll:true})
 return {dispose,isOpen:()=>dialog.open}
}
