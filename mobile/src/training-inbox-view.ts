import {LEVEL_UP_CARDS} from '../../lib/level-up/level-up-cards'
import {buildWeeklyLevelUpCoachNotification,getWeeklyLevelUpPlanProgress,getWeeklyLevelUpPlanReps,getWeeklyLevelUpPlanWeekStart,selectWeeklyLevelUpPlanForMyQuest,type WeeklyLevelUpPlan,type WeeklyLevelUpPlanRep} from '../../lib/level-up/weekly-plan'
import {getCoachAssignmentSummary,getCoachAssignmentPack,getCoachAssignmentReview,getPlayerAssignmentCheckIn,getCoachAssignmentDueState,type CoachAssignment,type CoachAssignmentPack} from '../../lib/coach-storage'
import {formatWeekdayDate} from '../../lib/captain-formatters'
import {html} from './match-details'
import {trainingIdentity} from './training-identity'
import {trainingAssignmentQueue,type TrainingCoachWork} from './training-inbox-data'
export type TrainingInboxLaunch={key:string;cardId:string;identitySlug:string;label:string}
const packDrillLimit=30
const hasDrillCard=(cardId:string)=>LEVEL_UP_CARDS.some(card=>card.id===cardId)
const coachDrillKey=(assignmentId:string,cardId:string,slot?:number)=>
 JSON.stringify(slot===undefined?['coach',assignmentId,cardId]:['coach',assignmentId,cardId,slot])
const privateDrillButton=(key:string,title:string)=>`<button type="button" class="secondary" data-inbox-card="${html(key)}">Practice privately<span class="sr-only"> ${html(title)}</span></button>`
export function trainingInboxLaunches(plans:WeeklyLevelUpPlan[],work:TrainingCoachWork|null){
 const launches:TrainingInboxLaunch[]=[]
 for(const plan of plans)for(const rep of getWeeklyLevelUpPlanReps(plan)){
  if(hasDrillCard(rep.focusId))launches.push({key:JSON.stringify(['plan',plan.id,rep.id]),cardId:rep.focusId,identitySlug:rep.identitySlug,label:rep.title})
 }
 for(const assignment of work?.assignments??[]){
  const {cardId}=assignment.assignment
  const pack=getCoachAssignmentPack(assignment.assignment)
  const identitySlug=work?.links.find(link=>link.id===assignment.studentLinkId)?.identitySlug??''
  const addDrill=(id:string,slot?:number)=>{
   if(hasDrillCard(id))launches.push({key:coachDrillKey(assignment.id,id,slot),cardId:id,identitySlug,label:assignment.title})
  }
  if(pack)pack.items.slice(0,packDrillLimit).forEach((item,slot)=>addDrill(item.cardId,slot))
  else if(typeof cardId==='string')addDrill(cardId)
 }
 return launches
}
const direction=(slug:string)=>trainingIdentity(slug)?.title.replace(/^The /,'')||slug

function weeklyRepHtml(plan:WeeklyLevelUpPlan,rep:WeeklyLevelUpPlanRep,canChange:boolean,next=false){
 const hasDrill=hasDrillCard(rep.focusId)
 return `<article class="training-week-rep${next?' training-week-rep-next':''}">
  <small>${next?'Next rep · ':rep.completedAt?'Recorded complete · ':''}${html(rep.label)}</small>
  <h3>${html(rep.title)}</h3><p>${html(rep.detail)}</p>
  ${hasDrill||canChange||next?`<div class="training-week-actions">
   ${hasDrill?privateDrillButton(JSON.stringify(['plan',plan.id,rep.id]),rep.title):''}
   ${next?`<button type="button" class="secondary" data-week-schedule="${html(JSON.stringify([plan.id,rep.id]))}" data-schedule-title="${html(rep.title)}">Schedule this rep</button>`:''}
   ${canChange?`<button type="button" class="secondary" data-week-mark="${html(JSON.stringify([plan.id,rep.id]))}" data-week-completed="${!rep.completedAt}">${rep.completedAt?'Reopen rep':'Mark rep done'}<span class="sr-only"> ${html(rep.title)}</span></button>`:''}
  </div>`:''}
  ${hasDrill?'':'<p>Follow the written rep. This focus has no exact matching drill card in the app yet.</p>'}
 </article>`
}

