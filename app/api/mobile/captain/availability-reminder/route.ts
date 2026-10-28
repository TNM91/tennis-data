import {getCaptainApiAuth} from '@/lib/captain-api-auth'
import {getCaptainAvailabilityServiceClient} from '@/lib/captain-availability-request-server'
import {loadAvailabilityReminder,sendAvailabilityReminder} from '@/lib/native-availability-reminder'
export const runtime='nodejs'
export const maxDuration=30
const json=(value:unknown,status:number)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})
export async function GET(request:Request){
 const auth=await getCaptainApiAuth(request);if(!auth.ok)return auth.response
 const p=new URL(request.url).searchParams,scope={teamName:p.get('team')||'',leagueName:p.get('league')||'',flight:p.get('flight')||''};if(p.has('chatRoom'))return json({ok:false},400)
 try{const r=await loadAvailabilityReminder(getCaptainAvailabilityServiceClient(),auth.userId,scope,p.get('message')||'');return r.ok?json(r.review,200):json({ok:false},r.status)}catch{return json({ok:false},503)}
}
export async function POST(request:Request){
 const auth=await getCaptainApiAuth(request);if(!auth.ok)return auth.response
 try{const length=Number(request.headers.get('content-length'));if(length>4096)return json({ok:false},400);const raw=await request.text();if(raw.length>4096)return json({ok:false},400);let body;try{body=JSON.parse(raw)}catch{return json({ok:false},400)}if(!body||typeof body!=='object'||Array.isArray(body)||body.chatRoomId!==undefined||body.chatRoom!==undefined||!['teamName','leagueName','flight'].every(k=>typeof body[k]==='string'))return json({ok:false},400);const scope={teamName:body.teamName,leagueName:body.leagueName,flight:body.flight},r=await sendAvailabilityReminder(getCaptainAvailabilityServiceClient(),auth.userId,scope,body);return r.ok?json(r.result,200):json({ok:false},r.status)}catch{return json({ok:false},503)}
}
