import {CapacitorHttp,type HttpOptions,type HttpResponse} from '@capacitor/core'
import {Share} from '@capacitor/share'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamScope} from './team-room-data'
import {captainInvite,captainInviteUrl,type CaptainInvite} from '../../lib/native-captain-invite-contract'
export type CaptainInviteIntent={action:'create'|'revoke';id:string}
export type CaptainInviteTransport=(options:HttpOptions)=>Promise<HttpResponse>
export class CaptainInviteError extends Error{constructor(message:string,public uncertain=false){super(message)}}
export async function captainInvitesRequest(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,intent:CaptainInviteIntent|null,send:CaptainInviteTransport=options=>CapacitorHttp.post(options)){
 const session=await client.auth.getSession();if(session.error||session.data.session?.user.id!==owner||!current())throw new CaptainInviteError('Sign in again to manage invites.')
 let response:HttpResponse
 try{response=await send({url:'https://www.tenaceiq.com/api/mobile/captain/invites',headers:{Authorization:`Bearer ${session.data.session.access_token}`,'Content-Type':'application/json'},data:{...scope,...(intent||{action:'list'})},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:30000})}catch{throw new CaptainInviteError('The invite action could not be confirmed. Retry the same action.',Boolean(intent))}
 if(!current())throw new CaptainInviteError('This team is no longer open.')
 const r=response.data as Record<string,unknown>|null
 if(response.status!==200||!r||r.ok!==true){const known=[400,401,403,404,409].includes(response.status);throw new CaptainInviteError(known&&typeof r?.message==='string'?r.message.slice(0,240):'The invite action could not be confirmed. Retry the same action.',Boolean(intent)&&!known)}
 try{
  const returned=r.scope as TeamScope
  if(r.nativeCaptainInvites!==1||r.action!==(intent?.action||'list')||!returned||['teamName','leagueName','flight'].some(k=>returned[k as keyof TeamScope]!==scope[k as keyof TeamScope]))throw Error()
  if(!intent){if(!Array.isArray(r.invites)||r.invites.length>20)throw Error();return {invites:r.invites.map(captainInvite),more:r.more===true,invite:null}}
  const invite=captainInvite(r.invite);if(r.operationId!==intent.id||invite.id!==intent.id||intent.action==='revoke'&&(invite.active||!invite.revokedAt))throw Error()
  return {invites:[],more:false,invite}
 }catch{throw new CaptainInviteError('The invite receipt could not be confirmed. Retry the same action.',Boolean(intent))}
}
export async function shareCaptainInvite(invite:CaptainInvite,scope:TeamScope,current:()=>boolean,share:typeof Share=Share){
 if(!invite.active||Date.parse(invite.expiresAt)<=Date.now()||!current())throw Error('Refresh this invite before sharing.')
 const available=await share.canShare();if(!current())return
 if(!available.value)throw Error('Sharing is unavailable. Select and copy the invite link instead.')
 await share.share({title:'Join '+scope.teamName+' on TenAceIQ',text:'Join our team conversation on TenAceIQ. Open My teams, choose Join team, and paste this invite.',url:captainInviteUrl(invite),dialogTitle:'Share team invite'})
}