function weeklyPlanCard(plan:WeeklyLevelUpPlan,canChange:boolean,currentWeek:string,featured=false){
 const progress=getWeeklyLevelUpPlanProgress(plan),response=plan.coachResponse
 const next=featured?progress.nextRep:null
 const otherReps=getWeeklyLevelUpPlanReps(plan).filter(rep=>rep.id!==next?.id)
 const weekDate=formatWeekdayDate(plan.weekStart)
 return `<section class="training-week">
  <h2>${plan.weekStart===currentWeek?'This week':`Week of ${html(weekDate)}`}</h2>
  <p class="training-week-meta">${html(direction(plan.identitySlug))}${plan.sharedWithCoach?' · Shared with coach':''}</p>
  <p class="training-week-meta"><strong>${progress.completed}/${progress.total} recorded complete</strong></p>
  <p>${html(plan.summary)}</p>
  ${plan.strongestFocus?`<p><strong>Strongest focus:</strong> ${html(plan.strongestFocus)}</p>`:''}
  ${response?`<aside class="training-week-rep">
   <h3>${html(buildWeeklyLevelUpCoachNotification(plan,response).title)}</h3><p>${html(response.note)}</p>
   ${response.playerReply?`<p>Your reply: ${response.playerReply.action==='acknowledged'?'Seen':'Question'}${response.playerReply.message?' · '+html(response.playerReply.message):''}</p>`:''}
   ${!response.playerReply&&plan.sharedWithCoach&&plan.studentLinkId&&plan.coachUserId?`<button type="button" class="secondary" data-week-reply="${html(plan.id)}">Reply to coach<span class="sr-only"> Week of ${html(weekDate)}</span></button>`:''}
  </aside>`:''}
  ${next?weeklyRepHtml(plan,next,canChange,true):''}
  ${featured&&otherReps.length?`<details class="training-inbox-fold" data-inbox-fold="${html(JSON.stringify(['week-reps',plan.id]))}">
   <summary>${next?'Other reps':'Week’s reps'} (${otherReps.length})</summary>
   ${otherReps.map(rep=>weeklyRepHtml(plan,rep,canChange)).join('')}
  </details>`:otherReps.map(rep=>weeklyRepHtml(plan,rep,canChange)).join('')}
 </section>`
}

export function trainingPlansHtml(plans:WeeklyLevelUpPlan[],canChange=false,requestedPlanId?:string){
 const currentWeek=getWeeklyLevelUpPlanWeekStart()
 const requested=requestedPlanId?plans.find(plan=>plan.id===requestedPlanId):undefined
 const unavailable=requestedPlanId&&!requested?'<p role="status">This saved week is unavailable.</p>':''
 const featured=requested??selectWeeklyLevelUpPlanForMyQuest(plans,currentWeek)
 if(!featured)return unavailable+'<p>No weekly plans are saved to your account yet.</p>'
 const otherWeeks=plans.filter(plan=>plan.id!==featured.id)
 return `${unavailable}${weeklyPlanCard(featured,canChange,currentWeek,true)}
  ${otherWeeks.length?`<details class="training-inbox-fold" data-inbox-fold="saved-weeks"><summary>More saved weeks (${otherWeeks.length})</summary>${otherWeeks.map(plan=>weeklyPlanCard(plan,canChange,currentWeek)).join('')}</details>`:''}
  <p class="training-inbox-note">Mark a rep done after you finish the work.${plans.length===12?' Showing the latest 12 saved plans.':''}</p>`
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

export function trainingCoachWorkHtml(work:TrainingCoachWork,now=new Date(),requestedId?:string){
 const {active,recorded}=trainingAssignmentQueue(work,now)
 const requested=requestedId?active.find(a=>a.id===requestedId):undefined
 const unavailable=requestedId&&!requested?'<p role="status">That assignment is no longer open. Here’s your latest coach work.</p>':''
 if(!work.links.length)return unavailable+'<p>No coach connection is linked to this account.</p>'
 if(!work.assignments.length)return unavailable+'<p>Coach assignments will appear here when they’re shared with you.</p>'
 const next=requested??active[0],remaining=active.filter(a=>a!==next)
 return `${unavailable}${next?assignmentCard(next,work,now,true):'<p>You’re caught up on the assignments shown here.</p>'}
  ${remaining.length?`<details class="training-inbox-fold" data-inbox-fold="more"><summary>More assigned work (${remaining.length})</summary>${remaining.map(a=>assignmentCard(a,work,now)).join('')}</details>`:''}
  ${recorded.length?`<details class="training-inbox-fold" data-inbox-fold="completed"><summary>Completed work and check-ins (${recorded.length})</summary>${recorded.map(a=>assignmentCard(a,work,now)).join('')}</details>`:''}
  <p class="training-inbox-note">Private practice does not complete an assignment or send a check-in.${work.assignments.length===100?' Showing the latest 100 assignments.':''}</p>`
}
