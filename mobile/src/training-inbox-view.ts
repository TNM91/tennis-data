import {LEVEL_UP_CARDS} from '../../lib/level-up/level-up-cards'
import {buildWeeklyLevelUpCoachNotification,getWeeklyLevelUpPlanProgress,getWeeklyLevelUpPlanReps,getWeeklyLevelUpPlanWeekStart,selectWeeklyLevelUpPlanForMyQuest,type WeeklyLevelUpPlan,type WeeklyLevelUpPlanRep} from '../../lib/level-up/weekly-plan'
import {getCoachAssignmentSummary,getCoachAssignmentPack,getCoachAssignmentReview,getPlayerAssignmentCheckIn,getCoachAssignmentDueState,type CoachAssignment,type CoachAssignmentPack} from '../../lib/coach-storage'
import {formatWeekdayDate} from '../../lib/captain-formatters'
import {html} from './match-details'
import {trainingIdentity} from './training-identity'
import {SAVED_WEEK_LIST_LIMIT,trainingAssignmentQueue,trainingCoachFeedback,type TrainingCoachWork} from './training-inbox-data'
import {trainingTime} from './level-up-model'
import type {TrainingSession} from './level-up-data'
import {calendarWeeklyRepKey,type ScheduledPracticeLinks} from './calendar-weekly-reps'
export type TrainingInboxLaunch={key:string;cardId:string;identitySlug:string;label:string;checkInAssignmentId?:string;coachCue?:string}
export type SavedWeekPractice=Pick<TrainingSession,'cardId'|'rating'|'elapsedSeconds'>&{key:string}
const packDrillLimit=30
const hasDrillCard=(cardId:string)=>LEVEL_UP_CARDS.some(card=>card.id===cardId)
export const weeklyDrillKey=(planId:string,repId:string)=>JSON.stringify(['plan',planId,repId])
const coachDrillKey=(assignmentId:string,cardId:string,slot?:number)=>
 JSON.stringify(slot===undefined?['coach',assignmentId,cardId]:['coach',assignmentId,cardId,slot])
const feedbackDrillKey=(assignmentId:string,cardId:string,slot?:number)=>
 JSON.stringify(slot===undefined?['feedback',assignmentId,cardId]:['feedback',assignmentId,cardId,slot])
const privateDrillButton=(key:string,title:string)=>`<button type="button" class="secondary" data-inbox-card="${html(key)}">Practice privately<span class="sr-only"> ${html(title)}</span></button>`

function feedbackPractice(assignment:CoachAssignment){
 const pack=getCoachAssignmentPack(assignment.assignment)
 if(pack)return {isPack:true,drills:pack.items.slice(0,packDrillLimit).flatMap(({cardId,title,proof},slot)=>
  hasDrillCard(cardId)?[{key:feedbackDrillKey(assignment.id,cardId,slot),cardId,title,proof,slot}]:[])}
 const card=LEVEL_UP_CARDS.find(card=>card.id===assignment.assignment.cardId)
 return {isPack:false,drills:card?[{key:feedbackDrillKey(assignment.id,card.id),cardId:card.id,title:card.title,proof:'',slot:0}]:[]}
}

function weeklyCoachCue(plan:WeeklyLevelUpPlan,repId:string){
 const response=plan.coachResponse
 return response?.targetRepId===repId&&(response.action==='adjusted'||response.action==='replaced')?response.note:''
}

export function trainingInboxLaunches(plans:WeeklyLevelUpPlan[],work:TrainingCoachWork|null,feedbackId?:string){
 const launches:TrainingInboxLaunch[]=[]
 for(const plan of plans)for(const rep of getWeeklyLevelUpPlanReps(plan)){
  if(!hasDrillCard(rep.focusId))continue
  const coachCue=weeklyCoachCue(plan,rep.id)
  launches.push({key:weeklyDrillKey(plan.id,rep.id),cardId:rep.focusId,identitySlug:rep.identitySlug,label:rep.title,...(coachCue?{coachCue}:{})})
 }
 for(const assignment of work?.assignments??[]){
  const {cardId}=assignment.assignment
  const pack=getCoachAssignmentPack(assignment.assignment)
  const identitySlug=work?.links.find(link=>link.id===assignment.studentLinkId)?.identitySlug??''
  const addDrill=(id:string,slot?:number)=>{
   if(hasDrillCard(id))launches.push({key:coachDrillKey(assignment.id,id,slot),cardId:id,identitySlug,label:assignment.title,
    ...(!pack?{checkInAssignmentId:assignment.id}:{})})
  }
  if(pack)pack.items.slice(0,packDrillLimit).forEach((item,slot)=>addDrill(item.cardId,slot))
  else if(typeof cardId==='string')addDrill(cardId)
 }
 const feedback=work?trainingCoachFeedback(work,feedbackId):undefined
 if(feedback){
  const link=work?.links.find(link=>link.id===feedback.assignment.studentLinkId)
  for(const {key,cardId} of feedbackPractice(feedback.assignment).drills){
   launches.push({key,cardId,identitySlug:link?.identitySlug??'',label:feedback.assignment.title,coachCue:feedback.review.nextFocus})
  }
 }
 return launches
}
const direction=(slug:string)=>trainingIdentity(slug)?.title.replace(/^The /,'')||slug

