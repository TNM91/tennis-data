import type {SupabaseClient} from '@supabase/supabase-js'
import {getCoachAssignmentPack,getCoachAssignmentSummary,type CoachAssignment} from '../../lib/coach-storage'
import type {TrainingCoachLink} from './training-inbox-data'
import {coachCheckInDraft,submitCoachCheckIn,CoachCheckInError,type CoachCheckIn,type CoachPracticeStats} from './coach-check-in'
import {trainingTime} from './level-up-model'
import {html} from './match-details'
const evidenceLimit=300
export function openCoachCheckIn(client:SupabaseClient,owner:string,current:()=>boolean,assignment:CoachAssignment,link:TrainingCoachLink,refresh:(saved:boolean)=>void,practice?:CoachPracticeStats){
 const dialog=document.createElement('dialog')
 dialog.className='captain-lineup-dialog training-dialog coach-check-in-screen'
 dialog.setAttribute('aria-label','Coach assignment check-in')
 const previous=document.activeElement as HTMLElement|null
 const proofTarget=getCoachAssignmentSummary(assignment.assignment).expectedEvidence
 const packDrills=getCoachAssignmentPack(assignment.assignment)?.items.filter(item=>item.status!=='skipped').length??0
 const practiceDate=practice?new Date(practice.completedAt).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):''
 const practiceStats=practice?`Self-rated proof ${practice.rating}/5${practice.elapsedSeconds?` · ${trainingTime(practice.elapsedSeconds)} timed`:''}`:''
 const practiceEvidence=practice?`${practice.drillTitle} · ${practiceStats}`:''
 let disposed=false,busy=false,attempted=false,conflict=false,leaving=false
 let recap='',evidence='',notice='',draft:CoachCheckIn|null=null
 const active=()=>!disposed&&current()
 const dispose=()=>{
  if(disposed)return
  disposed=true;draft=null;recap='';evidence=''
  dialog.remove()
  if(current()&&previous?.isConnected)previous.focus()
 }
 const close=()=>{
  if(busy)return
  if(recap||evidence||attempted){leaving=true;render()}
  else dispose()
 }
 const finish=(saved:boolean)=>{dispose();if(current())refresh(saved)}
 const request=async(lookup:boolean)=>{
  if(!draft||busy||!active()||(!lookup&&conflict))return
  busy=true;attempted=true
  notice=lookup?'Checking your saved check-in…':'Sending your check-in…'
  render('[data-check-in-status]')
  try{
   const found=await submitCoachCheckIn(client,owner,active,draft,lookup)
   if(!active())return
   busy=false
   if(found){finish(true);return}
   notice='Discard and refresh to review the latest assignment before sending again.'
  }catch(error){
   if(!active())return
   busy=false
   conflict=conflict||error instanceof CoachCheckInError&&error.conflict
   notice=conflict?'This assignment changed. Check the saved check-in or discard and refresh.':'Check whether your check-in saved before trying again.'
  }
  render('[data-check-in-status]')
 }
 const statusHtml=()=>`<p class="coach-check-in-status" data-check-in-status tabindex="-1" role="status">${html(notice)}</p>`
 const writeHtml=()=>`<form data-form>
  <label>Your recap<textarea name="recap" rows="3" maxlength="700" required placeholder="What did you work on?"></textarea></label>
  <label>Proof or next-match cue<textarea name="evidence" rows="2" maxlength="${evidenceLimit}" aria-describedby="coach-check-in-proof" placeholder="Add a result or cue"></textarea></label>
  <p id="coach-check-in-proof">Optional.${proofTarget?` <strong>Coach’s proof target</strong> ${html(proofTarget)}`:''}</p>
  ${practice?`<div class="coach-check-in-practice">
   <small class="stat-eyebrow">Saved practice · ${html(practiceDate)}</small>
   <div id="coach-practice-stats"><strong>${html(practice.drillTitle)}</strong><p>${html(practiceStats)}</p></div>
   <button type="button" class="secondary" data-add-practice aria-describedby="coach-practice-stats">Add practice stats</button>
  </div>`:''}
  ${statusHtml()}
  <button type="submit">Review check-in</button>
 </form>`
 const reviewHtml=(review:CoachCheckIn)=>`
  <dl class="coach-check-in-preview">
   <div><dt>Your recap</dt><dd>${html(review.recap)}</dd></div>
   <div><dt>Your proof</dt><dd>${html(review.evidence||'Optional proof left blank.')}</dd></div>
  </dl>
  <p class="coach-check-in-share">Sending shares this with your coach and marks the assignment complete.${packDrills?` It also records completion for ${packDrills} pack ${packDrills===1?'drill':'drills'}.`:''}</p>
  ${statusHtml()}
  <div class="coach-check-in-actions">
   ${attempted?`<button type="button" data-check ${busy?'disabled':''}>Check saved check-in</button>`:''}
   <button type="button" data-send ${attempted?'class="secondary"':''} ${busy||conflict?'disabled':''}>${busy?'Working…':attempted?'Retry same check-in':'Send check-in'}</button>
   ${attempted?'':'<button type="button" class="secondary" data-edit>Edit recap</button>'}
  </div>`
 const render=(focusTarget='h1')=>{
  if(!active())return
  dialog.innerHTML=`<header class="training-inbox-header coach-check-in-header">
   <div>
    ${leaving?'':`<small class="stat-eyebrow">Step ${draft?'2':'1'} of 2</small>`}
    <h1 tabindex="-1">${leaving?'Leave check-in?':draft?'Review check-in':'Write check-in'}</h1>
   </div>
   ${leaving?'':`<button type="button" class="secondary" data-close aria-label="Close check-in" ${busy?'disabled':''}>Close</button>`}
  </header>
  ${leaving?`
   <p>${attempted?'Your check-in may already be saved. Refresh your coach assignments to check.':'Leaving will discard your unsent recap and proof.'}</p>
   <div class="coach-check-in-actions"><button type="button" data-keep>Keep check-in</button><button type="button" class="secondary" data-discard>Discard and refresh</button></div>`:`
   <div class="coach-check-in-assignment">
    <small class="stat-eyebrow">Coach assignment</small>
    <h2>${html(assignment.title)}</h2>
    ${assignment.focus&&!draft?`<p>${html(assignment.focus)}</p>`:''}
   </div>
   ${draft?reviewHtml(draft):writeHtml()}`}`
  const recapInput=dialog.querySelector<HTMLTextAreaElement>('[name=recap]')
  const evidenceInput=dialog.querySelector<HTMLTextAreaElement>('[name=evidence]')
  if(recapInput){
   recapInput.value=recap
   recapInput.oninput=()=>{recap=recapInput.value}
  }
  if(evidenceInput){
   const status=dialog.querySelector<HTMLElement>('[data-check-in-status]')!
   evidenceInput.value=evidence
   evidenceInput.oninput=()=>{evidence=evidenceInput.value;notice='';status.textContent=''}
   dialog.querySelector<HTMLButtonElement>('[data-add-practice]')?.addEventListener('click',()=>{
    const next=evidence.split('\n').includes(practiceEvidence)?evidence:[evidence.trimEnd(),practiceEvidence].filter(Boolean).join('\n')
    if(next.length<=evidenceLimit){evidence=next;evidenceInput.value=next;notice='Practice stats added to your proof.'}
    else notice='Make space in your proof to add the practice stats.'
    status.textContent=notice
    evidenceInput.focus()
    evidenceInput.setSelectionRange(evidence.length,evidence.length)
   })
  }
  const form=dialog.querySelector<HTMLFormElement>('[data-form]')
  if(form)form.onsubmit=event=>{
   event.preventDefault()
   try{draft=coachCheckInDraft(assignment,link,recap,evidence)}
   catch{
    notice=recap.trim()?'Refresh this assignment before sending a check-in.':'Add your recap, then review your check-in.'
    dialog.querySelector<HTMLElement>('[data-check-in-status]')!.textContent=notice
    recapInput?.focus()
    return
   }
   notice='';render()
  }
  dialog.querySelector('[data-send]')?.addEventListener('click',()=>{void request(false)})
  dialog.querySelector('[data-check]')?.addEventListener('click',()=>{void request(true)})
  dialog.querySelector('[data-close]')?.addEventListener('click',close)
  dialog.querySelector('[data-edit]')?.addEventListener('click',()=>{draft=null;render('[name=recap]')})
  dialog.querySelector('[data-keep]')?.addEventListener('click',()=>{leaving=false;render(draft?'h1':'[name=recap]')})
  dialog.querySelector('[data-discard]')?.addEventListener('click',()=>finish(false))
  if(dialog.open){
   if(focusTarget==='h1')dialog.scrollTop=0
   dialog.querySelector<HTMLElement>(focusTarget)?.focus()
  }
 }
 dialog.oncancel=event=>{event.preventDefault();close()}
 document.body.append(dialog)
 render()
 dialog.showModal()
 dialog.querySelector<HTMLElement>('h1')?.focus()
 return {dispose,back:close,isOpen:()=>!disposed}
}
