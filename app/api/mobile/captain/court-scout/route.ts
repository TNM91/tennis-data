import {getCaptainApiAuth} from '@/lib/captain-api-auth'
import {getCaptainAvailabilityServiceClient} from '@/lib/captain-availability-request-server'
import {loadNativeCaptainCourtScout} from '@/lib/native-captain-court-scout'
export const runtime='nodejs'
export const maxDuration=30
export async function GET(request:Request){const auth=await getCaptainApiAuth(request);if(!auth.ok)return auth.response;try{const p=new URL(request.url).searchParams,r=await loadNativeCaptainCourtScout(getCaptainAvailabilityServiceClient(),auth.userId,{teamName:p.get('team')||'',leagueName:p.get('league')||'',flight:p.get('flight')||''},p.get('match')||'');return Response.json(r,{status:r.status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})}catch{return Response.json({ok:false},{status:503,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})}}
