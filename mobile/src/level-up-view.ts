import {openWeeklyCoachReply} from './weekly-coach-reply-view'
import {openCoachCheckIn} from './coach-check-in-view'
import {findCoachPracticeStats} from './coach-check-in'
import {newWeeklyChange,completionWeeklyChange,saveWeeklyChange,checkWeeklyChange,findSavedWeeklyPlan,weeklyChangeMatches,WeeklyChangeError,type WeeklyChange} from './weekly-plan-actions'
import {Browser} from './native-browser'
import {SAVED_WEEK_LIST_LIMIT,loadTrainingPlans,loadTrainingWeek,loadTrainingCoachWork,type TrainingCoachWork} from './training-inbox-data'
import {trainingPlansHtml,trainingCoachWorkHtml,trainingCoachCueHtml,trainingInboxLaunches,trainingWeekPracticeReceiptHtml,weeklyDrillKey,type SavedWeekPractice} from './training-inbox-view'
import {getWeeklyLevelUpPlanProgress,getWeeklyLevelUpPlanReps,type WeeklyLevelUpPlan} from '../../lib/level-up/weekly-plan'
import {calendarWeeklyRepKey,notifyCalendarWeeklyRepChange,readScheduledPracticeLinks,syncCalendarWeeklyRepProgress,type CalendarWeeklyRep} from './calendar-weekly-reps'
import {formatWeekdayDate} from '../../lib/captain-formatters'
import {openCalendar} from './calendar-view'
import {loadTrainingChoices,saveTrainingChoices,chooseTrainingIdentity,emptyTrainingChoices,trainingPlanHtml,trainingIdentity} from './training-identity'
import type {SupabaseClient} from '@supabase/supabase-js'
import {LEVEL_UP_CARDS,LEVEL_UP_MODULES} from '../../lib/level-up/level-up-cards'
import type {LevelUpCard,LevelUpModule} from '../../lib/level-up/level-up-types'
import {MEMBERSHIP_TIERS} from '../../lib/product-story'
import {html} from './match-details'
import {matchDate} from './recent-results'
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
export function trainingModuleHtml(practiceModule:LevelUpModule,completed:ReadonlySet<string>=new Set()){
 const cards=practiceModule.cardIds.map(id=>LEVEL_UP_CARDS.find(card=>card.id===id))
 const saved=cards.filter(card=>card&&completed.has(card.id)).length
 const next=cards.findIndex(card=>card&&!completed.has(card.id))
 const complete=saved>0&&saved===cards.length
 return `<div class="training-module-overview">
  <small class="stat-eyebrow">${html(practiceModule.durationLabel)} · ${html(practiceModule.level)}</small>
  <h2>${html(practiceModule.title)}</h2><p>${html(practiceModule.subtitle)}</p>
  <div class="training-module-progress">
   <strong${complete?' tabindex="-1" data-module-complete':''}>${complete?'Block complete':`${saved} of ${cards.length} drills saved`}</strong>
   <progress aria-label="Drills saved this visit" value="${saved}" max="${Math.max(1,cards.length)}"></progress>
   <p>Block progress resets on close. Sessions stay in Training Progress.</p>
   ${complete?'<button type="button" class="secondary" data-progress>View training progress</button>':''}
  </div>
 </div>
 <h2 class="training-module-order">Drill order</h2>
 <ol class="training-module-steps" role="list">${cards.map((card,index)=>{
  const isNext=index===next
  const isSaved=Boolean(card&&completed.has(card.id))
  return `<li${isNext?' class="training-module-next"':''}>
   <span class="training-module-step-number" aria-hidden="true">${index+1}</span>
   <div class="training-module-step-copy">${card?`
    ${isNext||isSaved?`<small class="stat-eyebrow">${isNext?'Up next':'Saved this visit'}</small>`:''}
    <h3>${html(card.title)}</h3>
    <p>${card.durationMinutes} min · ${html(card.tennisGoal)}</p>
    <button type="button" class="secondary" data-card="${html(card.id)}" ${isNext?'data-module-next':''}>${isNext?'Preview next drill':isSaved?'Preview again':'Preview drill'}<span class="sr-only"> ${html(card.title)}</span></button>`:'<p>This training card is unavailable.</p>'}</div>
  </li>`
 }).join('')}</ol>
 <details class="training-inbox-fold" data-inbox-fold="module-notes-${html(practiceModule.id)}"><summary>Practice notes</summary>
  <p>${html(practiceModule.description)}</p>
  ${practiceModule.useWhen?`<p>${html(practiceModule.useWhen)}</p>`:''}
  ${practiceModule.sessionPlan?.length?`<h3>Your practice plan</h3><ol>${practiceModule.sessionPlan.map(step=>`<li>${html(step)}</li>`).join('')}</ol>`:''}
  <h3>What to notice</h3><p>${html(practiceModule.proof)}</p>
  ${practiceModule.successCriteria?`<p>${html(practiceModule.successCriteria)}</p>`:''}
 </details>`
}
const historyContextLabels:Record<string,string>={alone:'Solo',partner:'With a partner',singles:'Singles',doubles:'Doubles',coach:'With a coach'}
const catalogSettings={home:'Home',driveway:'Driveway',garage:'Garage',court:'Court',wall:'Wall',gym:'Gym','match-day':'Match day'}
const catalogPageSize=24
const catalogCardsHtml=(cards:LevelUpCard[],limit:number)=>cards.length?`
 <ul class="training-catalog-list" role="list">${cards.slice(0,limit).map(card=>`<li>
  <button type="button" class="secondary training-catalog-card" data-card="${html(card.id)}" aria-labelledby="catalog-title-${html(card.id)}" aria-describedby="catalog-facts-${html(card.id)} catalog-goal-${html(card.id)}">
   <span class="training-catalog-card-title" id="catalog-title-${html(card.id)}"><span class="sr-only">Preview </span>${html(card.title)}</span>
   <span class="training-catalog-card-facts" id="catalog-facts-${html(card.id)}">
    <span class="training-catalog-time">${card.durationMinutes} min</span>
    <span>${html(card.intensity)} intensity · ${html(card.pack)}</span>
   </span>
   <span class="training-catalog-goal" id="catalog-goal-${html(card.id)}">${html(card.tennisGoal)}</span>
   <span class="training-catalog-arrow" aria-hidden="true">›</span>
  </button>
 </li>`).join('')}</ul>
 ${cards.length>limit?'<button type="button" class="secondary" data-catalog-more>Show more drills</button>':''}`
 :'<div class="training-catalog-empty"><h2>No matching drills</h2><p>Try a different search, practice setting, or time limit.</p></div>'
const trainingHistoryActionHtml=(card?:LevelUpCard)=>`<button type="button" class="secondary training-history-action" data-progress-control="next-drill" ${card?`data-card="${html(card.id)}"`:'data-catalog'}>${card?'Practice this drill again':'Browse training cards'}</button>`
export function trainingHistoryHtml(rows:TrainingSession[],complete=true){
 if(!rows.length)return `<div class="training-history-empty"><h2>Your practice starts here</h2><p>Save a completed drill to start your training history.</p>${trainingHistoryActionHtml()}</div>`
 const progress=trainingProgress(rows)
 const hours=Math.floor(progress.seconds/3600)
 const timedWork=hours?`${hours}h ${trainingTime(progress.seconds%3600)}`:trainingTime(progress.seconds)
 const lastCardId=rows[0].cardId||rows[0].focusId
 const lastCard=LEVEL_UP_CARDS.find(card=>card.id===lastCardId)
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
   ${index===0?trainingHistoryActionHtml(lastCard):''}
  </li>`).join('')}
 </ol>`
}
const scorecardFocusOptions = [
 {title:'Serve placement', cardId:'serve-target-ladder', target:'Hit the chosen serve target 6 times in 10 attempts.'},
 {title:'Return depth', cardId:'return-depth-lane', target:'Land 6 of 8 returns in the chosen lane and recover to ready.'},
 {title:'Rally consistency', cardId:'crosscourt-consistency', target:'Rally 8 crosscourt balls in a row with time to recover.'},
 {title:'Doubles first move', cardId:'doubles-return-first-move', target:'Follow the return and partner call on 6 of 8 points.', doublesOnly:true},
] as const
const matchTargetLimit = 160
const trainingNoteLimit = 700

