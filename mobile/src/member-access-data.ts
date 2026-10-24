import {CapacitorHttp,type HttpOptions,type HttpResponse} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamScope} from './team-room-data'
import {memberReview,type MemberAccessIntent} from '../../lib/native-member-access-contract'
export type MemberAccessTransport=(options:HttpOptions)=>Promise<HttpResponse>
export class MemberAccessError extends Error{constructor(message:string,public uncertain=false){super(message)}}
export async function memberAccessRequest(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,intent:MemberAccessIntent|null,send:MemberAccessTransport=options=>CapacitorHttp.post(options)){
 const session=await client.auth.getSession();if(session.error||session.data.session?.user.id!==owner||!current())throw new MemberAccessError('Sign in again to manage team chat access.')
 let response:HttpResponse
 try{response=await send({url:'https://www.tenaceiq.com/api/mobile/captain/members',headers:{Authorization:`Bearer ${session.data.session.access_token}`,'Content-Type':'application/json'},data:{...scope,...(intent||{action:'list'})},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:30000})}catch{throw new MemberAccessError('The access change could not be confirmed. Retry the same action or close and check members later.',Boolean(intent))}
 if(!current())throw new MemberAccessError('This team is no longer open.')
 const r=response.data as Record<string,unknown>|null
 if(response.status!==200||!r||r.ok!==true){const known=[400,401,403,404,409].includes(response.status);throw new MemberAccessError(known&&typeof r?.message==='string'?r.message.slice(0,240):'The access change could not be confirmed. Retry the same action.',Boolean(intent)&&!known)}
 try{
  const returned=r.scope as TeamScope
  if(r.nativeMemberAccess!==1||r.action!==(intent?.action||'list')||!returned||['teamName','leagueName','flight'].some(k=>returned[k as keyof TeamScope]!==scope[k as keyof TeamScope]))throw Error()
  if(!intent){if(!Array.isArray(r.members)||r.members.length>250)throw Error();return {members:r.members.map(memberReview),more:r.more===true,replayed:false,superseded:false}}
  if(r.applied!==true||r.targetId!==intent.targetId||r.operationId!==intent.operationId||typeof r.replayed!=='boolean'||typeof r.superseded!=='boolean')throw Error()
  return {members:[],more:false,replayed:r.replayed,superseded:r.superseded}
 }catch{throw new MemberAccessError('The member receipt could not be confirmed. Retry the same action.',Boolean(intent))}
}
