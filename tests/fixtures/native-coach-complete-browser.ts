import {coachPreviewRequest} from './native-coach-browser'
import {coachOwner,coachRevision} from './native-coach'
import type {WeeklyLevelUpPlan} from '../../lib/level-up/weekly-plan'
let feed=false
const week:WeeklyLevelUpPlan={version:1,id:'shared-week-one',identitySlug:'relentless-competitor-4-0',weekStart:'2026-10-26',summary:'Return depth under pressure',strongestFocus:'movement',sharedWithCoach:true,coachUserId:coachOwner,studentLinkId:'student-one',reps:[{id:'rep-one',kind:'repeat',focusId:'movement',identitySlug:'relentless-competitor-4-0',label:'Next rep',title:'Split and recover',detail:'Land the split step before contact.',href:'/level-up/relentless-competitor-4-0',completedAt:null}],coachResponse:null,createdAt:coachRevision,updatedAt:coachRevision}
const chat:{id:string;mine:boolean;body:string;createdAt:string}[]=[]
export async function coachResourcesPreview(method:string,url:URL,body?:BodyInit|null){
 const selected=url.searchParams.get('student')||''
 if(method!=='GET'){
  const intent=JSON.parse(String(body))
  if(intent.action==='create-calendar'){feed=true;return Response.json({ok:true,owner:coachOwner,calendarUrl:'https://www.tenaceiq.com/api/calendar/coach-student/student-one/calendar.ics?token=synthetic-only'})}
  if(intent.action==='revoke-calendar'){feed=false;return Response.json({ok:true,owner:coachOwner})}
  if(intent.planId!==week.id||intent.expectedUpdatedAt!==week.updatedAt)return Response.json({}, {status:409})
  week.coachResponse={action:intent.action,note:intent.note||'Plan reviewed.',targetRepId:intent.targetRepId||null,replacementRep:null,coachUserId:coachOwner,updatedAt:new Date().toISOString(),playerReply:null};week.updatedAt=new Date().toISOString();return Response.json({ok:true,owner:coachOwner,plan:week})
 }
 const workspace=await coachPreviewRequest('GET',new URL('https://synthetic.invalid?student='+selected)).json()
 return Response.json({ok:true,owner:coachOwner,workspace,weeks:[week],proof:[{id:'proof-one',title:'Return-depth ladder',focus:'Return height',rating:4,note:'Eight of ten returns landed deep.',completedAt:'2026-10-30T12:30:00Z',elapsedSeconds:600,feeling:'ready',starterRead:null,assignmentId:'assignment-one'}],feed:feed?{created_at:coachRevision,last_used_at:null,updated_at:coachRevision}:null,moreWeeks:false,moreProof:false})
}
export function coachMessagesPreview(method:string,url:URL,body?:BodyInit|null){
 if(!url.searchParams.has('student'))return Response.json({ok:true,owner:coachOwner,connections:[{id:'student-one',name:'Alex Rivera',role:'coach'}],more:false})
 if(method!=='GET'){const intent=JSON.parse(String(body));if(!chat.some(m=>m.id===intent.id))chat.push({...intent,mine:true,createdAt:new Date().toISOString()})}
 return Response.json({ok:true,owner:coachOwner,student:'student-one',messages:chat,more:false,checked:chat.find(m=>m.id===url.searchParams.get('message'))||null})
}
