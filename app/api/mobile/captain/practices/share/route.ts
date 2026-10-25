import {getCaptainApiAuth} from '@/lib/captain-api-auth'
import {getCaptainAvailabilityServiceClient} from '@/lib/captain-availability-request-server'
import {loadNativePracticeSharing,announceNativePractice} from '@/lib/native-practice-sharing'
import {POST as postTeamRoom} from '@/app/api/team-rooms/route'
export const runtime='nodejs'
export const maxDuration=30
const json=(value:unknown,status:number)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})
const scope=(r:Request)=>{const p=new URL(r.url).searchParams;return {teamName:p.get('team')||'',leagueName:p.get('league')||'',flight:p.get('flight')||''}}
export async function GET(request:Request){const auth=await getCaptainApiAuth(request);if(!auth.ok)return auth.response;try{const r=await loadNativePracticeSharing(getCaptainAvailabilityServiceClient(),auth.userId,scope(request),new URL(request.url).searchParams.get('eventId'));if(!r.ok)return json(r,r.status);if(r.practice.status==='completed')return json({ok:false},409);return json({ok:true,owner:r.owner,scope:r.scope,practice:r.practice,rsvpPath:r.rsvpPath},200)}catch{return json({ok:false},503)}}
export async function POST(request:Request){const auth=await getCaptainApiAuth(request);if(!auth.ok)return auth.response;let body:Record<string,unknown>;try{const v:unknown=await request.json();if(!v||typeof v!=='object'||Array.isArray(v))return json({ok:false},400);body=v as Record<string,unknown>}catch{return json({ok:false},400)}try{const selected=scope(request),r=await announceNativePractice(getCaptainAvailabilityServiceClient(),auth.userId,selected,body,message=>postTeamRoom(new Request(new URL('/api/team-rooms',request.url),{method:'POST',headers:{Authorization:request.headers.get('Authorization')||'','Content-Type':'application/json'},body:JSON.stringify({...selected,action:'send',announcement:true,replyToMessageId:'',...message})})));return json(r,r.status)}catch{return json({ok:false},503)}}
