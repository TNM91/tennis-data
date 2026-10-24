import {getCaptainApiAuth} from '@/lib/captain-api-auth'
import {getCaptainAvailabilityServiceClient} from '@/lib/captain-availability-request-server'
import {nativeInviteBody} from '@/lib/native-team-invites'
import {actOnMemberAccess} from '@/lib/native-member-access'
export const runtime='nodejs'
export const maxDuration=30
const json=(data:unknown,status:number)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}})
export async function POST(request:Request){try{
 const auth=await getCaptainApiAuth(request);if(!auth.ok){auth.response.headers.set('Cache-Control','private, no-store');return auth.response}
 let body:Record<string,unknown>;try{body=await nativeInviteBody(request)}catch{return json({ok:false,message:'Check your member review.'},400)}
 const r=await actOnMemberAccess(getCaptainAvailabilityServiceClient(),auth.userId,body);return json(r,r.status)
}catch{return json({ok:false,message:'The access change could not be confirmed. Retry the same action.'},503)}}
