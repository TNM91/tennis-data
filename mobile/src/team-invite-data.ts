import {CapacitorHttp,type HttpOptions,type HttpResponse} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {nativeInviteToken,nativeInviteReview,type NativeInviteReview} from '../../lib/native-team-invite-contract'
export type InviteTransport=(options:HttpOptions)=>Promise<HttpResponse>
export class InviteError extends Error{constructor(message:string,public uncertain=false){super(message)}}
export async function inviteRequest(client:SupabaseClient,owner:string,current:()=>boolean,token:string,review:NativeInviteReview|null,send:InviteTransport=options=>CapacitorHttp.post(options)){
 const session=await client.auth.getSession();if(session.error || session.data.session?.user.id!==owner || !current())throw new InviteError('Sign in again to review this invite.')
 if(!nativeInviteToken(token))throw new InviteError('Paste a TenAceIQ team invite.')
 let response:HttpResponse
 try{response=await send({url:'https://www.tenaceiq.com/api/mobile/team-invites',headers:{Authorization:`Bearer ${session.data.session.access_token}`,'Content-Type':'application/json'},data:{action:review?'join':'preview',token,...(review?{expected:review.expected}:{})},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:30000})}catch{throw new InviteError(review?'Joining could not be confirmed. Retry the same invite or close and refresh your teams.':'The invite could not be loaded. Check your connection.',Boolean(review))}
 if(!current())throw new InviteError('This invite is no longer open.')
 const row=response.data as Record<string,unknown>|null
 if(response.status!==200 || !row || row.ok!==true){const known=[400,401,403,404,409].includes(response.status);throw new InviteError(known && typeof row?.message==='string'?row.message.slice(0,240):review?'Joining could not be confirmed. Retry the same invite or close and refresh your teams.':'Team invites are unavailable. Try again.',Boolean(review)&&!known)}
 try{
  if(row.nativeTeamInvite!==1)throw Error()
  if(!review)return nativeInviteReview(row.review)
  const scope=row.scope as Record<string,unknown>|null
  if(row.joined!==true || row.roomId!==review.roomId || !scope || ['teamName','leagueName','flight'].some(k=>scope[k]!==review[k as keyof NativeInviteReview]))throw Error()
  return review
 }catch{throw new InviteError(review?'Joining could not be confirmed. Retry the same invite or close and refresh your teams.':'This invite could not be checked.',Boolean(review))}
}