export function trainingWeekPracticeReceiptHtml(receipt:SavedWeekPractice){
 return `<div class="training-week-practice-receipt" id="week-practice-receipt" role="status">
  <strong>Practice saved</strong><p>Self-rated proof ${receipt.rating} / 5 · ${trainingTime(receipt.elapsedSeconds)} timed</p>
 </div>`
}

type PracticeDates={links:ScheduledPracticeLinks;alreadyInCalendar:boolean}

function weeklyRepHtml(plan:WeeklyLevelUpPlan,rep:WeeklyLevelUpPlanRep,canChange:boolean,next=false,savedPractice?:SavedWeekPractice,dates?:PracticeDates){
 const hasDrill=hasDrillCard(rep.focusId)
 const key=weeklyDrillKey(plan.id,rep.id)
 const receipt=hasDrill&&savedPractice?.key===key&&savedPractice.cardId===rep.focusId?savedPractice:undefined
 const ready=Boolean(receipt&&canChange&&!rep.completedAt)
 const mark=canChange?`<button type="button" class="secondary" data-week-mark="${html(JSON.stringify([plan.id,rep.id]))}" data-week-completed="${!rep.completedAt}"${ready?' aria-describedby="week-practice-receipt"':''}>${rep.completedAt?'Reopen rep':'Mark rep done'}<span class="sr-only"> ${html(rep.title)}</span></button>`:''
 const linked=dates?.links.get(calendarWeeklyRepKey({planId:plan.id,repId:rep.id,identitySlug:plan.identitySlug,weekStart:plan.weekStart}))
 const titleId='training-rep-'+encodeURIComponent(key)
 const practiceDate=linked
  ?dates?.alreadyInCalendar?'':`<button type="button" class="secondary" data-week-calendar="${html(rep.id)}" aria-describedby="${html(titleId)}">${linked.count>1?'View latest practice date':'View practice date'}</button>`
  :next?`<button type="button" class="secondary" data-week-schedule="${html(rep.id)}" data-schedule-title="${html(rep.title)}">Schedule this rep</button>`:''
 return `<article class="training-week-rep${next?' training-week-rep-next':''}${ready?' training-week-rep-ready':''}">
  <small>${next?'Next rep · ':rep.completedAt?'Recorded complete · ':''}${html(rep.label)}${weeklyCoachCue(plan,rep.id)?' · Coach cue':''}</small>
  <h3 data-week-rep="${html(rep.id)}" tabindex="-1"${linked&&!dates?.alreadyInCalendar?` id="${html(titleId)}"`:''}>${html(rep.title)}</h3><p>${html(rep.detail)}</p>
  ${receipt?trainingWeekPracticeReceiptHtml(receipt):''}
  ${hasDrill||canChange||practiceDate?`<div class="training-week-actions">
   ${ready?mark:''}
   ${hasDrill?privateDrillButton(key,rep.title):''}
   ${practiceDate}
   ${ready?'':mark}
  </div>`:''}
  ${hasDrill?'':'<p>Follow the written rep. This focus has no exact matching drill card in the app yet.</p>'}
 </article>`
}

