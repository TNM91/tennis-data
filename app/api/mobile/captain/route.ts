import {getCaptainApiAuth} from '@/lib/captain-api-auth'
import {getCaptainAvailabilityServiceClient} from '@/lib/captain-availability-request-server'
import {loadNativeCaptainWorkspace} from '@/lib/native-captain-workspace'
export const runtime='nodejs'
export const maxDuration=30
const json=(data:unknown,status:number)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}})
export async function GET(request:Request){
 const auth=await getCaptainApiAuth(request)
 if(!auth.ok)return auth.response
 const params=new URL(request.url).searchParams,scope={teamName:params.get('team') || '',leagueName:params.get('league') || '',flight:params.get('flight') || ''}
 try{const result=await loadNativeCaptainWorkspace(getCaptainAvailabilityServiceClient(),auth.userId,scope);return json(result,result.status)}catch{return json({ok:false,message:'Captain tools are unavailable. Try refreshing.'},503)}
}
