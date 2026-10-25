import {getCaptainApiAuth} from '@/lib/captain-api-auth'
import {getCaptainAvailabilityServiceClient} from '@/lib/captain-availability-request-server'
import {loadNativeCaptainScenarios} from '@/lib/native-captain-scenarios'
export const runtime='nodejs'
export const maxDuration=30
const json=(value:unknown,status:number)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})
export async function GET(request:Request){const auth=await getCaptainApiAuth(request);if(!auth.ok)return auth.response;try{const p=new URL(request.url).searchParams,result=await loadNativeCaptainScenarios(getCaptainAvailabilityServiceClient(),auth.userId,{teamName:p.get('team')||'',leagueName:p.get('league')||'',flight:p.get('flight')||''},p.get('match')||'');return json(result,result.status)}catch{return json({ok:false},503)}}
