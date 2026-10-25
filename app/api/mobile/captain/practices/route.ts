import {getCaptainApiAuth} from '@/lib/captain-api-auth'
import {getCaptainAvailabilityServiceClient} from '@/lib/captain-availability-request-server'
import {loadNativeCaptainPractices,setNativePracticeConfirmation,editNativePractice} from '@/lib/native-captain-practices'
export const runtime='nodejs'
export const maxDuration=30
const json=(data:unknown,status:number)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}})
const scope=(r:Request)=>{const p=new URL(r.url).searchParams;return {teamName:p.get('team')||'',leagueName:p.get('league')||'',flight:p.get('flight')||''}}
export async function GET(request:Request){const auth=await getCaptainApiAuth(request);if(!auth.ok)return auth.response;try{const result=await loadNativeCaptainPractices(getCaptainAvailabilityServiceClient(),auth.userId,scope(request));return json(result,result.status)}catch{return json({ok:false,message:'Practices are unavailable. Refresh when connected.'},503)}}
export async function PATCH(request:Request){const auth=await getCaptainApiAuth(request);if(!auth.ok)return auth.response;let body:Record<string,unknown>;try{const value:unknown=await request.json();if(!value||typeof value!=='object'||Array.isArray(value))return json({ok:false},400);body=value as Record<string,unknown>}catch{return json({ok:false},400)}try{const result=await (body.action==='edit_details'?editNativePractice:setNativePracticeConfirmation)(getCaptainAvailabilityServiceClient(),auth.supabase,auth.userId,scope(request),body);return json(result,result.status)}catch{return json({ok:false,message:'The practice change was not confirmed. Refresh before retrying.'},503)}}
