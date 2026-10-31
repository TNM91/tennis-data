import {getCoachApiAuth} from '@/lib/coach-api-auth'
import {coachId,coachRecord} from '@/lib/native-coach-contract'
import {readAccountJson} from '@/lib/mobile-account-auth'
import {loadNativeCoach,NativeCoachFault} from '@/lib/native-coach'
import {mapWeeklyLevelUpPlanRow,type WeeklyLevelUpPlanRow} from '@/lib/level-up/weekly-plan'
import {mapLevelUpSessionRow,type LevelUpSessionRow} from '@/lib/level-up-sessions'
import {PATCH as respondToWeek} from '@/app/api/coach/level-up-weekly-plans/route'
import {POST as createFeed,DELETE as revokeFeed} from '@/app/api/coach/student-calendar-links/route'
export const runtime='nodejs'
export const maxDuration=30
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})
async function handle(request:Request,write:boolean){
 const auth=await getCoachApiAuth(request);if(!auth.ok){auth.response.headers.set('Cache-Control','private, no-store');return auth.response}
 try{
  const params=new URL(request.url).searchParams
  if([...params.keys()].some(k=>k!=='student'||params.getAll(k).length!==1))return json({ok:false},400)
  const selected=coachId(params.get('student')),workspace=await loadNativeCoach(auth.supabase,auth.userId,selected)
  if(write){
   let body:Record<string,unknown>;try{body=coachRecord(await readAccountJson(request,4096))}catch{return json({ok:false},400)}
   if(!['create-calendar','revoke-calendar','acknowledged','answered','adjusted','replaced'].includes(String(body.action)))return json({ok:false},400)
   if(Object.keys(body).some(k=>!['action','planId','expectedUpdatedAt','note','targetRepId','replacementCardId'].includes(k)))return json({ok:false},400)
   let response:Response
   if(body.action==='create-calendar'||body.action==='revoke-calendar'){
    const url=new URL('/api/coach/student-calendar-links',request.url);url.searchParams.set('studentLinkId',selected)
    const headers=new Headers(request.headers);headers.set('content-type','application/json')
    response=body.action==='create-calendar'?await createFeed(new Request(url,{method:'POST',headers,body:JSON.stringify({studentLinkId:selected})})):await revokeFeed(new Request(url,{method:'DELETE',headers}))
   }else{
    let planId:string;try{planId=coachId(body.planId)}catch{return json({ok:false},400)}
    const found=await auth.supabase.from('level_up_weekly_plans').select('id,updated_at').eq('id',planId).eq('coach_user_id',auth.userId).eq('student_link_id',selected).eq('shared_with_coach',true).maybeSingle()
    if(found.error)throw Error('Plan unavailable')
    if(!found.data||found.data.updated_at!==body.expectedUpdatedAt)return json({ok:false,message:'This week changed. Refresh before guiding it.'},409)
    if(!['acknowledged','answered','adjusted','replaced'].includes(String(body.action)))return json({ok:false},400)
    response=await respondToWeek(new Request(new URL('/api/coach/level-up-weekly-plans',request.url),{method:'PATCH',headers:request.headers,body:JSON.stringify({planId:body.planId,action:body.action,note:body.note,targetRepId:body.targetRepId,replacementCardId:body.replacementCardId})}))
   }
   if(!response.ok)return json({ok:false,message:response.status===409?'This record changed. Refresh before trying again.':'This update was not confirmed. Refresh before trying again.'},response.status===409?409:503)
   const result=await response.json();if(body.action==='create-calendar'){const url=new URL(result.calendarUrl);url.searchParams.set('native','1');result.calendarUrl=url.toString()}
   return json({ok:true,owner:auth.userId,...result})
  }
  const [weekResult,proofResult,feedResult]=await Promise.all([
   auth.supabase.from('level_up_weekly_plans').select('id,player_user_id,coach_user_id,student_link_id,identity_slug,week_start,shared_with_coach,plan_json,created_at,updated_at').eq('coach_user_id',auth.userId).eq('student_link_id',selected).eq('shared_with_coach',true).order('week_start',{ascending:false}).limit(51),
   auth.supabase.from('level_up_sessions').select('id,player_user_id,coach_user_id,student_link_id,assignment_id,identity_slug,focus_id,focus_title,work_type,training_context,drill_title,rating,feeling,access_mode,note,elapsed_seconds,shared_with_coach,session_json,completed_at,created_at,updated_at').eq('coach_user_id',auth.userId).eq('student_link_id',selected).eq('shared_with_coach',true).order('completed_at',{ascending:false}).limit(101),
   auth.supabase.from('calendar_feed_tokens').select('created_at,last_used_at,updated_at').eq('scope_type','coach_student').eq('scope_id',selected).eq('owner_user_id',auth.userId).eq('status','active').order('created_at',{ascending:false}).limit(1).maybeSingle()])
  if(weekResult.error||proofResult.error||feedResult.error)throw Error('Shared work unavailable')
  const weeks=(weekResult.data as WeeklyLevelUpPlanRow[]).slice(0,50).map(mapWeeklyLevelUpPlanRow).filter(p=>!!p)
  const proof=(proofResult.data as LevelUpSessionRow[]).slice(0,100).map(mapLevelUpSessionRow).map(s=>({id:s.id,title:s.drillTitle,focus:s.focusTitle,rating:s.rating,note:s.note,completedAt:s.completedAt,elapsedSeconds:s.elapsedSeconds,feeling:s.feeling,starterRead:s.starterRead,assignmentId:s.assignmentId}))
  return json({ok:true,owner:auth.userId,workspace,weeks,proof,feed:feedResult.data,moreWeeks:(weekResult.data?.length??0)>50,moreProof:(proofResult.data?.length??0)>100})
 }catch(error){return error instanceof NativeCoachFault?json({ok:false,message:error.message},error.status):json({ok:false,message:'Coach records could not be confirmed. Refresh before trying another update.'},503)}
}
export const GET=(request:Request)=>handle(request,false)
export const POST=(request:Request)=>handle(request,true)
