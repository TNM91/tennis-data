import 'server-only'
import type {SupabaseClient} from '@supabase/supabase-js'

const uuid=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

/** One bounded lookup for eligible recipients, shared across their devices.
 * Missing/failed counts omit aps.badge, preserving the existing icon number.
 */
export async function nativeChatBadgeCounts(service:SupabaseClient,recipients:readonly string[]):Promise<ReadonlyMap<string,number>>{
 const owners=[...new Set(recipients)],counts=new Map<string,number>()
 if(!owners.length)return counts
 if(owners.length>100||owners.some(owner=>!uuid(owner)))return counts
 try{
  const result=await service.rpc('native_chat_badge_counts',{p_owners:owners}).abortSignal(AbortSignal.timeout(2500)).retry(false)
  if(result.error||!Array.isArray(result.data)||result.data.length>owners.length)throw Error('Badge unavailable')
  for(const row of result.data){
   if(!row||!owners.includes(row.profile_id)||counts.has(row.profile_id)||!Number.isInteger(row.unread)||row.unread<0||row.unread>100)throw Error('Badge unavailable')
   counts.set(row.profile_id,row.unread)
  }
  return counts
 }catch{console.warn('native_chat_badge_unavailable');return new Map()}
}
