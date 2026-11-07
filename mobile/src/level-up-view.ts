import {openWeeklyCoachReply} from './weekly-coach-reply-view'
import {openCoachCheckIn} from './coach-check-in-view'
import {newWeeklyChange,completionWeeklyChange,saveWeeklyChange,checkWeeklyChange,WeeklyChangeError,type WeeklyChange} from './weekly-plan-actions'
import {Browser} from './native-browser'
import {loadTrainingPlans,loadTrainingCoachWork,type TrainingCoachWork} from './training-inbox-data'
import {trainingPlansHtml,trainingCoachWorkHtml,trainingInboxLaunches} from './training-inbox-view'
import type {WeeklyLevelUpPlan} from '../../lib/level-up/weekly-plan'
import {formatWeekdayDate} from '../../lib/captain-formatters'
import {openCalendar} from './calendar-view'
import {loadTrainingChoices,saveTrainingChoices,chooseTrainingIdentity,emptyTrainingChoices,trainingPlanHtml,trainingIdentity} from './training-identity'
import type {SupabaseClient} from '@supabase/supabase-js'
import {LEVEL_UP_CARDS,LEVEL_UP_MODULES} from '../../lib/level-up/level-up-cards'
import type {LevelUpCard,LevelUpModule} from '../../lib/level-up/level-up-types'
import {MEMBERSHIP_TIERS} from '../../lib/product-story'
import {html} from './match-details'
import {loadTrainingHistory,trainingAccess,saveTrainingSession,confirmsTrainingSave,type TrainingSession,type TrainingSave} from './level-up-data'
import {TrainingClock,trainingContexts,initialTrainingContext,trainingSelection,trainingTime,trainingProgress,freezeTrainingSave} from './level-up-model'
const trainingCueHtml=(card:LevelUpCard)=>`<p class="training-drill-cue"><strong>On-court cue</strong> ${html(card.cue)}</p>`
const trainingClockText=(seconds:number)=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`
const trainingSafetyHtml=(card:LevelUpCard)=>card.safetyNote
 ?`<p class="training-safety"><strong>Safety</strong> ${html(card.safetyNote)}</p>`:''
function trainingDrillOverviewHtml(card:LevelUpCard){
 return `<div class="training-drill-overview">
  <small class="stat-eyebrow">${html(card.pack)}</small>
  <h2>${html(card.title)}</h2>
  <dl class="training-drill-facts">
   <div><dt>Time</dt><dd>${card.durationMinutes} min</dd></div>
   <div><dt>Intensity</dt><dd>${html(card.intensity)}</dd></div>
   <div><dt>Equipment</dt><dd>${html(card.equipment.filter(item=>item!=='none').map(item=>item.replaceAll('-',' ')).join(', ')||'None')}</dd></div>
  </dl>
  ${trainingCueHtml(card)}
 </div>`
}
const trainingRoutineHtml=(card:LevelUpCard)=>`<div class="training-drill-routine">
 <h3>Your routine</h3><ol>${card.routine.map(step=>`<li>${html(step)}</li>`).join('')}</ol>
 <p><strong>Track</strong> · ${html(card.proof)}</p>
