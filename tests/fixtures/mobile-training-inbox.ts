import {buildPlayerAssignmentCompletion,type CoachAssignment} from '../../lib/coach-storage'
import {getWeeklyLevelUpPlanWeekStart,toggleWeeklyLevelUpPlanRep,type WeeklyLevelUpPlan} from '../../lib/level-up/weekly-plan'
import {localCalendarDate,shiftCalendarDay} from '../../mobile/src/calendar-data'
import type {TrainingSave} from '../../mobile/src/level-up-data'
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
if(new URL(location.href).searchParams.has('training-coach-update')){
 const coachUserId='synthetic-coach',previous=plans[1]
 plans[1]={...previous,sharedWithCoach:true,coachUserId,studentLinkId:link.id,coachResponse:{action:'adjusted',note:'Recover toward the center after the return.',targetRepId:previous.reps[0].id,replacementRep:null,coachUserId,updatedAt,playerReply:{action:'acknowledged',message:'',playerUserId:navigationOwner,updatedAt}}}
}
const sessions:(TrainingSave&{playerUserId:string;sessionJson:{cardId:string}})[]=[]
export function trainingInboxPreview(url:URL,method:string,body?:BodyInit|null){
 if(!new URL(location.href).searchParams.has('training-inbox-review'))return null
 if(url.pathname==='/api/player/level-up-sessions'){
  if(method==='GET')return Response.json({ok:true,sessions})
  if(method!=='POST')return Response.json({ok:false},{status:405})
  const saved:TrainingSave=JSON.parse(String(body)).session
  const session={...saved,playerUserId:navigationOwner,sessionJson:{cardId:saved.cardId}}
  sessions.push(session)
  return Response.json({ok:true,session})
 }
 if(url.pathname==='/api/player/level-up-weekly-plan'){
  if(method==='GET')return Response.json({ok:true,plans})
  if(method!=='PATCH')return Response.json({ok:false},{status:405})
  const input=JSON.parse(String(body)),index=plans.findIndex(plan=>plan.id===input.planId)
  const plan=plans[index],rep=plan?.reps.find(rep=>rep.id===input.repId)
  if(input.action!=='set_rep_completion'||typeof input.completed!=='boolean'||!rep||plan.updatedAt!==input.expectedUpdatedAt)return Response.json({ok:false},{status:409})
  if(Boolean(rep.completedAt)!==input.completed)plans[index]=toggleWeeklyLevelUpPlanRep(plan,rep.id)
  return Response.json({ok:true,plan:plans[index]})
 }
 if(url.pathname!=='/api/player/coach-assignments')return null
 if(method==='GET')return Response.json({ok:true,coachLinks:[link],assignments})
 if(method!=='PATCH')return Response.json({ok:false},{status:405})
 const input=JSON.parse(String(body))
 const found=assignments.find(a=>a.id===input.assignmentId&&a.status==='assigned'&&a.updatedAt===input.expectedUpdatedAt)
 if(!found)return Response.json({ok:false},{status:409})
 found.assignment=buildPlayerAssignmentCompletion(found.assignment,{recap:input.recap,evidence:input.evidence})
 found.status='completed';found.updatedAt=new Date().toISOString()
 if(new URL(location.href).searchParams.has('training-check-in-lost-response'))return Response.json({ok:false},{status:503})
 return Response.json({ok:true,assignment:found})
}
