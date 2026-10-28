import {getCaptainApiAuth} from '@/lib/captain-api-auth'
import {getCaptainAvailabilityServiceClient} from '@/lib/captain-availability-request-server'
import {loadNativeAvailabilityReview} from '@/lib/native-availability-requests'
export const runtime='nodejs'
export const maxDuration=30
const json=(value:unknown,status:number)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})
export async function GET(request:Request){
 const auth=await getCaptainApiAuth(request);if(!auth.ok)return auth.response
 const p=new URL(request.url).searchParams,scope={teamName:p.get('team')||'',leagueName:p.get('league')||'',flight:p.get('flight')||''}
 if(p.has('chatRoom'))return json({ok:false},400)
 try{const result=await loadNativeAvailabilityReview(getCaptainAvailabilityServiceClient(),auth.userId,scope,p.get('fixture')||'');return result.ok?json(result.review,200):json({ok:false},result.status)}catch{return json({ok:false},503)}
}
