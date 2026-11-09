import {buildPlayerAssignmentCompletion,type CoachAssignment} from '../../lib/coach-storage'
import {LEVEL_UP_CARDS} from '../../lib/level-up/level-up-cards'
import {PLAYER_DEVELOPMENT_IDENTITIES} from '../../lib/player-development'
import {buildWeeklyLevelUpCoachResponse,getWeeklyLevelUpPlanWeekStart,toggleWeeklyLevelUpPlanRep,type WeeklyLevelUpPlan} from '../../lib/level-up/weekly-plan'
import {localCalendarDate,shiftCalendarDay} from '../../mobile/src/calendar-data'
import type {TrainingSave} from '../../mobile/src/level-up-data'
import {freezeTrainingSave} from '../../mobile/src/level-up-model'
import {navigationOwner} from './mobile-navigation-client'

const today=localCalendarDate(),updatedAt=new Date().toISOString(),identitySlug='relentless-competitor-4-0'
const link={id:'training-link',playerUserId:navigationOwner,identitySlug,status:'active'}
const overdue:CoachAssignment={
 id:'training-return',studentLinkId:link.id,title:'Return depth under pressure',focus:'Recover before your next shot.',
 dueDate:shiftCalendarDay(today,-1),status:'assigned',updatedAt,
 assignment:{cardId:'split-step-rhythm',detail:'Start with five crosscourt returns.',expectedEvidence:'Count the returns that land past the service line.'},
}
if(new URL(location.href).searchParams.has('training-practice-pack')){
 overdue.assignment.levelUpPack={id:'return-pack',title:'Return and recover',focus:'Return depth',items:[
  {cardId:'split-step-rhythm',title:'Warm up the split step',proof:'Land before the toss peaks.',status:'completed'},
  {cardId:'split-step-rhythm',title:'Split before the return',proof:'Land as your opponent makes contact.',status:'started'},
  {cardId:'double-fault-reset',title:'Reset under pressure',proof:'Pick a clear target.',status:'assigned'},
  {cardId:'legacy-return-card',title:'Finish at the baseline',proof:'Hold your recovery position.',status:'assigned'},
 ]}
}
const assignments:CoachAssignment[]=[
 {...overdue,id:'training-serve',title:'Second-serve targets',dueDate:shiftCalendarDay(today,1),assignment:{detail:'Hit five serves to each target.'}},
 {...overdue,id:'training-finished',title:'Baseline recovery drill',status:'completed',assignment:buildPlayerAssignmentCompletion({}, {recap:'Balanced on the first step.',evidence:'Four of five.'})},
 overdue,
]
const assignmentFeedback=new URL(location.href).searchParams.has('training-assignment-feedback')
const trainingFeedbackFixture={newReview:false,practiceSaves:0,assignmentWrites:0}
if(assignmentFeedback){
 const finished=assignments[1]
 if(overdue.assignment.levelUpPack){
  finished.assignment=buildPlayerAssignmentCompletion({levelUpPack:overdue.assignment.levelUpPack},{recap:'Balanced on the first step.',evidence:'Four of five.'})
 }
 finished.assignment={...finished.assignment,cardId:'split-step-rhythm',coachReview:{
  note:'Your first step stayed balanced under pressure.',nextFocus:'Recover toward the center after the return.',reviewedAt:'2026-11-06T18:00:00Z',
 }}
 Object.assign(window,{trainingFeedbackFixture})
}
const weekStart=getWeeklyLevelUpPlanWeekStart()
const currentPlan:WeeklyLevelUpPlan={
 version:1,id:'training-week',identitySlug,weekStart,summary:'A better first step',strongestFocus:'Recovery',
 sharedWithCoach:false,coachUserId:null,studentLinkId:null,coachResponse:null,createdAt:updatedAt,updatedAt,
 reps:[
  {id:'training-finished-rep',kind:'repeat',focusId:'split-recover-loop',identitySlug,label:'Repeat',title:'Recover after contact',detail:'Return to ready position.',href:'/level-up/'+identitySlug,completedAt:updatedAt},
  {id:'training-rep',kind:'repeat',focusId:'split-step-rhythm',identitySlug,label:'Repeat',title:'Split and recover',detail:'Land the split before contact.',href:'/level-up/'+identitySlug,completedAt:null},
  {id:'training-serve-rep',kind:'balance',focusId:'double-fault-reset',identitySlug,label:'Practice',title:'Serve to a target',detail:'Choose a big second-serve target.',href:'/level-up/'+identitySlug,completedAt:null},
 ],
}
const plans=[currentPlan,{...currentPlan,id:'training-previous-week',weekStart:shiftCalendarDay(weekStart,-7),summary:'Hold depth on the move',reps:[{...currentPlan.reps[1],title:'Move through the return'}]}]
if(new URL(location.href).searchParams.has('training-week-coach-cue')){
 const coachUserId='synthetic-coach'
 const coachResponse=buildWeeklyLevelUpCoachResponse(currentPlan,{
  action:'replaced',targetRepId:currentPlan.reps[1].id,note:'Call your target before the second serve.',
  replacementRep:{...currentPlan.reps[2],id:'coach-selected-serve',title:'Reset before the second serve'},
 },coachUserId)
 plans[0]={...currentPlan,sharedWithCoach:true,coachUserId,studentLinkId:link.id,coachResponse}
}
if(new URL(location.href).searchParams.has('training-coach-update')){
 const coachUserId='synthetic-coach',previous=plans[1]
 plans[1]={...previous,sharedWithCoach:true,coachUserId,studentLinkId:link.id,coachResponse:{action:'adjusted',note:'Recover toward the center after the return.',targetRepId:previous.reps[0].id,replacementRep:null,coachUserId,updatedAt,playerReply:{action:'acknowledged',message:'',playerUserId:navigationOwner,updatedAt}}}
}
const sessions:(TrainingSave&{playerUserId:string;sessionJson:{cardId:string}})[]=[]
const historyPreview=new URL(location.href).searchParams.has('training-history-review')
let historyReads=0
if(historyPreview){
 for(const [index,cardId] of ['split-step-rhythm','double-fault-reset'].entries()){
  const card=LEVEL_UP_CARDS.find(item=>item.id===cardId)!
  const date=new Date(Date.now()-index*86_400_000).toISOString()
  const saved=freezeTrainingSave(card,4-index,index===0?'Landed the split before contact.':'Picked a clear target.','alone','ready',600-index*300,
   'level-up-11111111-1111-4111-8111-00000000000'+index,date,identitySlug)
  sessions.push({...saved,playerUserId:navigationOwner,sessionJson:{cardId}})
 }
}
export function trainingInboxPreview(url:URL,method:string,body?:BodyInit|null){
 if(!new URL(location.href).searchParams.has('training-inbox-review'))return null
 if(url.pathname==='/api/player/level-up-sessions'){
  if(method==='GET'){
   if(historyPreview&&++historyReads===2)return Response.json({ok:false},{status:503})
   return Response.json({ok:true,sessions})
  }
  if(method!=='POST')return Response.json({ok:false},{status:405})
  trainingFeedbackFixture.practiceSaves++
  const saved:TrainingSave=JSON.parse(String(body)).session
  const session={...saved,playerUserId:navigationOwner,sessionJson:{cardId:saved.cardId}}
  sessions.push(session)
  if(new URL(location.href).searchParams.has('training-session-lost-response'))return Response.json({ok:false},{status:503})
  return Response.json({ok:true,session})
 }
 if(url.pathname==='/api/player/level-up-weekly-plan'){
  if(method==='GET'){
   const slug=url.searchParams.get('identitySlug'),start=url.searchParams.get('weekStart')
   if(!slug&&!start&&new URL(location.href).searchParams.has('training-week-list-full')){
    const otherWeeks=PLAYER_DEVELOPMENT_IDENTITIES.filter(identity=>identity.slug!==identitySlug).map(identity=>({
     ...currentPlan,id:`other-${identity.slug}`,identitySlug:identity.slug,
    }))
    return Response.json({ok:true,plans:otherWeeks})
   }
   return Response.json({ok:true,plans:plans.filter(plan=>(!slug||plan.identitySlug===slug)&&(!start||plan.weekStart===start))})
  }
  if(method==='POST'){
   const {plan,createOnly}=JSON.parse(String(body)) as {plan:WeeklyLevelUpPlan;createOnly:boolean}
   if(createOnly&&plans.some(row=>row.identitySlug===plan.identitySlug&&row.weekStart===plan.weekStart))return Response.json({ok:false},{status:409})
   plans.unshift(plan)
   if(new URL(location.href).searchParams.has('training-week-lost-response'))return Response.json({ok:false},{status:503})
   return Response.json({ok:true,plan})
  }
  if(method!=='PATCH')return Response.json({ok:false},{status:405})
  const input=JSON.parse(String(body)),index=plans.findIndex(plan=>plan.id===input.planId)
  const plan=plans[index],rep=plan?.reps.find(rep=>rep.id===input.repId)
  if(input.action!=='set_rep_completion'||typeof input.completed!=='boolean'||!rep||plan.updatedAt!==input.expectedUpdatedAt)return Response.json({ok:false},{status:409})
  if(Boolean(rep.completedAt)!==input.completed)plans[index]=toggleWeeklyLevelUpPlanRep(plan,rep.id)
  if(new URL(location.href).searchParams.has('training-week-lost-response'))return Response.json({ok:false},{status:503})
  return Response.json({ok:true,plan:plans[index]})
 }
 if(url.pathname!=='/api/player/coach-assignments')return null
 if(method==='GET'){
  const latest=assignmentFeedback&&trainingFeedbackFixture.newReview?[{...assignments[1],id:'training-new-review',title:'Serve placement review',assignment:{
   coachReview:{note:'Your toss is more consistent.',nextFocus:'Place the second serve to the backhand.',reviewedAt:'2026-11-07T18:00:00Z'},
  }}]:[]
  return Response.json({ok:true,coachLinks:[link],assignments:[...assignments,...latest]})
 }
 if(method!=='PATCH')return Response.json({ok:false},{status:405})
 trainingFeedbackFixture.assignmentWrites++
 const input=JSON.parse(String(body))
 const found=assignments.find(a=>a.id===input.assignmentId&&a.status==='assigned'&&a.updatedAt===input.expectedUpdatedAt)
 if(!found)return Response.json({ok:false},{status:409})
 found.assignment=buildPlayerAssignmentCompletion(found.assignment,{recap:input.recap,evidence:input.evidence})
 found.status='completed';found.updatedAt=new Date().toISOString()
 if(new URL(location.href).searchParams.has('training-check-in-lost-response'))return Response.json({ok:false},{status:503})
 return Response.json({ok:true,assignment:found})
}