type TrainingStart='catalog'|'progress'|'inbox'
 |{view:'weeks';planId?:string;calendarRep?:CalendarWeeklyRep;reviewRep?:boolean;fromCalendar?:boolean}
 |{view:'coach';assignmentId?:string;feedbackId?:string;onClose:(work:TrainingCoachWork|null)=>void}
 |{view:'scorecard';matchDate:string|null;doubles:boolean}

type TrainingLaunch={cardId:string;identitySlug:string;starterWarmup?:{onFinish:(title:string,elapsedSeconds:number)=>void}}

export function openLevelUp(client:SupabaseClient,owner:string,current:()=>boolean,initial:TrainingStart='catalog',launch?:TrainingLaunch){
 const previous=document.activeElement instanceof HTMLElement?document.activeElement:null,dialog=document.createElement('dialog');dialog.className='captain-lineup-dialog training-dialog';dialog.setAttribute('aria-label','Level Up training')
 const weeksStart=typeof initial==='object'&&initial.view==='weeks'?initial:undefined
 const calendarRepStart=weeksStart?.calendarRep
 let resumeCalendarRep=Boolean(calendarRepStart)
 let requestedPlanId=calendarRepStart?.planId??weeksStart?.planId
 const coachStart=typeof initial==='object'&&initial.view==='coach'?initial:undefined
 const scorecardStart=typeof initial==='object'&&initial.view==='scorecard'?initial:undefined
 const scorecardLabel=scorecardStart?`${scorecardStart.doubles?'Doubles':'Singles'} match · ${matchDate(scorecardStart.matchDate)}`:''
 const matchFocusChoices=scorecardStart?scorecardFocusOptions.flatMap(option=>{
  if('doublesOnly' in option&&!scorecardStart.doubles)return []
  const card=LEVEL_UP_CARDS.find(item=>item.id===option.cardId)
  return card?[{...option,card}]:[]
 }):[]
 let matchPractice:{cardId:string;target:string}|null=null
 let matchPracticeSaved=false
 let requestedAssignmentId=coachStart?.assignmentId
 const requestedFeedbackId=coachStart?.feedbackId
 let focusRequestedFeedback=Boolean(requestedFeedbackId),coachPracticeCue=''
 let disposed=false,version=0,historyVersion=0,phase:'match-focus'|'inbox'|'plan'|'catalog'|'modules'|'module'|'card'|'session'|'warmup'|'progress'=scorecardStart?'match-focus':typeof initial==='object'?'inbox':initial,practiceModule:LevelUpModule|null=null,selected:LevelUpCard|null=null,allowed:boolean|null=null,accessError=false,history:TrainingSession[]|null=null,historyError=false,historyComplete=false,historyBusy=false,accessBusy=false,saving=false,checking=false,confirming=false,notice='',instructionsOpen=false,sessionScroll=0,rating='',note='',context='alone',feeling='ready',payload:Readonly<TrainingSave>|null=null
 let query='',setting='',maxMinutes=Infinity,catalogLimit=catalogPageSize,catalogReturnCard=''
 let choices=(()=>{try{return loadTrainingChoices(owner,window.localStorage)}catch{return emptyTrainingChoices()}})(),choiceStored=true,cardFromPlan=false,cardFromProgress=false
 if(initial==='catalog'&&choices.active)phase='plan'
 let plans:WeeklyLevelUpPlan[]|null=null,coachWork:TrainingCoachWork|null|undefined,plansBusy=false,coachBusy=false,plansError=false,coachError=false,inboxLoaded=false,cardFromInbox=false,sessionDirection=choices.active,sessionOrigin=''
 let inboxSection:'coach'|'weeks'=typeof initial==='object'&&initial.view==='weeks'?'weeks':'coach'
 let inboxReturnCard=''
 let savedWeekPractice:SavedWeekPractice|undefined
 const openInboxFolds=new Set<string>()
 if(initial==='catalog'&&launch){selected=LEVEL_UP_CARDS.find(c=>c.id===launch.cardId)||null;phase=selected?'card':'catalog';if(selected)sessionDirection=trainingIdentity(launch.identitySlug)?launch.identitySlug:choices.active}
 let replyEditor:ReturnType<typeof openWeeklyCoachReply>|null=null
 let coachEditor:ReturnType<typeof openCoachCheckIn>|null=null
 let practiceCalendar:ReturnType<typeof openCalendar>|null=null
 let weekPending:WeeklyChange|null=null,weekBusy=false,weekAttempted=false,weekConflict=false,weekLeaving=false,weekNotice='',plansVersion=0,coachVersion=0
 let reviewingScheduledPractice=false
 let pausedInBackground=false
 const completed=new Set<string>(),clock=new TrainingClock(),active=()=>!disposed&&current()
 const dispose=()=>{
  if(disposed)return
  disposed=true;replyEditor?.dispose();replyEditor=null;coachEditor?.dispose();coachEditor=null;practiceCalendar?.dispose();practiceCalendar=null
  version++;plansVersion++;coachVersion++;weekPending=null;clock.pause();payload=null;selected=null;practiceModule=null;choices=emptyTrainingChoices()
  const lastCoachWork=coachWork
  plans=null;coachWork=null;sessionOrigin='';sessionDirection='';completed.clear();history=null;note='';savedWeekPractice=undefined;matchPractice=null;coachPracticeCue=''
  clearInterval(tick);document.removeEventListener('visibilitychange',visibility);dialog.remove()
  if(current()){
   if(previous?.isConnected)previous.focus({preventScroll:true})
   if(lastCoachWork!==undefined)coachStart?.onClose(lastCoachWork)
  }
 }
 const requestClose=()=>{if(replyEditor?.isOpen()){replyEditor.back();return}if(coachEditor?.isOpen()){coachEditor.back();return}if(practiceCalendar?.isOpen()){practiceCalendar.back();return}if(weekBusy){weekNotice='Wait for this request to finish before closing.';render();return}if(weekPending&&weekAttempted){weekLeaving=true;render();return}if(saving||checking){notice='Wait for this request to finish before closing.';render();return}if(phase==='session'){sessionScroll=dialog.scrollTop;clock.pause();confirming=true;render();dialog.querySelector<HTMLElement>('[data-keep]')?.focus();return}dispose()}
 const accessCopy=()=>allowed===true?'Self-guided training saves privately to your account.':allowed===false?`${MEMBERSHIP_TIERS.player_plus.name} access is required to save self-guided training. You can still read the cards and your account history.`:accessError?'Account access could not be checked.':'Checking your player access…'
 const bindCards=()=>dialog.querySelectorAll<HTMLButtonElement>('[data-card]').forEach(button=>{button.onclick=()=>{
  const card=LEVEL_UP_CARDS.find(item=>item.id===button.dataset.card)
  if(!card)return
  matchPractice=null;matchPracticeSaved=false
  selected=card;cardFromPlan=phase==='plan';cardFromInbox=false;cardFromProgress=phase==='progress'
  catalogReturnCard=phase==='catalog'?card.id:''
  if(cardFromProgress)practiceModule=null
  sessionDirection=choices.active;sessionOrigin='';phase='card';notice='';render();focus()
 }})
 const focus=()=>dialog.querySelector<HTMLElement>('h1')?.focus()
 const findInboxCard=(key:string)=>Array.from(dialog.querySelectorAll<HTMLButtonElement>('[data-inbox-card]'))
  .find(button=>button.dataset.inboxCard===key&&button.getClientRects().length>0)
 const openInboxDrill=(key:string)=>{
  if(!active())return false
  const launch=trainingInboxLaunches(plans??[],coachWork??null,requestedFeedbackId).find(item=>item.key===key)
  const card=launch&&LEVEL_UP_CARDS.find(item=>item.id===launch.cardId)
  if(!launch||!card)return false
  selected=card;inboxReturnCard=launch.key;practiceModule=null;cardFromPlan=false;cardFromInbox=true;cardFromProgress=false
  coachPracticeCue=launch.coachCue??''
  sessionDirection=trainingIdentity(launch.identitySlug)?launch.identitySlug:choices.active
  sessionOrigin=launch.label;phase='card';notice='This is private self-guided practice. Your plan and assignment status stay unchanged.';render();focus()
  return true
 }
 const focusInboxReturn=(practiceSaved=false,checkInReady=false)=>{
  const button=inboxReturnCard?findInboxCard(inboxReturnCard):undefined
  inboxReturnCard=''
  coachPracticeCue=''
  const rep=practiceSaved?button?.closest('.training-week-rep-ready'):undefined
  const mark=rep?.querySelector<HTMLButtonElement>('[data-week-mark]')
  const checkIn=checkInReady?button?.closest('.training-assignment')?.querySelector<HTMLButtonElement>('[data-coach-checkin]'):undefined
  const target=mark??checkIn??button
  if(!target){focus();return}
  if(mark)rep?.scrollIntoView({block:'start'})
  target.scrollIntoView({block:'nearest'})
  target.focus({preventScroll:true})
 }
 const weekFocusTarget=(id:string,markKey?:string,repId?:string)=>{
  const week=Array.from(dialog.querySelectorAll<HTMLElement>('[data-week-plan]')).find(section=>section.dataset.weekPlan===id)
  const target=markKey
   ?Array.from(week?.querySelectorAll<HTMLButtonElement>('[data-week-mark]')??[]).find(button=>button.dataset.weekMark===markKey)
   :repId?Array.from(week?.querySelectorAll<HTMLElement>('[data-week-rep]')??[]).find(heading=>heading.dataset.weekRep===repId)
   :week?.querySelector<HTMLElement>('.training-week-rep-next h3')??week?.querySelector<HTMLElement>('h2')
  return target?.getClientRects().length?target:undefined
 }
 const focusSavedWeek=(id:string,markKey?:string,repId?:string)=>{
  const target=weekFocusTarget(id,markKey,repId)
  if(!target){focus();return}
  target.scrollIntoView({block:'nearest'})
  target.focus({preventScroll:true})
 }
 const focusPracticeAction=(planId:string,repId:string)=>{
  const button=Array.from(dialog.querySelectorAll<HTMLButtonElement>('[data-week-calendar],[data-week-schedule]')).find(button=>
   (button.dataset.weekCalendar??button.dataset.weekSchedule)===repId&&button.closest<HTMLElement>('[data-week-plan]')?.dataset.weekPlan===planId&&button.getClientRects().length>0)
  if(!button){focusSavedWeek(planId,undefined,repId);return}
  button.scrollIntoView({block:'nearest'});button.focus({preventScroll:true})
 }
 const trainingViews=()=>`<div class="match-filters training-views" role="group" aria-label="Training views"><button type="button" class="secondary" data-plan aria-pressed="${phase==='plan'}">Your direction</button><button type="button" class="secondary" data-catalog aria-pressed="${phase==='catalog'||phase==='card'}">Training cards</button><button type="button" class="secondary" data-modules aria-pressed="${phase==='modules'||phase==='module'}">Practice modules</button><button type="button" class="secondary" data-progress aria-pressed="${phase==='progress'}">Your progress</button></div>`
 const trainingAccessHtml=()=>`<p>${html(accessCopy())}</p>${accessError?`<button type="button" class="secondary" data-access ${accessBusy?'disabled':''}>Retry player access</button>`:''}`
 const planScreenHtml=()=>`<header class="training-inbox-header">
  <h1 tabindex="-1">Your training direction</h1><button type="button" class="secondary" data-close aria-label="Close Level Up">Close</button>
 </header>
 <p role="status" data-notice>${html(notice)}</p>
 ${trainingPlanHtml(choices,choiceStored,allowed===true)}
 <details class="training-inbox-fold" data-inbox-fold="direction-tools"><summary>More training tools</summary>
  ${trainingViews()}<button type="button" class="secondary" data-inbox>Weekly plans and coach work</button>
  <div data-direction-access>${trainingAccessHtml()}</div>
 </details>`
 const catalogScreenHtml=()=>`<header class="training-inbox-header">
  <h1 tabindex="-1">Training cards</h1><button type="button" class="secondary" data-close aria-label="Close Level Up">Close</button>
 </header>
 <div class="training-catalog-controls">
  <small class="stat-eyebrow">Level Up</small>
  <label>Find a drill<input type="search" maxlength="80" data-search value="${html(query)}" placeholder="Serve, return, footwork…"></label>
  <div class="training-catalog-filter-row">
   <label>Practice setting<select data-setting><option value="">Any setting</option>${Object.entries(catalogSettings).map(([key,label])=>`<option value="${key}" ${key===setting?'selected':''}>${label}</option>`).join('')}</select></label>
   <label>Time available<select data-catalog-time><option value="Infinity">Any length</option>${[5,8].map(minutes=>`<option value="${minutes}" ${minutes===maxMinutes?'selected':''}>Up to ${minutes} min</option>`).join('')}</select></label>
  </div>
 </div>
 <details class="training-inbox-fold" data-inbox-fold="catalog-tools"><summary>More training tools</summary>
  ${trainingViews()}<button type="button" class="secondary" data-inbox>Weekly plans and coach work</button>
 </details>
 <div class="training-catalog-results-bar"><p role="status" tabindex="-1" data-catalog-count></p><button type="button" class="secondary" data-catalog-clear hidden>Clear filters</button></div>
 <div data-cards></div>`
 const progressScreenHtml=()=>`<header class="training-inbox-header">
  <h1 tabindex="-1" data-progress-control="title">Training progress</h1><button type="button" class="secondary" data-close data-progress-control="close" aria-label="Close Level Up">Close</button>
 </header>
 <div class="training-history-toolbar">
  <small class="stat-eyebrow">Your practice log</small>
  <button type="button" class="secondary" data-history data-progress-control="refresh" aria-label="Refresh account progress" aria-disabled="${historyBusy}">Refresh</button>
 </div>
 <p role="status" data-notice>${html(notice)}</p>
 ${matchPracticeSaved?'<div class="training-scorecard-coach"><p>Use your practice result in a coach check-in when it relates to your assignment.</p><button type="button" class="secondary" data-inbox>Open coach assignments</button></div>':''}
 ${historyBusy?`<p role="status">${history?'Refreshing your practice log…':'Loading your practice log…'}</p>`:''}
 ${historyError?`<p role="alert">${history?.length?'Showing your last loaded sessions. Refresh to try again.':'Training history is unavailable. Refresh to try again.'}</p>`:''}
 ${history&&(!historyError||history.length)?trainingHistoryHtml(history,historyComplete):''}
 <details class="training-inbox-fold" data-inbox-fold="progress-tools"><summary data-progress-control="tools">More training tools</summary>
  ${trainingAccessHtml()}${trainingViews()}
  <button type="button" class="secondary" data-inbox>Weekly plans and coach work</button>
 </details>`
 const modulesScreenHtml=(module:LevelUpModule|null)=>`<header class="training-inbox-header">
  <h1 tabindex="-1">${module?'Practice block':'Practice modules'}</h1><button type="button" class="secondary" data-close aria-label="Close Level Up">Close</button>
 </header>
 ${module?`<button type="button" class="secondary" data-modules-back>Back to practice modules</button>
  <p role="status" data-notice>${html(notice)}</p>${trainingModuleHtml(module,completed)}`:
  `<p class="training-modules-intro">Pick a focused block for your serve, movement, or match readiness.</p>
  <ul class="training-catalog-list" role="list">${LEVEL_UP_MODULES.map(item=>`<li>
   <button type="button" class="secondary training-catalog-card" data-module="${html(item.id)}" aria-labelledby="module-title-${html(item.id)}" aria-describedby="module-summary-${html(item.id)}">
    <span class="training-catalog-card-title" id="module-title-${html(item.id)}"><span class="sr-only">Open module </span>${html(item.title)}</span>
    <span class="training-module-tile-summary" id="module-summary-${html(item.id)}">
     <span class="training-catalog-card-facts"><span class="training-catalog-time">${html(item.durationLabel)}</span></span>
     <span class="training-catalog-goal">${html(item.subtitle)}</span>
    </span><span class="training-catalog-arrow" aria-hidden="true">›</span>
   </button>
  </li>`).join('')}</ul>
  <details class="training-inbox-fold" data-inbox-fold="module-tools"><summary>More training tools</summary>
   ${trainingViews()}<button type="button" class="secondary" data-inbox>Weekly plans and coach work</button>
  </details>`}`
 const matchFocusHtml=()=>`<header class="training-inbox-header">
  <h1 tabindex="-1">Next practice</h1><button type="button" class="secondary" data-close aria-label="Back to scorecard">Back</button>
 </header>
 <p class="training-scorecard-source">${html(scorecardLabel)}</p>
 <p>Choose one focus for your next session.</p>
 <ul class="training-catalog-list" role="list">${matchFocusChoices.map(({title,card})=>`<li>
  <button type="button" class="secondary training-catalog-card" data-match-focus="${html(card.id)}" aria-labelledby="match-focus-${html(card.id)}" aria-describedby="match-focus-drill-${html(card.id)}">
   <span class="training-catalog-card-title" id="match-focus-${html(card.id)}">${html(title)}</span>
   <span class="training-catalog-goal" id="match-focus-drill-${html(card.id)}">${html(card.title)} · ${card.durationMinutes}&nbsp;min</span>
   <span class="training-catalog-arrow" aria-hidden="true">›</span>
  </button>
 </li>`).join('')}</ul>`
 const targetNote=()=>matchPractice?`Practice target: ${matchPractice.target.trim()}`:''
 const canWarmUp=(card:LevelUpCard)=>Boolean(launch?.starterWarmup&&launch.cardId===card.id&&!cardFromInbox&&!cardFromPlan&&!cardFromProgress&&!practiceModule)
 const drillScreenHtml=(card:LevelUpCard)=>{
  const warmup=canWarmUp(card)
  const footerNote=warmup
   ?`<p id="training-warmup-help">Use the timer for this visit.${allowed===true?'':` Save practice to your history with ${MEMBERSHIP_TIERS.player_plus.name}.`}</p>${accessError?trainingAccessHtml():''}`
   :allowed===true?'':trainingAccessHtml()
  const back=matchPractice?['match-focus-back','Change focus']:cardFromInbox?['inbox','Back to training inbox']:cardFromPlan?['plan-back','Back to your direction']:cardFromProgress?['progress-back','Back to training progress']:practiceModule?['module-back','Back to practice module']:['catalog-back','Back to training cards']
  return `<header class="training-drill-header"><h1 tabindex="-1">Practice drill</h1><button type="button" class="secondary" data-close aria-label="Close Level Up">Close</button></header>
   <div class="training-drill-body" data-training-drill-body>
    <button type="button" class="secondary" data-${back[0]}>${back[1]}</button>
    ${trainingDrillOverviewHtml(card)}
    ${cardFromInbox?trainingCoachCueHtml(coachPracticeCue):''}
    ${matchPractice?`<div class="training-scorecard-target"><label>Practice target<input type="text" data-match-target maxlength="${matchTargetLimit}" value="${html(matchPractice.target)}" aria-describedby="training-match-target-help"></label><p id="training-match-target-help">Set a number you can track. It saves with your completed session.</p></div>`:''}
    ${trainingSafetyHtml(card)}
    ${trainingRoutineHtml(card)}
    <details class="training-inbox-fold" data-drill-fold="notes"><summary>Coaching notes &amp; proof</summary>${trainingDrillNotesHtml(card)}</details>
    <p role="status" data-notice>${html(notice)}</p>
    ${matchPractice?'':`<details class="training-inbox-fold" data-drill-fold="tools"><summary>More training tools</summary>
     ${trainingViews()}
     ${cardFromInbox?'':'<button type="button" class="secondary" data-inbox>Weekly plans and coach work</button>'}
    </details>`}
   </div>
   <footer class="training-drill-footer">
    ${footerNote}
    ${allowed===true||!warmup?`<button type="button" data-start ${allowed!==true?'disabled':''}>Start training</button>`:''}
    ${warmup?`<button type="button" ${allowed===true?'class="secondary" ':''}data-start-warmup aria-describedby="training-warmup-help">Start warm-up</button>`:''}
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
 const sessionTimerHtml=(card:LevelUpCard,locked:boolean,warmup=false)=>`
  <section class="training-session-clock" aria-label="Training timer">
   <div class="training-session-clock-head">
    <small class="stat-eyebrow">Elapsed time</small>
    <span data-clock-state aria-live="polite" ${clock.running()?'data-clock-running':''}>${clock.running()?'Running':'Paused'}</span>
   </div>
   <h2>${html(card.title)}</h2>
   <p role="timer" data-clock>${trainingClockText(clock.seconds())}</p>
   <button type="button" class="secondary" data-timer ${locked?'disabled':''}>${timerAction()}</button>
   <p data-timer-hint>${timerHint()}</p>
   ${warmup?'<button type="button" data-finish-warmup>Finish warm-up</button>':''}
  </section>`
 const warmupScreenHtml=(card:LevelUpCard)=>`
  <header class="training-inbox-header">
   <h1 tabindex="-1">Warm-up</h1><button type="button" class="secondary" data-close aria-label="Close Level Up">Close</button>
  </header>
  ${sessionTimerHtml(card,false,true)}
  ${trainingCueHtml(card)}
  ${trainingSafetyHtml(card)}
  ${trainingRoutineHtml(card)}`
 const sessionScreenHtml=(card:LevelUpCard,locked:boolean)=>`
  <header class="training-inbox-header">
   <h1 tabindex="-1">Training session</h1>
   <button type="button" class="secondary" data-close aria-label="Close Level Up" ${saving||checking?'disabled':''}>Close</button>
  </header>
  ${sessionTimerHtml(card,locked)}
  ${trainingCueHtml(card)}
  ${cardFromInbox?trainingCoachCueHtml(coachPracticeCue):''}
  ${trainingSafetyHtml(card)}
  ${matchPractice?`<p class="training-session-track"><strong>Practice target</strong> ${html(matchPractice.target)}</p>`:''}
  <p class="training-session-track"><strong>Track</strong> ${html(card.proof)}</p>
  <details class="training-inbox-fold" data-instructions ${instructionsOpen?'open':''}>
   <summary>Review training instructions</summary>
   ${trainingCardHtml(card)}
  </details>
  <section class="training-session-log">
   <h2>Log your session</h2>
   <p>${matchPractice?'Save your target and result to your private training history.':sessionOrigin?`Private practice from ${html(sessionOrigin)}.`:'Save your proof to your private training history.'}</p>
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
    <label>${matchPractice?'How did you do against your target?':'Your training note'}<textarea name="note" maxlength="${trainingNoteLimit-(matchPractice?targetNote().length+2:0)}" rows="3" ${locked?'disabled':''}></textarea></label>
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
   ${coachBusy?'<p role="status">Loading coach assignments…</p>':coachError?'<p role="alert">Coach assignments couldn’t load. Try refreshing.</p>':coachWork?trainingCoachWorkHtml(coachWork,new Date(),requestedAssignmentId,requestedFeedbackId):''}
   <button type="button" class="secondary" data-coach-refresh ${coachBusy?'disabled':''}>Refresh coach work</button>
   <button type="button" class="secondary" data-training-web="coach">Coach check-ins on website</button>
  </div>
  <div role="region" aria-label="Saved weekly plans" tabindex="-1" id="training-inbox-weeks" data-inbox-region="weeks" ${inboxSection==='weeks'?'':'hidden'}>
   ${plansBusy?'<p role="status">Loading saved weekly plans…</p>':plansError?'<p role="alert">Saved weeks couldn’t load. Try refreshing.</p>':plans?trainingPlansHtml(plans,allowed===true||Boolean(coachWork?.links.some(l=>l.status!=='paused')),requestedPlanId,savedWeekPractice,{links:readScheduledPracticeLinks(owner),alreadyInCalendar:Boolean(weeksStart?.fromCalendar)}):''}
   <button type="button" class="secondary" data-plan-refresh ${plansBusy?'disabled':''}>Refresh saved weeks</button>
   <button type="button" class="secondary" data-training-web="weekly">Manage saved weeks on website</button>
  </div>
  <details class="training-inbox-fold" data-inbox-fold="tools"><summary>Training tools</summary>${trainingAccessHtml()}${trainingViews()}</details>`
 const render=()=>{if(!active())return
  dialog.classList.toggle('training-inbox-screen',phase==='inbox'&&!weekPending)
  dialog.classList.toggle('training-week-change-screen',Boolean(weekPending))
  dialog.classList.toggle('training-drill-screen',phase==='card'&&Boolean(selected))
  dialog.classList.toggle('training-session-screen',(phase==='session'||phase==='warmup')&&!confirming&&Boolean(selected))
  dialog.classList.toggle('training-progress-screen',phase==='progress')
  dialog.classList.toggle('training-catalog-screen',phase==='catalog')
  dialog.classList.toggle('training-scorecard-screen',phase==='match-focus')
  dialog.classList.toggle('training-modules-screen',phase==='modules'||phase==='module')
  dialog.classList.toggle('training-direction-screen',phase==='plan'&&!weekPending)
  if(weekPending){renderWeekChange();return}
  if(confirming){dialog.innerHTML=`<h1 tabindex="-1">Leave this session?</h1><p>${payload?'The save may already be recorded. Check account progress before starting it again.':'Your timer and unsaved training notes will be discarded.'}</p><button type="button" class="secondary" data-keep>Keep training</button><button type="button" data-discard>Discard and close</button>`;dialog.querySelector<HTMLButtonElement>('[data-keep]')!.onclick=()=>{confirming=false;render();dialog.scrollTop=sessionScroll;dialog.querySelector<HTMLElement>('[name=note]')?.focus({preventScroll:true})};dialog.querySelector<HTMLButtonElement>('[data-discard]')!.onclick=dispose;return}
  const frozen=Boolean(payload),locked=frozen||saving||checking
  const focusedInboxSection=dialog.querySelector<HTMLElement>('[data-inbox-section]:focus')?.dataset.inboxSection
  const focusedInboxCard=dialog.querySelector<HTMLElement>('[data-inbox-card]:focus')?.dataset.inboxCard
  const focusedFeedback=Boolean(dialog.querySelector('[data-coach-feedback-focus]:focus'))
  const focusedWeekControl=dialog.querySelector<HTMLElement>('[data-week-plan] :is(h2,[data-week-rep],[data-week-mark]):focus')
  const focusedWeekId=focusedWeekControl?.closest<HTMLElement>('[data-week-plan]')?.dataset.weekPlan
  const focusedProgressControl=dialog.querySelector<HTMLElement>('[data-progress-control]:focus')?.dataset.progressControl
  const focusedTarget=dialog.querySelector<HTMLInputElement>('[data-match-target]:focus')
  const focusedWarmup=Boolean(dialog.querySelector('[data-start-warmup]:focus'))
  const previousDrill=dialog.querySelector<HTMLElement>('[data-training-drill-body]')
  const drillScroll=previousDrill?.scrollTop??0
  const openDrillFolds=Array.from(previousDrill?.querySelectorAll<HTMLDetailsElement>('[data-drill-fold][open]')??[],fold=>fold.dataset.drillFold)
  dialog.innerHTML=phase==='match-focus'?matchFocusHtml():phase==='inbox'?inboxHtml():phase==='progress'?progressScreenHtml():phase==='catalog'?catalogScreenHtml():phase==='modules'||phase==='module'?modulesScreenHtml(phase==='module'?practiceModule:null):phase==='card'&&selected?drillScreenHtml(selected):phase==='session'&&selected?sessionScreenHtml(selected,locked):phase==='warmup'&&selected?warmupScreenHtml(selected):planScreenHtml()
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
  if(focusedFeedback)dialog.querySelector<HTMLElement>('[data-coach-feedback-focus]')?.focus({preventScroll:true})
  if(focusedWeekId)weekFocusTarget(focusedWeekId,focusedWeekControl?.dataset.weekMark,focusedWeekControl?.dataset.weekRep)?.focus({preventScroll:true})
  if(focusedProgressControl)dialog.querySelector<HTMLElement>(`[data-progress-control="${focusedProgressControl}"]`)?.focus({preventScroll:true})
  if(focusedWarmup)dialog.querySelector<HTMLElement>('[data-start-warmup]')?.focus({preventScroll:true})
  const targetInput=dialog.querySelector<HTMLInputElement>('[data-match-target]')
  if(targetInput){
   targetInput.oninput=()=>{
    if(matchPractice)matchPractice.target=targetInput.value
    notice=''
    const status=dialog.querySelector<HTMLElement>('[data-notice]')
    if(status)status.textContent=''
   }
   if(focusedTarget){targetInput.focus({preventScroll:true});targetInput.setSelectionRange(focusedTarget.selectionStart,focusedTarget.selectionEnd)}
  }
  dialog.querySelectorAll<HTMLButtonElement>('[data-match-focus]').forEach(button=>{
   button.onclick=()=>{
    const choice=matchFocusChoices.find(item=>item.card.id===button.dataset.matchFocus)
    if(!active()||!choice)return
    selected=choice.card
    if(matchPractice?.cardId!==choice.card.id)matchPractice={cardId:choice.card.id,target:choice.target}
    phase='card';notice='';render();focus()
   }
  })
  dialog.querySelector<HTMLButtonElement>('[data-match-focus-back]')?.addEventListener('click',()=>{
   phase='match-focus';notice='';render()
   const button=Array.from(dialog.querySelectorAll<HTMLButtonElement>('[data-match-focus]')).find(item=>item.dataset.matchFocus===matchPractice?.cardId)
   if(button)button.focus();else focus()
  })
  dialog.querySelector<HTMLButtonElement>('[data-access]')?.addEventListener('click',()=>{void readAccess()})
  dialog.querySelectorAll<HTMLButtonElement>('[data-catalog]').forEach(b=>{b.onclick=()=>{phase='catalog';practiceModule=null;notice='';render();focus()}})
  dialog.querySelector<HTMLButtonElement>('[data-catalog-back]')?.addEventListener('click',()=>{
   phase='catalog';notice='';render()
   const card=Array.from(dialog.querySelectorAll<HTMLButtonElement>('[data-cards] [data-card]')).find(button=>button.dataset.card===catalogReturnCard)
   if(!card){focus();return}
   card.scrollIntoView({block:'nearest'});card.focus({preventScroll:true})
  })
  dialog.querySelector<HTMLButtonElement>('[data-progress]')?.addEventListener('click',()=>{phase='progress';notice='';render();focus()})
  dialog.querySelector<HTMLButtonElement>('[data-progress-back]')?.addEventListener('click',()=>{
   phase='progress';notice='';render()
   const action=dialog.querySelector<HTMLButtonElement>('.training-history-action')
   if(!action){focus();return}
   action.scrollIntoView({block:'nearest'});action.focus({preventScroll:true})
  })
  dialog.querySelector<HTMLButtonElement>('[data-history]')?.addEventListener('click',()=>{void readHistory()})
  dialog.querySelector<HTMLButtonElement>('[data-modules]')?.addEventListener('click',()=>{phase='modules';practiceModule=null;notice='';render();focus()})
  dialog.querySelector<HTMLButtonElement>('[data-modules-back]')?.addEventListener('click',()=>{
   const moduleId=practiceModule?.id
   phase='modules';practiceModule=null;notice='';render()
   const entry=Array.from(dialog.querySelectorAll<HTMLButtonElement>('[data-module]')).find(button=>button.dataset.module===moduleId)
   if(entry)entry.focus();else focus()
  })
  dialog.querySelector<HTMLButtonElement>('[data-module-back]')?.addEventListener('click',()=>{
   phase='module';notice='';render()
   const entry=Array.from(dialog.querySelectorAll<HTMLButtonElement>('.training-module-steps [data-card]')).find(button=>button.dataset.card===selected?.id)
   if(entry)entry.focus();else focus()
  })
  dialog.querySelectorAll<HTMLButtonElement>('[data-module]').forEach(b=>{b.onclick=()=>{practiceModule=LEVEL_UP_MODULES.find(m=>m.id===b.dataset.module)||null;if(!practiceModule)return;phase='module';notice='';render();focus()}})
  dialog.querySelectorAll<HTMLButtonElement>('[data-plan]').forEach(b=>{b.onclick=()=>{phase='plan';practiceModule=null;notice='';render();focus()}})
  dialog.querySelector<HTMLButtonElement>('[data-plan-back]')?.addEventListener('click',()=>{
   phase='plan';notice='';render()
   const card=Array.from(dialog.querySelectorAll<HTMLButtonElement>('[data-card]')).find(button=>button.dataset.card===selected?.id&&button.getClientRects().length>0)
   if(card)card.focus();else focus()
  })
  const identityForm=dialog.querySelector<HTMLFormElement>('[data-identity]')
  if(identityForm){
   const persistChoices=()=>{try{choiceStored=saveTrainingChoices(owner,choices,window.localStorage)}catch{choiceStored=false}}
   const feedback=identityForm.querySelector<HTMLElement>('[data-identity-feedback]')!
   identityForm.onchange=()=>{feedback.textContent=''}
   identityForm.onsubmit=event=>{
    event.preventDefault()
    if(!active())return
    const kind=(event.submitter as HTMLButtonElement|null)?.value
    if(kind!=='style'&&kind!=='focus')return
    try{choices=chooseTrainingIdentity(choices,String(new FormData(identityForm).get(kind)||''))}
    catch{
     feedback.textContent=kind==='style'?'Choose a playing style first.':'Choose a development focus first.'
     feedback.focus();return
    }
    persistChoices();notice='Training direction updated.';render()
    dialog.querySelector<HTMLElement>('[data-direction-title]')?.focus()
   }
   dialog.querySelector<HTMLButtonElement>('[data-clear-identity]')?.addEventListener('click',()=>{
    if(!active())return
    choices=emptyTrainingChoices();persistChoices();notice='Training choices cleared.';render();focus()
   })
  }
  dialog.querySelectorAll<HTMLButtonElement>('[data-inbox]').forEach(button=>{button.onclick=()=>{
   const returning=phase==='card'&&cardFromInbox
   phase='inbox';practiceModule=null;notice='';render()
   if(returning)focusInboxReturn();else{inboxReturnCard='';coachPracticeCue='';focus()}
   if(!inboxLoaded){inboxLoaded=true;void readPlans();void readCoach()}
  }})
  dialog.querySelector<HTMLButtonElement>('[data-plan-refresh]')?.addEventListener('click',()=>{void readPlans()})
  dialog.querySelector<HTMLButtonElement>('[data-coach-refresh]')?.addEventListener('click',()=>{void readCoach()})
  const schedule=dialog.querySelector<HTMLButtonElement>('[data-week-schedule]')
  if(schedule)schedule.onclick=()=>{
   const {weekSchedule:repId,scheduleTitle}=schedule.dataset
   const plan=plans?.find(row=>row.id===schedule.closest<HTMLElement>('[data-week-plan]')?.dataset.weekPlan)
   if(!active()||practiceCalendar?.isOpen()||!plan||!repId||!scheduleTitle)return
   const key=weeklyDrillKey(plan.id,repId),hasDrill=Boolean(findInboxCard(key))
   practiceCalendar=openCalendar(client,owner,active,undefined,{
    practiceTitle:scheduleTitle,
    weeklyRep:hasDrill?{planId:plan.id,repId,identitySlug:plan.identitySlug,weekStart:plan.weekStart}:undefined,
    openDrill:hasDrill?()=>{openInboxDrill(key)}:undefined,
    onClose:()=>{
     practiceCalendar=null
     if(active()){render();focusPracticeAction(plan.id,repId)}
    },
   })
  }
  dialog.querySelectorAll<HTMLButtonElement>('[data-week-calendar]').forEach(button=>{button.onclick=()=>{
   const repId=button.dataset.weekCalendar
   const plan=plans?.find(row=>row.id===button.closest<HTMLElement>('[data-week-plan]')?.dataset.weekPlan)
   if(!active()||practiceCalendar?.isOpen()||!plan||!repId)return
   const key=calendarWeeklyRepKey({planId:plan.id,repId,identitySlug:plan.identitySlug,weekStart:plan.weekStart})
   const linked=readScheduledPracticeLinks(owner).get(key)
   if(!linked){render();focusPracticeAction(plan.id,repId);return}
   practiceCalendar=openCalendar(client,owner,active,undefined,{
    practiceEventId:linked.eventId,
    onPracticeClose:(changed,message)=>{
     practiceCalendar=null
     if(!active())return
     if(changed){notice=message;notifyCalendarWeeklyRepChange(owner,true)}
     render();focusPracticeAction(plan.id,repId)
    },
   })
  }})
  dialog.querySelectorAll<HTMLButtonElement>('[data-inbox-card]').forEach(button=>{button.onclick=()=>{
   if(button.dataset.inboxCard)openInboxDrill(button.dataset.inboxCard)
  }})
  dialog.querySelectorAll<HTMLButtonElement>('[data-training-web]').forEach(b=>{b.onclick=async()=>{if(!active())return;const path=b.dataset.trainingWeb==='weekly'?'/level-up/my-quest':b.dataset.trainingWeb==='coach'?'/mylab#coach-assignments':null;if(!path)return;b.disabled=true;try{await Browser.open({url:'https://www.tenaceiq.com'+path})}catch{if(active()){notice='The website could not be opened. Try again when your connection is ready.';render()}}finally{if(active()&&b.isConnected)b.disabled=false}}})
  const sections=dialog.querySelectorAll<HTMLButtonElement>('[data-inbox-section]')
  const regions=dialog.querySelectorAll<HTMLElement>('[data-inbox-region]')
  sections.forEach(button=>{button.onclick=()=>{
   inboxSection=button.dataset.inboxSection==='weeks'?'weeks':'coach'
   sections.forEach(section=>section.setAttribute('aria-pressed',String(section===button)))
   regions.forEach(region=>region.hidden=region.dataset.inboxRegion!==inboxSection)
   button.focus({preventScroll:true})
   if(calendarRepStart&&inboxSection==='coach'&&coachWork===undefined&&!coachBusy){void readCoach();if(!historyComplete)void readHistory()}
  }})
  const directionWeek=dialog.querySelector<HTMLButtonElement>('[data-direction-week]')
  if(directionWeek)directionWeek.onclick=()=>{void openDirectionWeek(directionWeek)}
  dialog.querySelectorAll<HTMLButtonElement>('[data-week-reply]').forEach(b=>{b.onclick=()=>{if(!active()||replyEditor?.isOpen())return;const plan=plans?.find(p=>p.id===b.dataset.weekReply);if(!plan)return;replyEditor=openWeeklyCoachReply(client,owner,active,plan,saved=>{notice=saved?'Your reply is saved with this week.':'Review your latest coach update below.';plansVersion++;plansBusy=false;void readPlans().then(()=>{if(active()){const region=dialog.querySelector<HTMLElement>('[data-inbox-region=weeks]');region?.scrollIntoView({block:'start'});region?.focus({preventScroll:true})}})})}})
  dialog.querySelectorAll<HTMLButtonElement>('[data-coach-checkin]').forEach(button=>{button.onclick=()=>{
   if(!active()||coachEditor?.isOpen())return
   const assignment=coachWork?.assignments.find(a=>a.id===button.dataset.coachCheckin),link=coachWork?.links.find(l=>l.id===assignment?.studentLinkId)
   if(!assignment||!link)return
   const practice=findCoachPracticeStats(assignment,history??[],owner)
   button.focus({preventScroll:true})
   coachEditor=openCoachCheckIn(client,owner,active,assignment,link,saved=>{
    if(requestedAssignmentId===assignment.id)requestedAssignmentId=undefined
    notice=saved?'Check-in sent to your coach.':'Review your latest coach assignments.';coachVersion++;coachBusy=false;coachWork=null
    void readCoach().then(()=>{if(active()&&phase==='inbox'&&inboxSection==='coach')dialog.querySelector<HTMLElement>('[data-inbox-region="coach"]')?.focus()})
   },practice)
  }})
  dialog.querySelectorAll<HTMLButtonElement>('[data-week-mark]').forEach(b=>{b.onclick=()=>{if(!active())return;try{const [planId,repId]=JSON.parse(b.dataset.weekMark||'[]') as string[],plan=plans?.find(p=>p.id===planId);if(!plan)return;weekPending=completionWeeklyChange(plan,repId,b.dataset.weekCompleted==='true');weekAttempted=false;weekConflict=false;weekNotice='';render();focus()}catch{notice='Refresh saved weeks before changing a rep.';render()}}})
  const catalogResults=dialog.querySelector<HTMLElement>('[data-cards]')
  if(catalogResults){
   const search=dialog.querySelector<HTMLInputElement>('[data-search]')!
   const settingSelect=dialog.querySelector<HTMLSelectElement>('[data-setting]')!
   const timeSelect=dialog.querySelector<HTMLSelectElement>('[data-catalog-time]')!
   const count=dialog.querySelector<HTMLElement>('[data-catalog-count]')!
   const clear=dialog.querySelector<HTMLButtonElement>('[data-catalog-clear]')!
   const paintCatalog=()=>{
    const matches=trainingSelection(LEVEL_UP_CARDS,query,setting,maxMinutes)
    const visible=Math.min(matches.length,catalogLimit)
    count.textContent=matches.length===1?'1 drill':visible<matches.length?`${visible} of ${matches.length} drills`:`${matches.length} drills`
    clear.hidden=!query&&!setting&&maxMinutes===Infinity
    catalogResults.innerHTML=catalogCardsHtml(matches,catalogLimit)
    bindCards()
    const more=catalogResults.querySelector<HTMLButtonElement>('[data-catalog-more]')
    if(more)more.onclick=()=>{
     const next=catalogLimit
     catalogLimit+=catalogPageSize
     paintCatalog()
     catalogResults.querySelectorAll<HTMLButtonElement>('[data-card]')[next]?.focus()
    }
   }
   const updateFilters=()=>{
    query=search.value;setting=settingSelect.value;maxMinutes=Number(timeSelect.value)
    catalogLimit=catalogPageSize
    paintCatalog()
   }
   search.oninput=updateFilters;settingSelect.onchange=updateFilters;timeSelect.onchange=updateFilters
   clear.onclick=()=>{
    search.value='';settingSelect.value='';timeSelect.value='Infinity'
    updateFilters();count.focus()
   }
   paintCatalog()
  }else bindCards()
  dialog.querySelector<HTMLButtonElement>('[data-start-warmup]')?.addEventListener('click',()=>{
   if(!active()||phase!=='card'||!selected||!canWarmUp(selected))return
   phase='warmup';pausedInBackground=false;clock.reset();clock.start();render();focus()
  })
  dialog.querySelector<HTMLButtonElement>('[data-finish-warmup]')?.addEventListener('click',()=>{
   if(!active()||phase!=='warmup'||!selected)return
   clock.pause()
   const {title}=selected,seconds=clock.seconds()
   dispose()
   if(current())launch?.starterWarmup?.onFinish(title,seconds)
  })
  dialog.querySelector<HTMLButtonElement>('[data-start]')?.addEventListener('click',()=>{
   if(allowed!==true||!selected)return
   if(matchPractice){
    matchPractice.target=matchPractice.target.trim()
    if(!matchPractice.target){notice='Enter a practice target before you start.';render();dialog.querySelector<HTMLInputElement>('[data-match-target]')?.focus();return}
   }
   phase='session';instructionsOpen=false;pausedInBackground=false
   context=initialTrainingContext(selected);rating='';note='';feeling='ready'
   clock.reset();clock.start();notice='';render();focus()
   if(matchPractice&&!historyComplete)void readHistory()
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
 const accepted=(row:TrainingSession)=>{
  if(practiceModule&&selected&&practiceModule.cardIds.includes(selected.id))completed.add(selected.id)
  historyVersion++;historyBusy=false;historyError=false
  history=[row,...(history||[]).filter(r=>r.id!==row.id)].sort((a,b)=>Date.parse(b.completedAt)-Date.parse(a.completedAt)).slice(0,80)
  const practicedRep=cardFromInbox&&inboxSection==='weeks'
   ?trainingInboxLaunches(plans??[],null).find(launch=>launch.key===inboxReturnCard&&launch.cardId===row.cardId):undefined
  const practicedCoachId=cardFromInbox&&inboxSection==='coach'
   ?trainingInboxLaunches([],coachWork??null).find(launch=>launch.key===inboxReturnCard&&launch.cardId===row.cardId)?.checkInAssignmentId:undefined
  const practicedAssignment=coachWork?.assignments.find(assignment=>assignment.id===practicedCoachId)
  const checkInReady=Boolean(practicedAssignment&&findCoachPracticeStats(practicedAssignment,[row],owner))
  if(practicedRep)savedWeekPractice={key:practicedRep.key,cardId:row.cardId,rating:row.rating,elapsedSeconds:row.elapsedSeconds}
  matchPracticeSaved=Boolean(matchPractice);matchPractice=null
  payload=null;selected=null
  phase=practiceModule?'module':cardFromInbox?'inbox':cardFromPlan?'plan':'progress'
  notice=checkInReady?'Practice saved privately. You can add its stats to your check-in.':matchPracticeSaved?'Practice saved privately with your target.':practicedRep?'':practiceModule?'Drill saved to your account.':'Session saved to your account. Your self-rated training proof is separate from your TIQ rating.'
  if(practicedRep&&calendarRepStart&&practicedRep.key===weeklyDrillKey(calendarRepStart.planId,calendarRepStart.repId)){
   const plan=plans?.find(plan=>plan.id===calendarRepStart.planId)
   const rep=plan&&getWeeklyLevelUpPlanReps(plan).find(rep=>rep.id===calendarRepStart.repId)
   if(plan&&rep&&!rep.completedAt){
    weekPending=completionWeeklyChange(plan,rep.id,true)
    reviewingScheduledPractice=true
    inboxReturnCard=''
    coachPracticeCue=''
    render();focus();return
   }
  }
  render()
  if(cardFromInbox){focusInboxReturn(Boolean(practicedRep),checkInReady);return}
  const next=dialog.querySelector<HTMLElement>('[data-module-next],[data-module-complete]')
  if(next)next.focus();else focus()
 }
 const showSessionStatus=()=>{
  render()
  dialog.querySelector<HTMLElement>('.training-session-log [data-notice]')?.focus()
 }
 const save=async()=>{
  if(!active()||phase!=='session'||saving||checking||!selected||allowed!==true)return
  try{
   if(!payload){
    if(rating==='')throw Error('Choose a proof rating.')
    clock.pause()
    const sessionNote=matchPractice?[targetNote(),note.trim()].filter(Boolean).join('\n\n'):note
    payload=freezeTrainingSave(selected,Number(rating),sessionNote,context,feeling,clock.seconds(),'level-up-'+crypto.randomUUID(),new Date().toISOString(),sessionDirection)
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
 const readAccess=async()=>{
  if(accessBusy||!active())return
  accessBusy=true;accessError=false
  const paintAccess=()=>{
   if(phase==='plan'){
    const access=dialog.querySelector<HTMLElement>('[data-direction-access]')
    if(access){
     access.innerHTML=trainingAccessHtml()
     access.querySelector<HTMLButtonElement>('[data-access]')?.addEventListener('click',()=>{void readAccess()})
    }
    const create=dialog.querySelector<HTMLButtonElement>('[data-direction-week]')
    if(create)create.hidden=allowed!==true
   }else if(phase!=='warmup'&&phase!=='match-focus'&&phase!=='catalog'&&phase!=='modules'&&phase!=='module')render()
  }
  paintAccess()
  try{
   const value=await trainingAccess(client,owner,active)
   if(active())allowed=value
  }catch{
   if(active()){allowed=null;accessError=true}
  }finally{
   if(active()){
    accessBusy=false
    paintAccess()
   }
  }
 }
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
 const readPlans=async()=>{
  if(plansBusy||!active())return
  const request=++plansVersion
  const target=calendarRepStart?.planId===requestedPlanId?calendarRepStart:undefined
  const resume=resumeCalendarRep
  let launchKey:string|undefined
  let revealRep:CalendarWeeklyRep|undefined
  plansBusy=true;plansError=false
  if(phase==='inbox')render()
  try{
   const rows=await (target?loadTrainingWeek(client,owner,active,target):loadTrainingPlans(client,owner,active))
   if(!active()||request!==plansVersion)return
   plans=rows
   syncCalendarWeeklyRepProgress(owner,rows)
   if(resume&&target){
    resumeCalendarRep=false
    const [week]=rows
    if(week){
     if(getWeeklyLevelUpPlanProgress(week).nextRep?.id!==target.repId)openInboxFolds.add(JSON.stringify(['week-reps',week.id]))
     if(weeksStart?.reviewRep){
      if(getWeeklyLevelUpPlanReps(week).some(rep=>rep.id===target.repId))revealRep=target
      else notice='This rep is no longer in the saved week.'
     }else launchKey=weeklyDrillKey(week.id,target.repId)
    }
   }
  }catch{if(active()&&request===plansVersion){plans=null;plansError=true}}
  finally{
   if(active()&&request===plansVersion){
    plansBusy=false
    if(phase==='inbox'){
     const resumeKey=inboxSection==='weeks'?launchKey:undefined
     if(!resumeKey||!openInboxDrill(resumeKey)){
      if(resumeKey)notice='This rep’s drill is unavailable in the saved week.'
      render()
      if(revealRep&&inboxSection==='weeks')focusSavedWeek(revealRep.planId,undefined,revealRep.repId)
     }
    }
   }
  }
 }
 const readCoach=async()=>{
  if(coachBusy||!active())return
  const request=++coachVersion
  coachBusy=true;coachError=false
  if(phase==='inbox')render()
  try{
   const rows=await loadTrainingCoachWork(client,owner,active)
   if(active()&&request===coachVersion)coachWork=rows
  }catch{
   if(active()&&request===coachVersion){coachWork=null;coachError=true}
  }finally{
   if(active()&&request===coachVersion){
    coachBusy=false
    if(phase==='inbox'){
     render()
     if(focusRequestedFeedback&&inboxSection==='coach'){
      const feedback=dialog.querySelector<HTMLElement>('[data-coach-feedback-focus]')
      const target=feedback??dialog.querySelector<HTMLElement>('[data-coach-refresh]')
      target?.scrollIntoView({block:'nearest'});target?.focus({preventScroll:true})
     }
    }
    if(!coachError)focusRequestedFeedback=false
   }
  }
 }
 const showSavedWeek=(saved:WeeklyLevelUpPlan,message='')=>{
  const otherWeeks=(plans??[]).filter(plan=>plan.id!==saved.id&&(plan.identitySlug!==saved.identitySlug||plan.weekStart!==saved.weekStart))
  plans=[saved,...otherWeeks].slice(0,SAVED_WEEK_LIST_LIMIT)
  requestedPlanId=saved.id;plansError=false;notice=message
  weekPending=null;weekBusy=false;weekAttempted=false;weekConflict=false;weekLeaving=false;weekNotice='';reviewingScheduledPractice=false
  plansVersion++;plansBusy=false;phase='inbox';inboxSection='weeks';inboxLoaded=true
  syncCalendarWeeklyRepProgress(owner,[saved])
  render()
  focusSavedWeek(saved.id)
  if(!calendarRepStart&&!coachWork&&!coachBusy)void readCoach()
 }
 const openDirectionWeek=async(button:HTMLButtonElement)=>{
  if(!active()||allowed!==true||!choices.active||button.getAttribute('aria-disabled')==='true')return
  const slug=choices.active
  const current=()=>active()&&button.isConnected&&phase==='plan'&&choices.active===slug
  const feedback=dialog.querySelector<HTMLElement>('[data-week-lookup-error]')!
  const idleLabel=button.textContent
  feedback.textContent='';button.textContent='Checking this week…';button.setAttribute('aria-disabled','true')
  try{
   const change=newWeeklyChange(slug)
   const rows=await loadTrainingPlans(client,owner,current)
   let saved=rows.find(plan=>plan.identitySlug===slug&&plan.weekStart===change.plan.weekStart)
   if(!saved&&rows.length===SAVED_WEEK_LIST_LIMIT)saved=await findSavedWeeklyPlan(client,owner,current,change)??undefined
   if(!current())return
   plans=rows
   if(saved){showSavedWeek(saved);return}
   plansVersion++;plansBusy=false;plansError=false
   weekPending=change;weekAttempted=false;weekConflict=false;weekNotice='';render();focus()
  }catch{
   if(current())feedback.textContent='Couldn’t check this week. Try again.'
  }finally{
   if(button.isConnected){button.textContent=idleLabel;button.removeAttribute('aria-disabled')}
  }
 }
 const finishWeekChange=(saved:WeeklyLevelUpPlan)=>{
  const change=weekPending
  if(!change)return
  const message=reviewingScheduledPractice?'Practice saved privately. Rep marked done.':change.kind==='create'?'Your private weekly plan is saved.':change.completed?'Rep marked done.':'Rep reopened.'
  showSavedWeek(saved,message)
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
   const found=frozen.kind==='create'?await findSavedWeeklyPlan(client,owner,active,frozen):await checkWeeklyChange(client,owner,active,frozen)
   if(!active())return
   if(found){
    if(frozen.kind==='create'&&!weeklyChangeMatches(frozen,found))showSavedWeek(found,'Opened the plan already saved for this week.')
    else finishWeekChange(found)
    return
   }
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
  const receipt=reviewingScheduledPractice?savedWeekPractice:undefined
  const title=receipt?'Finish this rep':creating?'Review this week’s plan':change.completed?'Mark this rep done?':'Reopen this rep?'
  const action=creating?'Save this week':change.completed?'Mark rep done':'Reopen rep'
  const week=`<time datetime="${html(change.plan.weekStart)}">${html(formatWeekdayDate(change.plan.weekStart))}</time>`
  dialog.innerHTML=`<header class="training-inbox-header week-change-header">
   <div><small class="stat-eyebrow">${receipt?'Scheduled practice':'Saved weeks'}</small><h1 tabindex="-1">${weekLeaving?'Leave this plan change?':title}</h1></div>
   ${weekLeaving?'':`<button type="button" class="secondary" data-week-close aria-label="Close Level Up" ${weekBusy?'disabled':''}>Close</button>`}
  </header>
  ${weekLeaving?`
   <p>Your change may already be saved. Refresh your saved week to check before applying it again.</p>
   <div class="week-change-actions"><button type="button" data-week-keep>Keep this change</button><button type="button" class="secondary" data-week-leave>Discard and close</button></div>`:`
   <div class="week-change-summary">
    <small class="stat-eyebrow">Week of ${week}</small>
    <h2>${creating?html(trainingIdentity(change.plan.identitySlug)?.title.replace(/^The /,'')??'Your practice plan'):html(change.title)}</h2>
    ${receipt?trainingWeekPracticeReceiptHtml(receipt):creating?`<p>Private plan · ${change.plan.reps.length} reps</p><ol>${change.plan.reps.map(rep=>`<li>${html(rep.title)}</li>`).join('')}</ol>`:`<p>Status after saving <strong>${change.completed?'Complete':'Open'}</strong></p>`}
   </div>
   ${receipt?'<p>Your practice log stays private.</p>':''}
   ${creating?'':`<p>${change.plan.sharedWithCoach?'Your coach can see this rep’s updated status in the shared week.':'This updates your progress for the saved week.'}</p>`}
   <p class="week-change-status" data-week-status tabindex="-1" role="status">${html(weekNotice)}</p>
   <div class="week-change-actions">
    ${weekAttempted?`<button type="button" data-week-check ${weekBusy?'disabled':''}>Check current saved week</button>`:''}
    <button type="button" data-week-save ${weekAttempted?'class="secondary"':''} ${weekBusy||weekConflict?'disabled':''}>${weekBusy?'Working…':weekAttempted?'Retry same change':action}</button>
    <button type="button" class="secondary" data-week-cancel ${weekBusy?'disabled':''}>${weekAttempted?'Discard change and refresh':receipt?'Keep rep open':'Cancel change'}</button>
   </div>`}`
  dialog.querySelector('[data-week-save]')?.addEventListener('click',()=>{void sendWeekChange()})
  dialog.querySelector('[data-week-check]')?.addEventListener('click',()=>{void checkWeekChange()})
  dialog.querySelector('[data-week-close]')?.addEventListener('click',requestClose)
  dialog.querySelector('[data-week-keep]')?.addEventListener('click',()=>{weekLeaving=false;render();focus()})
  dialog.querySelector('[data-week-leave]')?.addEventListener('click',dispose)
  dialog.querySelector('[data-week-cancel]')?.addEventListener('click',()=>{
   const refresh=weekAttempted
   weekPending=null;weekAttempted=false;weekConflict=false;weekNotice='';reviewingScheduledPractice=false
   if(refresh){
    phase='inbox';inboxSection='weeks';plansVersion++;plansBusy=false;render();void readPlans()
    if(!inboxLoaded){inboxLoaded=true;void readCoach()}
    focus()
   }else{
    render()
    if(change.kind==='completion')focusSavedWeek(change.plan.id,JSON.stringify([change.plan.id,change.repId]))
    else dialog.querySelector<HTMLButtonElement>('[data-direction-week]')?.focus()
   }
  })
 }
 const visibility=()=>{
  if(document.visibilityState!=='hidden'||!clock.running())return
  clock.pause()
  if(active()){pausedInBackground=true;paintTimerControls()}
 }
 const tick=setInterval(()=>{if(!active()){dispose();return}paintSessionClock()},1000)
 document.addEventListener('visibilitychange',visibility);dialog.oncancel=e=>{e.preventDefault();if(confirming){confirming=false;render();dialog.scrollTop=sessionScroll;dialog.querySelector<HTMLElement>('[name=note]')?.focus({preventScroll:true})}else requestClose()};document.body.append(dialog);render();dialog.showModal();focus();void readAccess();if(!scorecardStart&&!calendarRepStart)void readHistory();if(phase==='inbox'){inboxLoaded=true;void readPlans();if(!calendarRepStart)void readCoach()}return {dispose,isOpen:()=>!disposed,back:requestClose}
}
