import type {SupabaseClient} from '@supabase/supabase-js'
import {authorizeNativeCaptainScope} from './native-captain-workspace'
import {nativeInviteToken} from './native-team-invite-contract'
import {captainInvite} from './native-captain-invite-contract'
export async function actOnCaptainInvite(service:SupabaseClient,owner:string,body:Record<string,unknown>){
 const {teamName,leagueName,flight,action}=body
 if(typeof teamName!=='string' || typeof leagueName!=='string' || typeof flight!=='string' || typeof action!=='string' || flight.length>80 || !['list','create','revoke'].includes(String(action)) || action!=='list' && (!nativeInviteToken(body.id) || nativeInviteToken(body.id)!==body.id))return {ok:false,status:400,message:'Check the team and invite.'}
 const scope={teamName,leagueName,flight},access=await authorizeNativeCaptainScope(service,owner,scope);if(!access.ok)return {...access,message:'Captain access is required for this team.'}
 const result=await service.rpc('native_captain_invites',{p_owner:owner,p_team:teamName,p_league:leagueName,p_flight:flight,p_action:action,p_id:action==='list'?null:body.id})
 const r=result.data
 if(result.error || !r || r.ok!==true)return {ok:false,status:[400,403,404,409].includes(r?.status)?r.status:503,message:r?.message==='Revoke an unused link before creating another.'?r.message:r?.status===403?'Your team access changed. Close and refresh.':r?.status===409?'This invite changed. Close and refresh before continuing.':'The invite could not be confirmed. Retry the same action.'}
 if(r.status!==200 || r.nativeCaptainInvites!==1 || r.action!==action || !r.scope || ['teamName','leagueName','flight'].some(k=>r.scope[k]!==scope[k as keyof typeof scope]))throw Error('Invite scope mismatch')
 if(action==='list'){if(!Array.isArray(r.invites)||r.invites.length>20)throw Error('Invite list unavailable');return {ok:true,status:200,nativeCaptainInvites:1,action,scope,invites:r.invites.map(captainInvite),more:r.more===true}}
 const invite=captainInvite(r.invite);if(invite.id!==body.id || r.operationId!==body.id || action==='revoke' && (invite.active || !invite.revokedAt))throw Error('Invite receipt mismatch')
 return {ok:true,status:200,nativeCaptainInvites:1,action,scope,operationId:body.id,invite}
}
