import {getCaptainApiAuth} from '@/lib/captain-api-auth'
import {getCaptainAvailabilityServiceClient} from '@/lib/captain-availability-request-server'
import {loadNativeAvailabilityReplies} from '@/lib/native-availability-replies'
export const runtime='nodejs'
export const maxDuration=30
const json=(value:unknown,status:number)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})
export async function GET(request:Request){
 const auth=await getCaptainApiAuth(request);if(!auth.ok)return auth.response
 const p=new URL(request.url).searchParams,scope={teamName:p.get('team')||'',leagueName:p.get('league')||'',flight:p.get('flight')||''}
 if(p.has('chatRoom'))return json({ok:false},400)
 try{const r=await loadNativeAvailabilityReplies(getCaptainAvailabilityServiceClient(),auth.userId,scope,p.get('message')||'');return r.ok?json(r.result,200):json({ok:false},r.status)}catch{return json({ok:false},503)}
}
