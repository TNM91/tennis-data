import {getSignedInPlayerApiAuth} from '@/lib/player-api-auth'
import {getCaptainAvailabilityServiceClient} from '@/lib/captain-availability-request-server'
import {loadPlayerPractices,replyToPlayerPractice} from '@/lib/native-player-practices'
export const runtime='nodejs'
export const maxDuration=30
const json=(value:unknown,status:number)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})
const scope=(r:Request)=>{const p=new URL(r.url).searchParams;return {teamName:p.get('team')||'',leagueName:p.get('league')||'',flight:p.get('flight')||''}}
export async function GET(request:Request){const auth=await getSignedInPlayerApiAuth(request);if(!auth.ok)return auth.response;try{const result=await loadPlayerPractices(getCaptainAvailabilityServiceClient(),auth.userId,scope(request),new URL(request.url).searchParams.get('eventId')||'');return json(result,result.status)}catch{return json({ok:false},503)}}
export async function PATCH(request:Request){const auth=await getSignedInPlayerApiAuth(request);if(!auth.ok)return auth.response;let body:unknown;try{body=await request.json()}catch{return json({ok:false},400)}try{const result=await replyToPlayerPractice(getCaptainAvailabilityServiceClient(),auth.userId,scope(request),body);return json(result,result.status)}catch{return json({ok:false},503)}}