function weeklyPlanCard(plan:WeeklyLevelUpPlan,canChange:boolean,currentWeek:string,featured=false,savedPractice?:SavedWeekPractice,dates?:PracticeDates){
 const progress=getWeeklyLevelUpPlanProgress(plan),response=plan.coachResponse
 const reps=getWeeklyLevelUpPlanReps(plan)
 const coachedRep=reps.find(rep=>weeklyCoachCue(plan,rep.id))
 const next=featured?progress.nextRep:null
 const otherReps=reps.filter(rep=>rep.id!==next?.id)
 const weekDate=formatWeekdayDate(plan.weekStart)
 return `<section class="training-week" data-week-plan="${html(plan.id)}">
  <h2 tabindex="-1">${plan.weekStart===currentWeek?'This week':`Week of ${html(weekDate)}`}</h2>
  <p class="training-week-meta">${html(direction(plan.identitySlug))}${plan.sharedWithCoach?' · Shared with coach':''}</p>
  <div class="training-week-progress"${progress.complete?' data-week-complete':''}>
   <p class="training-week-meta"><strong>${progress.completed} of ${progress.total} ${progress.total===1?'rep':'reps'} complete</strong></p>
   <div class="training-week-progress-track" aria-hidden="true">${reps.map(rep=>`<span${rep.completedAt?' data-rep-complete':''}></span>`).join('')}</div>
  </div>
  ${response?`<aside class="training-week-rep">
   <h3>${html(buildWeeklyLevelUpCoachNotification(plan,response).title)}</h3>
   ${coachedRep?`<p class="training-week-meta">For ${html(coachedRep.title)}</p>`:''}
   ${response.note?`<p>${html(response.note)}</p>`:''}
   ${response.playerReply?`<p>Your reply: ${response.playerReply.action==='acknowledged'?'Seen':'Question'}${response.playerReply.message?' · '+html(response.playerReply.message):''}</p>`:''}
   ${!response.playerReply&&plan.sharedWithCoach&&plan.studentLinkId&&plan.coachUserId?`<button type="button" class="secondary" data-week-reply="${html(plan.id)}">Reply to coach<span class="sr-only"> Week of ${html(weekDate)}</span></button>`:''}
  </aside>`:''}
  ${next?weeklyRepHtml(plan,next,canChange,true,savedPractice,dates):''}
  <p>${html(plan.summary)}</p>
  ${plan.strongestFocus?`<p><strong>Strongest focus</strong> · ${html(plan.strongestFocus)}</p>`:''}
  ${featured&&otherReps.length?`<details class="training-inbox-fold" data-inbox-fold="${html(JSON.stringify(['week-reps',plan.id]))}">
   <summary>${next?'Other reps':'Completed reps'} (${otherReps.length})</summary>
   ${otherReps.map(rep=>weeklyRepHtml(plan,rep,canChange,false,savedPractice,dates)).join('')}
  </details>`:otherReps.map(rep=>weeklyRepHtml(plan,rep,canChange,false,savedPractice,dates)).join('')}
 </section>`
}

export function trainingPlansHtml(plans:WeeklyLevelUpPlan[],canChange=false,requestedPlanId?:string,savedPractice?:SavedWeekPractice,dates?:PracticeDates){
 const currentWeek=getWeeklyLevelUpPlanWeekStart()
 const requested=requestedPlanId?plans.find(plan=>plan.id===requestedPlanId):undefined
 const unavailable=requestedPlanId&&!requested?'<p role="status">This saved week is unavailable.</p>':''
 const featured=requested??selectWeeklyLevelUpPlanForMyQuest(plans,currentWeek)
 if(!featured)return unavailable+'<p>No weekly plans are saved to your account yet.</p>'
 const otherWeeks=plans.filter(plan=>plan.id!==featured.id)
 return `${unavailable}${weeklyPlanCard(featured,canChange,currentWeek,true,savedPractice,dates)}
  ${otherWeeks.length?`<details class="training-inbox-fold" data-inbox-fold="saved-weeks"><summary>More saved weeks (${otherWeeks.length})</summary>${otherWeeks.map(plan=>weeklyPlanCard(plan,canChange,currentWeek,false,savedPractice,dates)).join('')}</details>`:''}
  <p class="training-inbox-note">Mark a rep done after you finish the work.${plans.length===SAVED_WEEK_LIST_LIMIT?` Showing up to ${SAVED_WEEK_LIST_LIMIT} saved plans.`:''}</p>`
}
const packDrillStatus={assigned:'Assigned',started:'Started',completed:'Completed',skipped:'Skipped'}
function assignmentPackHtml(assignment:CoachAssignment,pack:CoachAssignmentPack,done:boolean){
 const entries=pack.items.slice(0,packDrillLimit).map((item,slot)=>({item,slot}))
 const next=done?undefined:entries.find(({item})=>item.status==='assigned'||item.status==='started')
 const others=entries.filter(entry=>entry!==next)
 const drillRow=({item,slot}:typeof entries[number],upNext=false)=>`<li class="training-pack-drill"${upNext?' data-pack-next':''}>
  <div class="training-pack-meta"><small>${upNext?'Next drill':'Drill'} · ${slot+1} of ${pack.items.length}</small><span data-pack-status="${item.status}">${packDrillStatus[item.status]}</span></div>
  <strong class="training-pack-drill-title">${html(item.title)}</strong>
  ${item.proof?`<p><strong>Track</strong> ${html(item.proof)}</p>`:''}
  ${hasDrillCard(item.cardId)?privateDrillButton(coachDrillKey(assignment.id,item.cardId,slot),item.title):''}
 </li>`
 return `<div class="training-assignment-pack">
  <h3>${html(pack.title===assignment.title?'Practice pack':pack.title)}</h3>
  ${next?`<ol class="training-pack-drills" role="list">${drillRow(next,true)}</ol>`:''}
  ${others.length?`<details class="training-inbox-fold training-pack-fold" data-inbox-fold="${html(JSON.stringify(['pack',assignment.id]))}">
   <summary>${next?'Other drills':'Pack drills'} (${others.length})</summary>
   <ol class="training-pack-drills" role="list">${others.map(entry=>drillRow(entry)).join('')}</ol>
  </details>`:''}
  ${pack.items.length>packDrillLimit?`<p>Showing the first ${packDrillLimit} pack drills.</p>`:''}
 </div>`
}

