import {LEVEL_UP_CARDS} from '../../lib/level-up/level-up-cards'
import {buildWeeklyLevelUpCoachNotification,getWeeklyLevelUpPlanProgress,getWeeklyLevelUpPlanReps,getWeeklyLevelUpPlanWeekStart,selectWeeklyLevelUpPlanForMyQuest,type WeeklyLevelUpPlan,type WeeklyLevelUpPlanRep} from '../../lib/level-up/weekly-plan'
import {getCoachAssignmentSummary,getCoachAssignmentPack,getCoachAssignmentReview,getPlayerAssignmentCheckIn,getCoachAssignmentDueState,sortPlayerAssignmentsForAction,type CoachAssignment} from '../../lib/coach-storage'
import {formatWeekdayDate} from '../../lib/captain-formatters'
import {html} from './match-details'
import {trainingIdentity} from './training-identity'
import type {TrainingCoachWork} from './training-inbox-data'
export type TrainingInboxLaunch={key:string;cardId:string;identitySlug:string;label:string}
export function trainingInboxLaunches(plans:WeeklyLevelUpPlan[],work:TrainingCoachWork|null){const launches:TrainingInboxLaunch[]=[];for(const p of plans)for(const rep of getWeeklyLevelUpPlanReps(p))if(LEVEL_UP_CARDS.some(c=>c.id===rep.focusId))launches.push({key:JSON.stringify(['plan',p.id,rep.id]),cardId:rep.focusId,identitySlug:rep.identitySlug,label:rep.title});for(const a of work?.assignments||[]){const pack=getCoachAssignmentPack(a.assignment),ids=pack?pack.items.slice(0,30).map(i=>i.cardId):typeof a.assignment.cardId==='string'?[a.assignment.cardId]:[];for(const id of new Set(ids))if(LEVEL_UP_CARDS.some(c=>c.id===id))launches.push({key:JSON.stringify(['coach',a.id,id]),cardId:id,identitySlug:work?.links.find(l=>l.id===a.studentLinkId)?.identitySlug||'',label:a.title})}return launches}
const direction=(slug:string)=>trainingIdentity(slug)?.title.replace(/^The /,'')||slug

function weeklyRepHtml(plan:WeeklyLevelUpPlan,rep:WeeklyLevelUpPlanRep,canChange:boolean,next=false){
 const hasDrill=LEVEL_UP_CARDS.some(card=>card.id===rep.focusId)
 return `<article class="training-week-rep${next?' training-week-rep-next':''}">
  <small>${next?'Next rep · ':rep.completedAt?'Recorded complete · ':''}${html(rep.label)}</small>
  <h3>${html(rep.title)}</h3><p>${html(rep.detail)}</p>
  ${hasDrill||canChange||next?`<div class="training-week-actions">
   ${hasDrill?`<button type="button" class="secondary" data-inbox-card="${html(JSON.stringify(['plan',plan.id,rep.id]))}">Practice privately<span class="sr-only"> ${html(rep.title)}</span></button>`:''}
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
function assignmentCard(a:CoachAssignment,work:TrainingCoachWork,now:Date,featured=false){
 const summary=getCoachAssignmentSummary(a.assignment),pack=getCoachAssignmentPack(a.assignment)
 const review=getCoachAssignmentReview(a.assignment),checkIn=getPlayerAssignmentCheckIn(a.assignment)
 const due=getCoachAssignmentDueState(a.dueDate,now),done=a.status==='completed'||Boolean(checkIn)
 const dueLabel=due.tone==='future'?'Due later':due.label
 const link=work.links.find(l=>l.id===a.studentLinkId),launches=trainingInboxLaunches([],{links:work.links,assignments:[a]})
 const drillButtons=launches.map(l=>`<button type="button" class="secondary" data-inbox-card="${html(l.key)}">Practice privately<span class="sr-only"> ${html(LEVEL_UP_CARDS.find(c=>c.id===l.cardId)!.title)}</span></button>`).join('')
 const checkInButton=done?'':`<button type="button" data-coach-checkin="${html(a.id)}">Open check-in<span class="sr-only"> ${html(a.title)}</span></button>`
 return `<section class="training-assignment${featured?' training-assignment-next':''}">
  <div class="training-assignment-meta">${featured?'<small>Up next</small>':''}<span data-due-tone="${done?'done':due.tone}">${done?(a.status==='completed'?'Completed':'Checked in'):html(dueLabel)}</span></div>
  <h2>${html(a.title)}</h2>
  ${a.dueDate||link?.status==='paused'?`<p class="training-assignment-date">${a.dueDate?`<time datetime="${html(a.dueDate)}">${html(formatWeekdayDate(a.dueDate))}</time>`:''}${link?.status==='paused'?`${a.dueDate?' · ':''}Coach connection paused`:''}</p>`:''}
  ${a.focus?`<p>${html(a.focus)}</p>`:''}${summary.detail?`<p>${html(summary.detail)}</p>`:''}${summary.volume?`<p>${html(summary.volume)}</p>`:''}
  ${summary.tracker.length?`<ul>${summary.tracker.map(t=>`<li>${html(t)}</li>`).join('')}</ul>`:''}
  ${summary.expectedEvidence?`<p class="training-assignment-proof"><strong>Proof to bring</strong> ${html(summary.expectedEvidence)}</p>`:''}
  ${summary.prompt?`<p>${html(summary.prompt)}</p>`:''}
  ${pack?`<h3>${html(pack.title)}</h3><ol>${pack.items.slice(0,30).map(i=>`<li>${html(i.title)} · ${html(i.status)}<p>${html(i.proof)}</p></li>`).join('')}</ol>${pack.items.length>30?'<p>Showing the first 30 pack cards.</p>':''}`:''}
  ${review?`<h3>Coach feedback</h3><p>${html(review.note)}</p><p><strong>Next focus:</strong> ${html(review.nextFocus)}</p>`:''}
  ${checkIn?`<h3>Your recorded check-in</h3><p>${html(checkIn.recap)}</p><p>${html(checkIn.evidence)}</p>`:''}
  ${drillButtons||checkInButton?`<div class="training-assignment-actions">${drillButtons}${checkInButton}</div>`:''}
 </section>`
}

export function trainingCoachWorkHtml(work:TrainingCoachWork,now=new Date()){
 if(!work.links.length)return '<p>No coach connection is linked to this account.</p>'
 if(!work.assignments.length)return '<p>Coach assignments will appear here when they’re shared with you.</p>'
 const active:CoachAssignment[]=[],recorded:CoachAssignment[]=[]
 for(const assignment of sortPlayerAssignmentsForAction(work.assignments,now)){
  const target=assignment.status==='assigned'&&!getPlayerAssignmentCheckIn(assignment.assignment)?active:recorded
  target.push(assignment)
 }
 const [next,...remaining]=active
 return `${next?assignmentCard(next,work,now,true):'<p>You’re caught up on the assignments shown here.</p>'}
  ${remaining.length?`<details class="training-inbox-fold" data-inbox-fold="more"><summary>More assigned work (${remaining.length})</summary>${remaining.map(a=>assignmentCard(a,work,now)).join('')}</details>`:''}
  ${recorded.length?`<details class="training-inbox-fold" data-inbox-fold="completed"><summary>Completed work and check-ins (${recorded.length})</summary>${recorded.map(a=>assignmentCard(a,work,now)).join('')}</details>`:''}
  <p class="training-inbox-note">Private practice does not complete an assignment or send a check-in.${work.assignments.length===100?' Showing the latest 100 assignments.':''}</p>`
}
