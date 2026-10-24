import {nativeInviteAuth,nativeInviteBody,actOnNativeInvite} from '@/lib/native-team-invites'
export const runtime='nodejs'
export const maxDuration=30
const json=(data:unknown,status:number)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}})
export async function POST(request:Request){
 try{
  const auth=await nativeInviteAuth(request);if(!auth.ok)return json({ok:false,message:auth.status===401?'Sign in to review your team invite.':'Team invites are unavailable.'},auth.status)
  let body:Record<string,unknown>;try{body=await nativeInviteBody(request)}catch{return json({ok:false,message:'Check your team invite.'},400)}
  const result=await actOnNativeInvite(auth.service,auth.owner,body);return json(result,result.status)
 }catch{return json({ok:false,message:'This invite could not be confirmed. Retry when your connection is ready.'},503)}
}