function assignmentCard(a:CoachAssignment,work:TrainingCoachWork,now:Date,featured=false){
 const summary=getCoachAssignmentSummary(a.assignment),pack=getCoachAssignmentPack(a.assignment)
 const review=getCoachAssignmentReview(a.assignment),checkIn=getPlayerAssignmentCheckIn(a.assignment)
 const due=getCoachAssignmentDueState(a.dueDate,now),done=a.status==='completed'||Boolean(checkIn)
 const dueLabel=due.tone==='future'?'Due later':due.label
 const link=work.links.find(l=>l.id===a.studentLinkId)
 const card=pack?undefined:LEVEL_UP_CARDS.find(card=>card.id===a.assignment.cardId)
 const drillButton=card?privateDrillButton(coachDrillKey(a.id,card.id),card.title):''
 const packTargets=new Set(pack?.items.slice(0,packDrillLimit).map(item=>`${item.title}: ${item.proof}`))
 const tracker=summary.tracker.filter(item=>!packTargets.has(item))
 const checkInButton=done?'':`<button type="button" data-coach-checkin="${html(a.id)}">Open check-in<span class="sr-only"> ${html(a.title)}</span></button>`
 return `<section class="training-assignment${featured?' training-assignment-next':''}">
  <div class="training-assignment-meta">${featured?'<small>Up next</small>':''}<span data-due-tone="${done?'done':due.tone}">${done?(a.status==='completed'?'Completed':'Checked in'):html(dueLabel)}</span></div>
  <h2>${html(a.title)}</h2>
  ${a.dueDate||link?.status==='paused'?`<p class="training-assignment-date">${a.dueDate?`<time datetime="${html(a.dueDate)}">${html(formatWeekdayDate(a.dueDate))}</time>`:''}${link?.status==='paused'?`${a.dueDate?' · ':''}Coach connection paused`:''}</p>`:''}
  ${a.focus?`<p>${html(a.focus)}</p>`:''}
  ${pack?assignmentPackHtml(a,pack,done):''}
  ${summary.detail?`<p>${html(summary.detail)}</p>`:''}${summary.volume?`<p>${html(summary.volume)}</p>`:''}
  ${tracker.length?`<ul>${tracker.map(t=>`<li>${html(t)}</li>`).join('')}</ul>`:''}
  ${summary.expectedEvidence?`<p class="training-assignment-proof"><strong>Proof to bring</strong> ${html(summary.expectedEvidence)}</p>`:''}
  ${summary.prompt?`<p>${html(summary.prompt)}</p>`:''}
  ${review?`<h3>Coach feedback</h3><p>${html(review.note)}</p><p><strong>Next focus:</strong> ${html(review.nextFocus)}</p>`:''}
  ${checkIn?`<h3>Your recorded check-in</h3><p>${html(checkIn.recap)}</p><p>${html(checkIn.evidence)}</p>`:''}
  ${drillButton||checkInButton?`<div class="training-assignment-actions">${drillButton}${checkInButton}</div>`:''}
 </section>`
}

