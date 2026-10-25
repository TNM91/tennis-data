import {getCaptainApiAuth} from '@/lib/captain-api-auth'
import {getCaptainAvailabilityServiceClient} from '@/lib/captain-availability-request-server'
import {loadNativeSavedLineups} from '@/lib/native-saved-lineups'
export const runtime='nodejs'
export const maxDuration=30
const json=(v:unknown,status:number)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})
export async function GET(request:Request){const auth=await getCaptainApiAuth(request);if(!auth.ok)return auth.response;try{const p=new URL(request.url).searchParams,r=await loadNativeSavedLineups(getCaptainAvailabilityServiceClient(),auth.supabase,auth.userId,{teamName:p.get('team')||'',leagueName:p.get('league')||'',flight:p.get('flight')||''},p.get('match')||'');return json(r,r.status)}catch{return json({ok:false},503)}}
