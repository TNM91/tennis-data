import {getCaptainApiAuth} from '@/lib/captain-api-auth'
import {getCaptainAvailabilityServiceClient} from '@/lib/captain-availability-request-server'
import {nativePracticeRepeat} from '@/lib/native-practice-repeat'
export const runtime='nodejs'
export const maxDuration=30
const json=(value:unknown,status:number)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})
const scope=(r:Request)=>{const p=new URL(r.url).searchParams;return {teamName:p.get('team')||'',leagueName:p.get('league')||'',flight:p.get('flight')||''}}
async function act(request:Request,body:Record<string,unknown>){const auth=await getCaptainApiAuth(request);if(!auth.ok)return auth.response;try{const result=await nativePracticeRepeat(getCaptainAvailabilityServiceClient(),auth.userId,scope(request),body);return json(result,result.status)}catch{return json({ok:false},503)}}
export async function GET(request:Request){return act(request,{action:'preview',sourceId:new URL(request.url).searchParams.get('eventId')})}
export async function POST(request:Request){const auth=await getCaptainApiAuth(request);if(!auth.ok)return auth.response;let body:Record<string,unknown>;try{const value:unknown=await request.json();if(!value||typeof value!=='object'||Array.isArray(value))return json({ok:false},400);body=value as Record<string,unknown>}catch{return json({ok:false},400)}try{const result=await nativePracticeRepeat(getCaptainAvailabilityServiceClient(),auth.userId,scope(request),body);return json(result,result.status)}catch{return json({ok:false},503)}}