export function trainingCoachCueHtml(cue:string){
 return cue?`<div class="training-coach-cue"><strong>Coach’s practice cue</strong><p>${html(cue)}</p></div>`:''
}

function feedbackPracticeHtml(assignment:CoachAssignment){
 const {drills,isPack}=feedbackPractice(assignment)
 if(!drills.length)return ''
 if(!isPack){
  const [drill]=drills
  return `<button type="button" class="secondary" data-inbox-card="${html(drill.key)}">Revisit ${html(drill.title)}</button>`
 }
 return `<details class="training-inbox-fold training-feedback-drills" data-inbox-fold="${html(JSON.stringify(['feedback-pack',assignment.id]))}">
  <summary>Revisit pack drills (${drills.length})</summary>
  <div class="native-entry-list">${drills.map(({key,title,proof,slot})=>{
   const id=`training-feedback-drill-${slot}`
   return `<button type="button" class="secondary app-tool" data-inbox-card="${html(key)}" aria-labelledby="${id}-title"${proof?` aria-describedby="${id}-proof"`:''}>
    <span class="app-tool-copy"><strong id="${id}-title"><span class="sr-only">Revisit </span>${html(title)}</strong>${proof?`<span id="${id}-proof">${html(proof)}</span>`:''}</span>
    <span class="app-tool-arrow" aria-hidden="true">›</span>
   </button>`
  }).join('')}</div>
 </details>`
}

function coachFeedbackHtml(feedback:NonNullable<ReturnType<typeof trainingCoachFeedback>>,requested:boolean){
 const {assignment,review}=feedback
 const date=new Date(review.reviewedAt)
 return `<section class="training-coach-feedback" aria-labelledby="training-coach-feedback-title">
  <div class="training-assignment-meta"><small>${requested?'Coach feedback':'Latest coach feedback'}</small>
   ${Number.isFinite(date.getTime())?`<time datetime="${date.toISOString()}">${html(date.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}))}</time>`:''}
  </div>
  <h2 id="training-coach-feedback-title" tabindex="-1" data-coach-feedback-focus>${html(assignment.title)}</h2>
  ${review.note?`<p class="training-coach-feedback-note">${html(review.note)}</p>`:''}
  ${trainingCoachCueHtml(review.nextFocus)}
  ${feedbackPracticeHtml(assignment)}
 </section>`
}

export function trainingCoachWorkHtml(work:TrainingCoachWork,now=new Date(),requestedId?:string,feedbackId?:string){
 const {active,recorded}=trainingAssignmentQueue(work,now)
 const requested=requestedId?active.find(a=>a.id===requestedId):undefined
 const feedback=trainingCoachFeedback(work,feedbackId)
 const unavailable=(requestedId&&!requested?'<p role="status">That assignment is no longer open. Here’s your latest coach work.</p>':'')
  +(feedbackId&&!feedback?'<p role="status" tabindex="-1" data-coach-feedback-focus>That coach feedback is unavailable.</p>':'')
 if(!work.links.length)return unavailable+'<p>No coach connection is linked to this account.</p>'
 if(!work.assignments.length)return unavailable+'<p>Coach assignments will appear here when they’re shared with you.</p>'
 const next=requested??active[0],remaining=active.filter(a=>a!==next)
 const feedbackCard=feedback?coachFeedbackHtml(feedback,Boolean(feedbackId)):''
 return `${unavailable}${feedbackId?feedbackCard:''}${next?assignmentCard(next,work,now,true):'<p>You’re caught up on the assignments shown here.</p>'}
  ${feedbackId?'':feedbackCard}
  ${remaining.length?`<details class="training-inbox-fold" data-inbox-fold="more"><summary>More assigned work (${remaining.length})</summary>${remaining.map(a=>assignmentCard(a,work,now)).join('')}</details>`:''}
  ${recorded.length?`<details class="training-inbox-fold" data-inbox-fold="completed"><summary>Completed work and check-ins (${recorded.length})</summary>${recorded.map(a=>assignmentCard(a,work,now)).join('')}</details>`:''}
  <p class="training-inbox-note">Private practice does not complete an assignment or send a check-in.${work.assignments.length===100?' Showing the latest 100 assignments.':''}</p>`
}
