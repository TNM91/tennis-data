import type {SupabaseClient} from '@supabase/supabase-js'
import {authorizeNativeCaptainScope} from './native-captain-workspace'
import {memberReview,memberUuid} from './native-member-access-contract'
export async function actOnMemberAccess(service:SupabaseClient,owner:string,body:Record<string,unknown>){
 const {teamName,leagueName,flight,action}=body
 if(typeof teamName!=='string'||typeof leagueName!=='string'||typeof flight!=='string'||flight.length>80||typeof action!=='string'||!['list','remove','restore'].includes(action)||action!=='list'&&(!memberUuid(body.targetId)||!memberUuid(body.operationId)||!body.expected||typeof body.expected!=='object'||Array.isArray(body.expected)))return {ok:false,status:400,message:'Review the team member before continuing.'}
 const scope={teamName,leagueName,flight},access=await authorizeNativeCaptainScope(service,owner,scope);if(!access.ok)return {...access,message:'Captain access is required for this team.'}
 const result=await service.rpc('native_team_member_access',{p_owner:owner,p_team:teamName,p_league:leagueName,p_flight:flight,p_action:action,p_target:action==='list'?null:body.targetId,p_operation:action==='list'?null:body.operationId,p_expected:action==='list'?null:body.expected}),r=result.data
 if(result.error||!r||r.ok!==true)return {ok:false,status:[400,403,404,409].includes(r?.status)?r.status:503,message:r?.status===409?'This member’s access changed. Refresh members before continuing.':r?.status===403?'This access change is unavailable. Refresh your team and member review.':'The access change could not be confirmed. Retry the same action.'}
 if(r.nativeMemberAccess!==1||r.status!==200||r.action!==action||!r.scope||['teamName','leagueName','flight'].some(k=>r.scope[k]!==scope[k as keyof typeof scope]))throw Error('Member scope mismatch')
 if(action==='list'){if(!Array.isArray(r.members)||r.members.length>250)throw Error('Member list unavailable');return {ok:true,status:200,nativeMemberAccess:1,action,scope,members:r.members.map(memberReview),more:r.more===true}}
 if(r.operationId!==body.operationId||r.targetId!==body.targetId||r.applied!==true||typeof r.replayed!=='boolean'||typeof r.superseded!=='boolean')throw Error('Member receipt mismatch')
 return {ok:true,status:200,nativeMemberAccess:1,action,scope,operationId:body.operationId,targetId:body.targetId,applied:true,replayed:r.replayed,superseded:r.superseded}
}