</div>`
function trainingDrillNotesHtml(card:LevelUpCard){
 return `<h3>Tennis goal</h3><p>${html(card.tennisGoal)}</p><p>${html(card.useWhen)}</p><p>${html(card.reward)}</p>
  ${card.qualityChecks?.length?`<h3>Quality checks</h3><ul>${card.qualityChecks.map(check=>`<li>${html(check)}</li>`).join('')}</ul>`:''}
  ${card.commonMiss?`<p><strong>Watch for</strong> · ${html(card.commonMiss.miss)}<br><strong>Try</strong> · ${html(card.commonMiss.fix)}</p>`:''}
  ${card.proofAnchors?`<dl class="training-drill-proof"><dt>Low</dt><dd>${html(card.proofAnchors.low)}</dd><dt>Middle</dt><dd>${html(card.proofAnchors.mid)}</dd><dt>High</dt><dd>${html(card.proofAnchors.high)}</dd></dl>`:''}
  ${card.regression?`<p><strong>Make it easier</strong> · ${html(card.regression)}</p>`:''}
  ${card.progression?`<p><strong>Build on it</strong> · ${html(card.progression)}</p>`:''}`
}
export function trainingCardHtml(card:LevelUpCard){
 return trainingDrillOverviewHtml(card)+trainingSafetyHtml(card)+trainingRoutineHtml(card)+trainingDrillNotesHtml(card)
}
export function trainingModuleHtml(practiceModule:LevelUpModule,completed:ReadonlySet<string>=new Set()){const cards=practiceModule.cardIds.map(id=>LEVEL_UP_CARDS.find(c=>c.id===id));return `<h2>${html(practiceModule.title)}</h2><p>${html(practiceModule.subtitle)}</p><p>${html(practiceModule.durationLabel)} · ${html(practiceModule.level)}</p><p>${html(practiceModule.description)}</p>${practiceModule.useWhen?`<p>${html(practiceModule.useWhen)}</p>`:''}${practiceModule.sessionPlan?.length?`<h3>Your practice plan</h3><ol>${practiceModule.sessionPlan.map(step=>`<li>${html(step)}</li>`).join('')}</ol>`:''}<h3>What to notice</h3><p>${html(practiceModule.proof)}</p>${practiceModule.successCriteria?`<p>${html(practiceModule.successCriteria)}</p>`:''}<h3>Train in this order</h3><p>${practiceModule.cardIds.filter(id=>completed.has(id)).length} of ${practiceModule.cardIds.length} cards saved during this visit.</p><ol>${cards.map(c=>c?`<li><h3>${html(c.title)}</h3>${completed.has(c.id)?'<p>Saved during this visit</p>':''}<p>${c.durationMinutes} min · ${html(c.tennisGoal)}</p><button type="button" class="secondary" data-card="${html(c.id)}">Open training<span class="sr-only"> ${html(c.title)}</span></button></li>`:'<li>This training card is unavailable.</li>').join('')}</ol><p>Save each completed card to your account. These checkmarks reset when you close Level Up. Saved sessions stay in Your progress; module completion is not stored.</p>`}
const historyContextLabels:Record<string,string>={alone:'Solo',partner:'With a partner',singles:'Singles',doubles:'Doubles',coach:'With a coach'}
export function trainingHistoryHtml(rows:TrainingSession[],complete=true){
 if(!rows.length)return '<div class="training-history-empty"><h2>Your practice starts here</h2><p>Save a completed drill to start your training history.</p></div>'
 const progress=trainingProgress(rows)
 const hours=Math.floor(progress.seconds/3600)
 const timedWork=hours?`${hours}h ${trainingTime(progress.seconds%3600)}`:trainingTime(progress.seconds)
 return `<div class="training-history-overview">
  <dl aria-label="Practice totals">
   <div><dt>Saved sessions</dt><dd>${progress.count}</dd></div>
   <div><dt>Timed practice</dt><dd>${timedWork}</dd></div>
  </dl>
  ${!complete?'<p>Showing confirmed saves. Refresh account progress to load your other records.</p>':rows.length===80?'<p>Showing the latest 80 saved sessions.</p>':''}
 </div>
 <ol class="training-history-list" role="list">
  ${rows.map((row,index)=>`<li class="training-history-item${index===0?' training-history-latest':''}">
   <div class="training-history-meta">
    ${index===0?`<small class="stat-eyebrow">${complete?'Latest session':'Confirmed session'}</small>`:''}
    <time datetime="${html(row.completedAt)}">${html(new Date(row.completedAt).toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}))}</time>
   </div>
   <h2>${html(row.drillTitle)}</h2>
   ${row.focusTitle!==row.drillTitle?`<p>${html(row.focusTitle)}</p>`:''}
   <dl class="training-history-results">
    <div><dt>Self-rated proof</dt><dd>${row.rating} / 5</dd></div>
    <div><dt>Time</dt><dd>${trainingTime(row.elapsedSeconds)}</dd></div>
   </dl>
   <p class="training-history-context">${html(historyContextLabels[row.context]??row.context)} · Felt ${html(row.feeling)}${row.sharedWithCoach?' · Shared with coach':''}</p>
   ${row.identitySlug?`<p class="training-history-context">${html(trainingIdentity(row.identitySlug)?.title||row.identitySlug)}</p>`:''}
   ${row.note?`<div class="training-history-note"><strong>Your note</strong><p class="training-note">${html(row.note)}</p></div>`:''}
  </li>`).join('')}
 </ol>`
}
type TrainingStart='catalog'|'progress'|'inbox'
 |{view:'weeks';planId?:string}
 |{view:'coach';assignmentId?:string;onClose:(work:TrainingCoachWork|null)=>void}

export function openLevelUp(client:SupabaseClient,owner:string,current:()=>boolean,initial:TrainingStart='catalog',launch?:{cardId:string;identitySlug:string}){
 const previous=document.activeElement instanceof HTMLElement?document.activeElement:null,dialog=document.createElement('dialog');dialog.className='captain-lineup-dialog training-dialog';dialog.setAttribute('aria-label','Level Up training')
 const requestedPlanId=typeof initial==='object'&&initial.view==='weeks'?initial.planId:undefined
 const coachStart=typeof initial==='object'&&initial.view==='coach'?initial:undefined
 let requestedAssignmentId=coachStart?.assignmentId
 let disposed=false,version=0,historyVersion=0,phase:'inbox'|'plan'|'catalog'|'modules'|'module'|'card'|'session'|'progress'=typeof initial==='object'?'inbox':initial,practiceModule:LevelUpModule|null=null,selected:LevelUpCard|null=null,allowed:boolean|null=null,accessError=false,history:TrainingSession[]|null=null,historyError=false,historyComplete=false,historyBusy=false,accessBusy=false,saving=false,checking=false,confirming=false,notice='',query='',setting='',instructionsOpen=false,sessionScroll=0,rating='',note='',context='alone',feeling='ready',payload:Readonly<TrainingSave>|null=null
 let choices=(()=>{try{return loadTrainingChoices(owner,window.localStorage)}catch{return emptyTrainingChoices()}})(),choiceStored=true,cardFromPlan=false
 if(initial==='catalog'&&choices.active)phase='plan'
 let plans:WeeklyLevelUpPlan[]|null=null,coachWork:TrainingCoachWork|null|undefined,plansBusy=false,coachBusy=false,plansError=false,coachError=false,inboxLoaded=false,cardFromInbox=false,sessionDirection=choices.active,sessionOrigin=''
 let inboxSection:'coach'|'weeks'=typeof initial==='object'?initial.view:'coach'
 let inboxReturnCard=''
 const openInboxFolds=new Set<string>()
 if(initial==='catalog'&&launch){selected=LEVEL_UP_CARDS.find(c=>c.id===launch.cardId)||null;phase=selected?'card':'catalog';if(selected)sessionDirection=trainingIdentity(launch.identitySlug)?launch.identitySlug:choices.active}
 let replyEditor:ReturnType<typeof openWeeklyCoachReply>|null=null
 let coachEditor:ReturnType<typeof openCoachCheckIn>|null=null
 let practiceCalendar:ReturnType<typeof openCalendar>|null=null
 let weekPending:WeeklyChange|null=null,weekBusy=false,weekAttempted=false,weekConflict=false,weekLeaving=false,weekNotice='',plansVersion=0,coachVersion=0
 let pausedInBackground=false
 const completed=new Set<string>(),clock=new TrainingClock(),active=()=>!disposed&&current()
 const dispose=()=>{
  if(disposed)return
  disposed=true;replyEditor?.dispose();replyEditor=null;coachEditor?.dispose();coachEditor=null;practiceCalendar?.dispose();practiceCalendar=null
  version++;plansVersion++;coachVersion++;weekPending=null;clock.pause();payload=null;selected=null;practiceModule=null;choices=emptyTrainingChoices()
  const lastCoachWork=coachWork
  plans=null;coachWork=null;sessionOrigin='';sessionDirection='';completed.clear();history=null;note=''
  clearInterval(tick);document.removeEventListener('visibilitychange',visibility);dialog.remove()
  if(current()){
   if(previous?.isConnected)previous.focus({preventScroll:true})
   if(lastCoachWork!==undefined)coachStart?.onClose(lastCoachWork)
  }
 }
 const requestClose=()=>{if(replyEditor?.isOpen()){replyEditor.back();return}if(coachEditor?.isOpen()){coachEditor.back();return}if(practiceCalendar?.isOpen()){practiceCalendar.back();return}if(weekBusy){weekNotice='Wait for this request to finish before closing.';render();return}if(weekPending&&weekAttempted){weekLeaving=true;render();return}if(saving||checking){notice='Wait for this request to finish before closing.';render();return}if(phase==='session'){sessionScroll=dialog.scrollTop;clock.pause();confirming=true;render();dialog.querySelector<HTMLElement>('[data-keep]')?.focus();return}dispose()}
 const accessCopy=()=>allowed===true?'Self-guided training saves privately to your account.':allowed===false?`${MEMBERSHIP_TIERS.player_plus.name} access is required to save self-guided training. You can still read the cards and your account history.`:accessError?'Account access could not be checked.':'Checking your player access…'
 const catalogue=()=>{const matches=trainingSelection(LEVEL_UP_CARDS,query,setting);return `<p>${matches.length} training cards match. Showing ${Math.min(24,matches.length)}; narrow your search for more.</p><ul class="matches">${matches.slice(0,24).map(c=>`<li><h3>${html(c.title)}</h3><p>${c.durationMinutes} min · ${html(c.pack)} · ${html(c.intensity)} intensity</p><p>${html(c.tennisGoal)}</p><button type="button" class="secondary" data-card="${html(c.id)}">Open training<span class="sr-only"> ${html(c.title)}</span></button></li>`).join('')}</ul>`}
 const bindCards=()=>dialog.querySelectorAll<HTMLButtonElement>('[data-card]').forEach(b=>{b.onclick=()=>{selected=LEVEL_UP_CARDS.find(c=>c.id===b.dataset.card)||null;if(!selected)return;cardFromPlan=phase==='plan';cardFromInbox=false;sessionDirection=choices.active;sessionOrigin='';phase='card';notice='';render();focus()}})
 const focus=()=>dialog.querySelector<HTMLElement>('h1')?.focus()
 const findInboxCard=(key:string)=>Array.from(dialog.querySelectorAll<HTMLButtonElement>('[data-inbox-card]'))
  .find(button=>button.dataset.inboxCard===key&&button.getClientRects().length>0)
 const focusInboxReturn=()=>{
  const button=inboxReturnCard?findInboxCard(inboxReturnCard):undefined
  inboxReturnCard=''
  if(!button){focus();return}
  button.scrollIntoView({block:'nearest'})
  button.focus({preventScroll:true})
 }
 const weekFocusTarget=(id:string,markKey?:string)=>{
  const week=Array.from(dialog.querySelectorAll<HTMLElement>('[data-week-plan]')).find(section=>section.dataset.weekPlan===id)
  const target=markKey
   ?Array.from(week?.querySelectorAll<HTMLButtonElement>('[data-week-mark]')??[]).find(button=>button.dataset.weekMark===markKey)
   :week?.querySelector<HTMLElement>('.training-week-rep-next h3')??week?.querySelector<HTMLElement>('h2')
  return target?.getClientRects().length?target:undefined
 }
 const focusSavedWeek=(id:string,markKey?:string)=>{
  const target=weekFocusTarget(id,markKey)
  if(!target){focus();return}
  target.scrollIntoView({block:'nearest'})
  target.focus({preventScroll:true})
 }
 const trainingViews=()=>`<div class="match-filters training-views" role="group" aria-label="Training views"><button type="button" class="secondary" data-plan aria-pressed="${phase==='plan'}">Your direction</button><button type="button" class="secondary" data-catalog aria-pressed="${phase==='catalog'||phase==='card'}">Training cards</button><button type="button" class="secondary" data-modules aria-pressed="${phase==='modules'||phase==='module'}">Practice modules</button><button type="button" class="secondary" data-progress aria-pressed="${phase==='progress'}">Your progress</button></div>`
 const trainingAccessHtml=()=>`<p>${html(accessCopy())}</p>${accessError?`<button type="button" class="secondary" data-access ${accessBusy?'disabled':''}>Retry player access</button>`:''}`
 const progressScreenHtml=()=>`<header class="training-inbox-header">
  <h1 tabindex="-1" data-progress-control="title">Training progress</h1><button type="button" class="secondary" data-close data-progress-control="close" aria-label="Close Level Up">Close</button>
 </header>
 <div class="training-history-toolbar">
  <small class="stat-eyebrow">Your practice log</small>
  <button type="button" class="secondary" data-history data-progress-control="refresh" aria-label="Refresh account progress" aria-disabled="${historyBusy}">Refresh</button>
 </div>
 <p role="status" data-notice>${html(notice)}</p>
 ${historyBusy?`<p role="status">${history?'Refreshing your practice log…':'Loading your practice log…'}</p>`:''}
 ${historyError?`<p role="alert">${history?.length?'Showing your last loaded sessions. Refresh to try again.':'Training history is unavailable. Refresh to try again.'}</p>`:''}
 ${history&&(!historyError||history.length)?trainingHistoryHtml(history,historyComplete):''}
 <details class="training-inbox-fold" data-inbox-fold="progress-tools"><summary data-progress-control="tools">More training tools</summary>
  ${trainingAccessHtml()}${trainingViews()}
  <button type="button" class="secondary" data-inbox>Weekly plans and coach work</button>
 </details>`
 const drillScreenHtml=(card:LevelUpCard)=>{
  const back=cardFromInbox?['inbox','Back to training inbox']:cardFromPlan?['plan','Back to your direction']:practiceModule?['module-back','Back to practice module']:['catalog','Back to training cards']
  return `<header class="training-drill-header"><h1 tabindex="-1">Practice drill</h1><button type="button" class="secondary" data-close aria-label="Close Level Up">Close</button></header>
   <div class="training-drill-body" data-training-drill-body>
    <button type="button" class="secondary" data-${back[0]}>${back[1]}</button>
    ${trainingDrillOverviewHtml(card)}
    ${trainingSafetyHtml(card)}
    ${trainingRoutineHtml(card)}
    <details class="training-inbox-fold" data-drill-fold="notes"><summary>Coaching notes &amp; proof</summary>${trainingDrillNotesHtml(card)}</details>
    <p role="status" data-notice>${html(notice)}</p>
    <details class="training-inbox-fold" data-drill-fold="tools"><summary>More training tools</summary>
     ${trainingViews()}
     ${cardFromInbox?'':'<button type="button" class="secondary" data-inbox>Weekly plans and coach work</button>'}
    </details>
   </div>
   <footer class="training-drill-footer">
    ${allowed===true?'':trainingAccessHtml()}
    <button type="button" data-start ${allowed!==true?'disabled':''}>Start training</button>
   </footer>`
 }
 const timerHint=()=>pausedInBackground?'Paused while the app was in the background.':'The timer pauses in the background. Up to two hours per session.'
 const timerAction=()=>clock.running()?'Pause timer':'Resume timer'
 const paintSessionClock=()=>{
  const elapsed=dialog.querySelector<HTMLElement>('[data-clock]')
  if(!elapsed)return
  const time=trainingClockText(clock.seconds())
  if(elapsed.textContent!==time)elapsed.textContent=time
 }
 const paintTimerControls=()=>{
  paintSessionClock()
  const state=dialog.querySelector<HTMLElement>('[data-clock-state]')
  if(state){
   state.textContent=clock.running()?'Running':'Paused'
   state.toggleAttribute('data-clock-running',clock.running())
  }
  const control=dialog.querySelector<HTMLButtonElement>('[data-timer]')
  if(control)control.textContent=timerAction()
  const hint=dialog.querySelector<HTMLElement>('[data-timer-hint]')
  if(hint)hint.textContent=timerHint()
 }
 const sessionScreenHtml=(card:LevelUpCard,locked:boolean)=>`
  <header class="training-inbox-header">
   <h1 tabindex="-1">Training session</h1>
   <button type="button" class="secondary" data-close aria-label="Close Level Up" ${saving||checking?'disabled':''}>Close</button>
  </header>
  <section class="training-session-clock" aria-label="Training timer">
   <div class="training-session-clock-head">
    <small class="stat-eyebrow">Elapsed time</small>
    <span data-clock-state aria-live="polite" ${clock.running()?'data-clock-running':''}>${clock.running()?'Running':'Paused'}</span>
   </div>
   <h2>${html(card.title)}</h2>
   <p role="timer" data-clock>${trainingClockText(clock.seconds())}</p>
   <button type="button" class="secondary" data-timer ${locked?'disabled':''}>${timerAction()}</button>
   <p data-timer-hint>${timerHint()}</p>
  </section>
  ${trainingCueHtml(card)}
  ${trainingSafetyHtml(card)}
  <p class="training-session-track"><strong>Track</strong> ${html(card.proof)}</p>
  <details class="training-inbox-fold" data-instructions ${instructionsOpen?'open':''}>
   <summary>Review training instructions</summary>
   ${trainingCardHtml(card)}
  </details>
  <section class="training-session-log">
   <h2>Log your session</h2>
   <p>${sessionOrigin?`Private practice from ${html(sessionOrigin)}.`:'Save your proof to your private training history.'}</p>
   ${sessionDirection?`<p>Training direction · ${html(trainingIdentity(sessionDirection)?.title||'')}</p>`:''}
   <form data-proof>
    <label>Self-rated proof (0–5)<select name="rating" required ${locked?'disabled':''}>
     <option value="">Choose a proof rating</option>
     ${[0,1,2,3,4,5].map(value=>`<option value="${value}" ${String(value)===rating?'selected':''}>${value} / 5</option>`).join('')}
    </select></label>
    <label>Training context<select name="context" ${locked?'disabled':''}>
     ${trainingContexts(card).map(value=>`<option value="${value}" ${value===context?'selected':''}>${value}</option>`).join('')}
    </select></label>
    <label>How did you feel?<select name="feeling" ${locked?'disabled':''}>
     ${['ready','tight','tired','nervous'].map(value=>`<option value="${value}" ${value===feeling?'selected':''}>${value}</option>`).join('')}
    </select></label>
    <label>Your training note<textarea name="note" maxlength="700" rows="3" ${locked?'disabled':''}></textarea></label>
    <p role="status" tabindex="-1" data-notice>${html(notice)}</p>
    ${payload?`<button type="button" data-check ${saving||checking?'disabled':''}>Check whether this session saved</button>`:''}
    <button type="submit" ${payload?'class="secondary"':''} ${saving||checking?'disabled':''}>${saving?'Saving…':payload?'Retry same session':'Save completed session'}</button>
   </form>
  </section>`
 const inboxHtml=()=>`
  <header class="training-inbox-header"><h1 tabindex="-1">Training inbox</h1><button type="button" class="secondary" data-close aria-label="Close Level Up">Close</button></header>
  <div class="match-filters training-inbox-tabs" role="group" aria-label="Training inbox sections">
   <button type="button" class="secondary" data-inbox-section="coach" aria-controls="training-inbox-coach" aria-pressed="${inboxSection==='coach'}">Coach assignments</button>
   <button type="button" class="secondary" data-inbox-section="weeks" aria-controls="training-inbox-weeks" aria-pressed="${inboxSection==='weeks'}">Saved weeks</button>
  </div>
  <p role="status" data-notice>${html(notice)}</p>
  <div role="region" aria-label="Coach assignments" tabindex="-1" id="training-inbox-coach" data-inbox-region="coach" ${inboxSection==='coach'?'':'hidden'}>
   ${coachBusy?'<p role="status">Loading coach assignments…</p>':coachError?'<p role="alert">Coach assignments couldn’t load. Try refreshing.</p>':coachWork?trainingCoachWorkHtml(coachWork,new Date(),requestedAssignmentId):''}
   <button type="button" class="secondary" data-coach-refresh ${coachBusy?'disabled':''}>Refresh coach work</button>
   <button type="button" class="secondary" data-training-web="coach">Coach check-ins on website</button>
  </div>
  <div role="region" aria-label="Saved weekly plans" tabindex="-1" id="training-inbox-weeks" data-inbox-region="weeks" ${inboxSection==='weeks'?'':'hidden'}>
   ${plansBusy?'<p role="status">Loading saved weekly plans…</p>':plansError?'<p role="alert">Saved weeks couldn’t load. Try refreshing.</p>':plans?trainingPlansHtml(plans,allowed===true||Boolean(coachWork?.links.some(l=>l.status!=='paused')),requestedPlanId):''}
   <button type="button" class="secondary" data-plan-refresh ${plansBusy?'disabled':''}>Refresh saved weeks</button>
   <button type="button" class="secondary" data-training-web="weekly">Manage saved weeks on website</button>
  </div>
  <details class="training-inbox-fold" data-inbox-fold="tools"><summary>Training tools</summary>${trainingAccessHtml()}${trainingViews()}</details>`
 const render=()=>{if(!active())return
  dialog.classList.toggle('training-inbox-screen',phase==='inbox'&&!weekPending)
  dialog.classList.toggle('training-week-change-screen',Boolean(weekPending))
  dialog.classList.toggle('training-drill-screen',phase==='card'&&Boolean(selected))
  dialog.classList.toggle('training-session-screen',phase==='session'&&!confirming&&Boolean(selected))
  dialog.classList.toggle('training-progress-screen',phase==='progress')
  if(weekPending){renderWeekChange();return}
  if(confirming){dialog.innerHTML=`<h1 tabindex="-1">Leave this session?</h1><p>${payload?'The save may already be recorded. Check account progress before starting it again.':'Your timer and unsaved training notes will be discarded.'}</p><button type="button" class="secondary" data-keep>Keep training</button><button type="button" data-discard>Discard and close</button>`;dialog.querySelector<HTMLButtonElement>('[data-keep]')!.onclick=()=>{confirming=false;render();dialog.scrollTop=sessionScroll;dialog.querySelector<HTMLElement>('[name=note]')?.focus({preventScroll:true})};dialog.querySelector<HTMLButtonElement>('[data-discard]')!.onclick=dispose;return}
  const frozen=Boolean(payload),locked=frozen||saving||checking
  const focusedInboxSection=dialog.querySelector<HTMLElement>('[data-inbox-section]:focus')?.dataset.inboxSection
  const focusedInboxCard=dialog.querySelector<HTMLElement>('[data-inbox-card]:focus')?.dataset.inboxCard
  const focusedWeekControl=dialog.querySelector<HTMLElement>('[data-week-plan] :is(h2,.training-week-rep-next h3,[data-week-mark]):focus')
  const focusedWeekId=focusedWeekControl?.closest<HTMLElement>('[data-week-plan]')?.dataset.weekPlan
  const focusedProgressControl=dialog.querySelector<HTMLElement>('[data-progress-control]:focus')?.dataset.progressControl
  const previousDrill=dialog.querySelector<HTMLElement>('[data-training-drill-body]')
  const drillScroll=previousDrill?.scrollTop??0
  const openDrillFolds=Array.from(previousDrill?.querySelectorAll<HTMLDetailsElement>('[data-drill-fold][open]')??[],fold=>fold.dataset.drillFold)
  dialog.innerHTML=phase==='inbox'?inboxHtml():phase==='progress'?progressScreenHtml():phase==='card'&&selected?drillScreenHtml(selected):phase==='session'&&selected?sessionScreenHtml(selected,locked):`<h1 tabindex="-1">Level Up</h1>${trainingAccessHtml()}${trainingViews()}<button type="button" class="secondary" data-inbox>Weekly plans and coach work</button>${phase==='plan'?`${trainingPlanHtml(choices,choiceStored,allowed===true)}${!choiceStored?'<p role="alert">This choice is available for this visit only. Device storage is unavailable.</p>':''}`:phase==='modules'?`<h2>Build a complete practice block</h2><p>Choose a focused block for your serve, movement or match readiness.</p><ul class="matches">${LEVEL_UP_MODULES.map(m=>`<li><h3>${html(m.title)}</h3><p>${html(m.durationLabel)} · ${html(m.subtitle)}</p><p>${html(m.description)}</p><button type="button" class="secondary" data-module="${html(m.id)}">Open module<span class="sr-only"> ${html(m.title)}</span></button></li>`).join('')}</ul>`:phase==='module'&&practiceModule?trainingModuleHtml(practiceModule,completed):phase==='catalog'?`<label>Find a training focus<input type="search" maxlength="80" data-search value="${html(query)}" placeholder="Serve, doubles, movement…"></label><label>Where are you training?<select data-setting><option value="">Any setting</option>${['home','driveway','garage','court','wall','gym','match-day'].map(s=>`<option value="${s}" ${s===setting?'selected':''}>${s}</option>`).join('')}</select></label><div data-cards>${catalogue()}</div>`:''}<p role="status" data-notice>${html(notice)}</p><button type="button" class="secondary" data-close ${saving||checking?'disabled':''}>Close Level Up</button>`
  const drillBody=dialog.querySelector<HTMLElement>('[data-training-drill-body]')
  if(drillBody&&previousDrill){
   drillBody.querySelectorAll<HTMLDetailsElement>('[data-drill-fold]').forEach(fold=>{fold.open=openDrillFolds.includes(fold.dataset.drillFold)})
   drillBody.scrollTop=drillScroll
  }
  dialog.querySelector<HTMLButtonElement>('[data-close]')!.onclick=requestClose
  dialog.querySelectorAll<HTMLDetailsElement>('details[data-inbox-fold]').forEach(fold=>{
   const key=fold.dataset.inboxFold!
   fold.open=openInboxFolds.has(key)
   fold.ontoggle=()=>{if(!fold.isConnected)return;if(fold.open)openInboxFolds.add(key);else openInboxFolds.delete(key)}
  })
  if(focusedInboxSection)dialog.querySelector<HTMLElement>(`[data-inbox-section="${focusedInboxSection}"]`)?.focus({preventScroll:true})
  if(focusedInboxCard)findInboxCard(focusedInboxCard)?.focus({preventScroll:true})
  if(focusedWeekId)weekFocusTarget(focusedWeekId,focusedWeekControl?.dataset.weekMark)?.focus({preventScroll:true})
  if(focusedProgressControl)dialog.querySelector<HTMLElement>(`[data-progress-control="${focusedProgressControl}"]`)?.focus({preventScroll:true})
  dialog.querySelector<HTMLButtonElement>('[data-access]')?.addEventListener('click',()=>{void readAccess()})
  dialog.querySelectorAll<HTMLButtonElement>('[data-catalog]').forEach(b=>{b.onclick=()=>{phase='catalog';practiceModule=null;notice='';render();focus()}})
  dialog.querySelector<HTMLButtonElement>('[data-progress]')?.addEventListener('click',()=>{phase='progress';notice='';render();focus()})
  dialog.querySelector<HTMLButtonElement>('[data-history]')?.addEventListener('click',()=>{void readHistory()})
  dialog.querySelector<HTMLButtonElement>('[data-modules]')?.addEventListener('click',()=>{phase='modules';practiceModule=null;notice='';render();focus()})
  dialog.querySelector<HTMLButtonElement>('[data-module-back]')?.addEventListener('click',()=>{phase='module';notice='';render();focus()})
  dialog.querySelectorAll<HTMLButtonElement>('[data-module]').forEach(b=>{b.onclick=()=>{practiceModule=LEVEL_UP_MODULES.find(m=>m.id===b.dataset.module)||null;if(!practiceModule)return;phase='module';notice='';render();focus()}})
  dialog.querySelectorAll<HTMLButtonElement>('[data-plan]').forEach(b=>{b.onclick=()=>{phase='plan';practiceModule=null;notice='';render();focus()}})
  const identityForm=dialog.querySelector<HTMLFormElement>('[data-identity]');if(identityForm)identityForm.onsubmit=e=>{e.preventDefault();if(!active())return;const kind=(e.submitter as HTMLButtonElement|null)?.value;if(kind!=='style'&&kind!=='focus')return;try{choices=chooseTrainingIdentity(choices,String(new FormData(identityForm).get(kind)||''));try{choiceStored=saveTrainingChoices(owner,choices,window.localStorage)}catch{choiceStored=false}notice='Training direction updated. Your tennis rating is unchanged.'}catch{notice='Choose a '+kind+' before applying it.'}render();focus()}
  dialog.querySelector<HTMLButtonElement>('[data-clear-identity]')?.addEventListener('click',()=>{if(!active())return;choices=emptyTrainingChoices();try{choiceStored=saveTrainingChoices(owner,choices,window.localStorage)}catch{choiceStored=false}notice='Training choices cleared for this visit. Saved sessions are unchanged.';render();focus()})
  dialog.querySelectorAll<HTMLButtonElement>('[data-inbox]').forEach(button=>{button.onclick=()=>{
   const returning=phase==='card'&&cardFromInbox
   phase='inbox';practiceModule=null;notice='';render()
   if(returning)focusInboxReturn();else{inboxReturnCard='';focus()}
   if(!inboxLoaded){inboxLoaded=true;void readPlans();void readCoach()}
  }})
  dialog.querySelector<HTMLButtonElement>('[data-plan-refresh]')?.addEventListener('click',()=>{void readPlans()})
  dialog.querySelector<HTMLButtonElement>('[data-coach-refresh]')?.addEventListener('click',()=>{void readCoach()})
  const schedule=dialog.querySelector<HTMLButtonElement>('[data-week-schedule]')
  if(schedule)schedule.onclick=()=>{
   const {weekSchedule,scheduleTitle}=schedule.dataset
   if(!active()||practiceCalendar?.isOpen()||!scheduleTitle)return
   practiceCalendar=openCalendar(client,owner,active,undefined,{practiceTitle:scheduleTitle,onClose:()=>{
    practiceCalendar=null
    const button=dialog.querySelector<HTMLButtonElement>('[data-week-schedule]')
    if(button&&button.dataset.weekSchedule===weekSchedule)button.focus({preventScroll:true})
    else focus()
   }})
  }
  dialog.querySelectorAll<HTMLButtonElement>('[data-inbox-card]').forEach(button=>{button.onclick=()=>{
   if(!active())return
   const launch=trainingInboxLaunches(plans||[],coachWork??null).find(item=>item.key===button.dataset.inboxCard)
   if(!launch)return
   selected=LEVEL_UP_CARDS.find(card=>card.id===launch.cardId)||null
   if(!selected)return
   inboxReturnCard=launch.key;practiceModule=null;cardFromPlan=false;cardFromInbox=true
   sessionDirection=trainingIdentity(launch.identitySlug)?launch.identitySlug:choices.active
   sessionOrigin=launch.label;phase='card';notice='This is private self-guided practice. Your plan and assignment status stay unchanged.';render();focus()
  }})
  dialog.querySelectorAll<HTMLButtonElement>('[data-training-web]').forEach(b=>{b.onclick=async()=>{if(!active())return;const path=b.dataset.trainingWeb==='weekly'?'/level-up/my-quest':b.dataset.trainingWeb==='coach'?'/mylab#coach-assignments':null;if(!path)return;b.disabled=true;try{await Browser.open({url:'https://www.tenaceiq.com'+path})}catch{if(active()){notice='The website could not be opened. Try again when your connection is ready.';render()}}finally{if(active()&&b.isConnected)b.disabled=false}}})
  const sections=dialog.querySelectorAll<HTMLButtonElement>('[data-inbox-section]')
  const regions=dialog.querySelectorAll<HTMLElement>('[data-inbox-region]')
  sections.forEach(button=>{button.onclick=()=>{
   inboxSection=button.dataset.inboxSection==='weeks'?'weeks':'coach'
   sections.forEach(section=>section.setAttribute('aria-pressed',String(section===button)))
   regions.forEach(region=>region.hidden=region.dataset.inboxRegion!==inboxSection)
   button.focus({preventScroll:true})
  }})
  dialog.querySelector<HTMLButtonElement>('[data-week-create]')?.addEventListener('click',()=>{if(!active()||allowed!==true)return;try{weekPending=newWeeklyChange(choices.active);weekAttempted=false;weekConflict=false;weekNotice='';render();focus()}catch{notice='Choose a training direction before creating your week.';render()}})
  dialog.querySelectorAll<HTMLButtonElement>('[data-week-reply]').forEach(b=>{b.onclick=()=>{if(!active()||replyEditor?.isOpen())return;const plan=plans?.find(p=>p.id===b.dataset.weekReply);if(!plan)return;replyEditor=openWeeklyCoachReply(client,owner,active,plan,saved=>{notice=saved?'Your reply is saved with this week.':'Review your latest coach update below.';plansVersion++;plansBusy=false;void readPlans().then(()=>{if(active()){const region=dialog.querySelector<HTMLElement>('[data-inbox-region=weeks]');region?.scrollIntoView({block:'start'});region?.focus({preventScroll:true})}})})}})
  dialog.querySelectorAll<HTMLButtonElement>('[data-coach-checkin]').forEach(button=>{button.onclick=()=>{
   if(!active()||coachEditor?.isOpen())return
   const assignment=coachWork?.assignments.find(a=>a.id===button.dataset.coachCheckin),link=coachWork?.links.find(l=>l.id===assignment?.studentLinkId)
   if(!assignment||!link)return
   button.focus({preventScroll:true})
   coachEditor=openCoachCheckIn(client,owner,active,assignment,link,saved=>{
    if(requestedAssignmentId===assignment.id)requestedAssignmentId=undefined
    notice=saved?'Check-in sent to your coach.':'Review your latest coach assignments.';coachVersion++;coachBusy=false;coachWork=null
    void readCoach().then(()=>{if(active()&&phase==='inbox'&&inboxSection==='coach')dialog.querySelector<HTMLElement>('[data-inbox-region="coach"]')?.focus()})
   })
  }})
  dialog.querySelectorAll<HTMLButtonElement>('[data-week-mark]').forEach(b=>{b.onclick=()=>{if(!active())return;try{const [planId,repId]=JSON.parse(b.dataset.weekMark||'[]') as string[],plan=plans?.find(p=>p.id===planId);if(!plan)return;weekPending=completionWeeklyChange(plan,repId,b.dataset.weekCompleted==='true');weekAttempted=false;weekConflict=false;weekNotice='';render();focus()}catch{notice='Refresh saved weeks before changing a rep.';render()}}})
  const search=dialog.querySelector<HTMLInputElement>('[data-search]'),settingSelect=dialog.querySelector<HTMLSelectElement>('[data-setting]');const filter=()=>{dialog.querySelector<HTMLElement>('[data-cards]')!.innerHTML=catalogue();bindCards()};if(search)search.oninput=()=>{query=search.value;filter()};if(settingSelect)settingSelect.onchange=()=>{setting=settingSelect.value;filter()};bindCards()
  dialog.querySelector<HTMLButtonElement>('[data-start]')?.addEventListener('click',()=>{
   if(allowed!==true||!selected)return
   phase='session';instructionsOpen=false;pausedInBackground=false
   context=initialTrainingContext(selected);rating='';note='';feeling='ready'
   clock.reset();clock.start();notice='';render();focus()
  })
  const timerButton=dialog.querySelector<HTMLButtonElement>('[data-timer]')
  timerButton?.addEventListener('click',()=>{
   if(clock.running())clock.pause()
   else clock.start()
   pausedInBackground=false;paintTimerControls()
   timerButton.focus({preventScroll:true})
  })
  const instructions=dialog.querySelector<HTMLDetailsElement>('[data-instructions]');if(instructions)instructions.ontoggle=()=>{instructionsOpen=instructions.open}
  const form=dialog.querySelector<HTMLFormElement>('[data-proof]')
  if(form){
   form.querySelector<HTMLTextAreaElement>('[name=note]')!.value=note
   form.oninput=()=>{
    if(payload)return
    const fields=new FormData(form)
    rating=String(fields.get('rating')||'');note=String(fields.get('note')||'')
    context=String(fields.get('context')||'alone');feeling=String(fields.get('feeling')||'ready')
   }
   form.onsubmit=event=>{event.preventDefault();void save()}
  }
  dialog.querySelector<HTMLButtonElement>('[data-check]')?.addEventListener('click',()=>{void checkSaved()})
 }
 const accepted=(row:TrainingSession)=>{if(practiceModule&&selected&&practiceModule.cardIds.includes(selected.id))completed.add(selected.id);historyVersion++;historyBusy=false;historyError=false;history=[row,...(history||[]).filter(r=>r.id!==row.id)].sort((a,b)=>Date.parse(b.completedAt)-Date.parse(a.completedAt)).slice(0,80);payload=null;selected=null;phase=practiceModule?'module':cardFromInbox?'inbox':cardFromPlan?'plan':'progress';notice='Session saved to your account. Your self-rated training proof is separate from your TIQ rating.';render();if(cardFromInbox)focusInboxReturn();else focus()}
 const showSessionStatus=()=>{
  render()
  dialog.querySelector<HTMLElement>('.training-session-log [data-notice]')?.focus()
 }
 const save=async()=>{
  if(!active()||saving||checking||!selected||allowed!==true)return
  try{
   if(!payload){
    if(rating==='')throw Error('Choose a proof rating.')
    clock.pause()
    payload=freezeTrainingSave(selected,Number(rating),note,context,feeling,clock.seconds(),'level-up-'+crypto.randomUUID(),new Date().toISOString(),sessionDirection)
   }
  }catch{
   payload=null;notice='Choose a proof rating from 0 to 5 before saving.';showSessionStatus();return
  }
  const frozen=payload,request=version
  saving=true;notice='Saving this completed session…';showSessionStatus()
  try{
   const row=await saveTrainingSession(client,owner,()=>active()&&version===request,frozen)
   if(active()&&version===request){saving=false;accepted(row)}
  }catch{
   if(!active()||version!==request)return
   saving=false;notice='Check whether this session saved before retrying.';showSessionStatus()
  }
 }
 const checkSaved=async()=>{
  if(!payload||saving||checking||!active())return
  const frozen=payload
  checking=true;notice='Checking account progress…';showSessionStatus()
  try{
   const rows=await loadTrainingHistory(client,owner,active)
   if(!active())return
   history=rows;historyComplete=true;historyError=false;checking=false
   const row=rows.find(item=>item.id===frozen.id)
   if(row&&confirmsTrainingSave(row,frozen)){accepted(row);return}
   notice='Retry the same session when your connection is ready.'
  }catch{
   if(!active())return
   checking=false;notice='Keep this session and check your progress when you’re connected.'
  }
  showSessionStatus()
 }
 const readAccess=async()=>{if(accessBusy||!active())return;accessBusy=true;accessError=false;render();try{const value=await trainingAccess(client,owner,active);if(active())allowed=value}catch{if(active()){allowed=null;accessError=true}}finally{if(active()){accessBusy=false;render()}}}
 const readHistory=async()=>{
  if(historyBusy||!active())return
  const request=++historyVersion
  historyBusy=true;historyError=false
  if(phase==='progress')render()
  try{
   const rows=await loadTrainingHistory(client,owner,active)
   if(active()&&request===historyVersion){history=rows;historyComplete=true}
  }catch{
   if(active()&&request===historyVersion)historyError=true
  }finally{
   if(active()&&request===historyVersion){
    historyBusy=false
    if(phase==='progress')render()
   }
  }
 }
 const readPlans=async()=>{if(plansBusy||!active())return;const request=++plansVersion;plansBusy=true;plansError=false;if(phase==='inbox')render();try{const rows=await loadTrainingPlans(client,owner,active);if(active()&&request===plansVersion)plans=rows}catch{if(active()&&request===plansVersion){plans=null;plansError=true}}finally{if(active()&&request===plansVersion){plansBusy=false;if(phase==='inbox')render()}}}
 const readCoach=async()=>{if(coachBusy||!active())return;const request=++coachVersion;coachBusy=true;coachError=false;if(phase==='inbox')render();try{const rows=await loadTrainingCoachWork(client,owner,active);if(active()&&request===coachVersion)coachWork=rows}catch{if(active()&&request===coachVersion){coachWork=null;coachError=true}}finally{if(active()&&request===coachVersion){coachBusy=false;if(phase==='inbox')render()}}}
 const finishWeekChange=(saved:WeeklyLevelUpPlan)=>{
  const change=weekPending
  if(!change)return
  const updatedPlans=change.kind==='completion'&&plans?.some(plan=>plan.id===saved.id)
   ?plans.map(plan=>plan.id===saved.id?saved:plan)
   :null
  if(updatedPlans)plans=updatedPlans
  notice=change.kind==='create'?'Your private weekly plan is saved.':change.completed?'Rep marked done.':'Rep reopened.'
  weekPending=null;weekBusy=false;weekAttempted=false;weekConflict=false;weekLeaving=false;weekNotice=''
  plansVersion++;plansBusy=false;phase='inbox';inboxSection='weeks';inboxLoaded=true
  render()
  if(updatedPlans)focusSavedWeek(saved.id)
  else {focus();void readPlans()}
  if(!coachWork&&!coachBusy)void readCoach()
 }
 const showWeekStatus=()=>{
  render()
  dialog.querySelector<HTMLElement>('[data-week-status]')?.focus()
 }
 const sendWeekChange=async()=>{
  if(!weekPending||weekBusy||!active()||weekConflict)return
  const frozen=weekPending
  weekBusy=true;weekAttempted=true;weekNotice='Saving your week…';showWeekStatus()
  try{
   const saved=await saveWeeklyChange(client,owner,active,frozen)
   if(active())finishWeekChange(saved)
  }catch(error){
   if(!active())return
   weekBusy=false;weekConflict=error instanceof WeeklyChangeError&&error.conflict
   weekNotice=weekConflict?'This week changed. Check the saved week before applying the change.':'Check whether your change saved before trying again.'
   showWeekStatus()
  }
 }
 const checkWeekChange=async()=>{
  if(!weekPending||weekBusy||!active())return
  const frozen=weekPending
  weekBusy=true;weekNotice='Checking the current saved week…';showWeekStatus()
  try{
   const found=await checkWeeklyChange(client,owner,active,frozen)
   if(!active())return
   if(found){finishWeekChange(found);return}
   weekNotice='Discard and refresh to review the latest saved week before trying again.'
  }catch{
   if(!active())return
   weekNotice='Keep this change and check the saved week when you’re connected.'
  }
  weekBusy=false;showWeekStatus()
 }
 const renderWeekChange=()=>{
  if(!weekPending||!active())return
  const change=weekPending
  const creating=change.kind==='create'
  const title=creating?'Create this week’s plan?':change.completed?'Mark this rep done?':'Reopen this rep?'
  const action=creating?'Save this week':change.completed?'Mark rep done':'Reopen rep'
  const week=`<time datetime="${html(change.plan.weekStart)}">${html(formatWeekdayDate(change.plan.weekStart))}</time>`
  dialog.innerHTML=`<header class="training-inbox-header week-change-header">
   <div><small class="stat-eyebrow">Saved weeks</small><h1 tabindex="-1">${weekLeaving?'Leave this plan change?':title}</h1></div>
   ${weekLeaving?'':`<button type="button" class="secondary" data-week-close aria-label="Close Level Up" ${weekBusy?'disabled':''}>Close</button>`}
  </header>
  ${weekLeaving?`
   <p>Your change may already be saved. Refresh your saved week to check before applying it again.</p>
   <div class="week-change-actions"><button type="button" data-week-keep>Keep this change</button><button type="button" class="secondary" data-week-leave>Discard and close</button></div>`:`
   <div class="week-change-summary">
    <small class="stat-eyebrow">Week of ${week}</small>
    <h2>${creating?'Your private plan':html(change.title)}</h2>
    ${creating?`<ol>${change.plan.reps.map(rep=>`<li>${html(rep.title)}</li>`).join('')}</ol>`:`<p>Status after saving <strong>${change.completed?'Complete':'Open'}</strong></p>`}
   </div>
   <p>${creating?'Save three recommended reps for this training direction.':change.plan.sharedWithCoach?'Your coach can see this rep’s updated status in the shared week.':'This updates your progress for the saved week.'}</p>
   <p class="week-change-status" data-week-status tabindex="-1" role="status">${html(weekNotice)}</p>
   <div class="week-change-actions">
    ${weekAttempted?`<button type="button" data-week-check ${weekBusy?'disabled':''}>Check current saved week</button>`:''}
    <button type="button" data-week-save ${weekAttempted?'class="secondary"':''} ${weekBusy||weekConflict?'disabled':''}>${weekBusy?'Working…':weekAttempted?'Retry same change':action}</button>
    <button type="button" class="secondary" data-week-cancel ${weekBusy?'disabled':''}>${weekAttempted?'Discard change and refresh':'Cancel change'}</button>
   </div>`}`
  dialog.querySelector('[data-week-save]')?.addEventListener('click',()=>{void sendWeekChange()})
  dialog.querySelector('[data-week-check]')?.addEventListener('click',()=>{void checkWeekChange()})
  dialog.querySelector('[data-week-close]')?.addEventListener('click',requestClose)
  dialog.querySelector('[data-week-keep]')?.addEventListener('click',()=>{weekLeaving=false;render();focus()})
  dialog.querySelector('[data-week-leave]')?.addEventListener('click',dispose)
  dialog.querySelector('[data-week-cancel]')?.addEventListener('click',()=>{
   const refresh=weekAttempted
   weekPending=null;weekAttempted=false;weekConflict=false;weekNotice=''
   if(refresh){
    phase='inbox';inboxSection='weeks';plansVersion++;plansBusy=false;render();void readPlans()
    if(!inboxLoaded){inboxLoaded=true;void readCoach()}
    focus()
   }else{
    render()
    if(change.kind==='completion')focusSavedWeek(change.plan.id,JSON.stringify([change.plan.id,change.repId]))
    else focus()
   }
  })
 }
 const visibility=()=>{
  if(document.visibilityState!=='hidden'||!clock.running())return
  clock.pause()
  if(active()){pausedInBackground=true;paintTimerControls()}
 }
 const tick=setInterval(()=>{if(!active()){dispose();return}paintSessionClock()},1000)
 document.addEventListener('visibilitychange',visibility);dialog.oncancel=e=>{e.preventDefault();if(confirming){confirming=false;render();dialog.scrollTop=sessionScroll;dialog.querySelector<HTMLElement>('[name=note]')?.focus({preventScroll:true})}else requestClose()};document.body.append(dialog);render();dialog.showModal();focus();void readAccess();void readHistory();if(phase==='inbox'){inboxLoaded=true;void readPlans();void readCoach()}return {dispose,isOpen:()=>!disposed,back:requestClose}
}
