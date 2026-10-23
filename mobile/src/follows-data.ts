import type { SupabaseClient } from '@supabase/supabase-js'
import { CapacitorHttp } from '@capacitor/core'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '../../lib/access-model-core'
import { normalizeUserRole } from '../../lib/roles'
export type PlayerFollow={entity_type:'player';entity_id:string;entity_name:string;subtitle:string|null}
export class FollowAccessError extends Error {}
export async function followSession(client:SupabaseClient,isCurrent:()=>boolean) {
  const {data,error}=await client.auth.getSession()
  if(error || !data.session || !isCurrent())throw Error('Sign in again to manage follows.')
  return data.session
}
export async function loadPlayerFollows(client:SupabaseClient,isCurrent:()=>boolean):Promise<PlayerFollow[]> {
  const session=await followSession(client,isCurrent)
  const {data,error}=await client.from('user_follows').select('entity_type,entity_id,entity_name,subtitle')
    .eq('user_id',session.user.id).eq('entity_type','player').order('entity_name',{ascending:true}).order('entity_id',{ascending:true}).limit(24).abortSignal(AbortSignal.timeout(12000))
  if(error)throw Error('Following unavailable')
  return (data || []) as PlayerFollow[]
}
export async function playerFollowState(client:SupabaseClient,playerId:string,isCurrent:()=>boolean) {
  const session=await followSession(client,isCurrent)
  const {data,error}=await client.from('user_follows').select('id').eq('user_id',session.user.id).eq('entity_type','player').eq('entity_id',playerId).limit(1).abortSignal(AbortSignal.timeout(12000))
  if(error)throw Error('Follow status unavailable')
  return Boolean(data?.length)
}
export async function canFollowPlayers(client:SupabaseClient,isCurrent:()=>boolean,send:typeof CapacitorHttp.get=options=>CapacitorHttp.get(options)) {
  const session=await followSession(client,isCurrent)
  const response=await send({url:'https://www.tenaceiq.com/api/auth/access',headers:{Authorization:`Bearer ${session.access_token}`},responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:12000})
  if(response.status!==200 || response.data?.ok!==true || !response.data.access || !response.data.access.entitlements)throw Error('Account access unavailable')
  const access=response.data.access
  return buildProductAccessState(normalizeUserRole(access.role),access.entitlements as ProductEntitlementSnapshot).canUseAdvancedPlayerInsights
}
export async function savePlayerFollow(client:SupabaseClient,item:PlayerFollow,following:boolean,isCurrent:()=>boolean,send:typeof CapacitorHttp.request=options=>CapacitorHttp.request(options)) {
  const session=await followSession(client,isCurrent)
  const response=await send({url:'https://www.tenaceiq.com/api/follows',method:following?'POST':'DELETE',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},data:item,responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:12000})
  if(response.status===403)throw new FollowAccessError('Player access is required to add follows.')
  if(response.status<200 || response.status>=300 || response.data?.ok!==true || response.data.following!==following)throw Error('Could not confirm the follow change. Retry to check its status.')
}
