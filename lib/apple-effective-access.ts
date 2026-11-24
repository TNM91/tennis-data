import 'server-only'
import type {SupabaseClient} from '@supabase/supabase-js'
import {mergeAppleAccess} from './apple-purchase-contract'
import type {ProductEntitlementSnapshot} from './access-model-core'
export async function withAppleAccess(client:SupabaseClient,owner:string,web:ProductEntitlementSnapshot,service=false){
 const apple=process.env.APPLE_MEMBERSHIPS_ENABLED==='true',google=process.env.GOOGLE_PLAY_ENTITLEMENTS_ENABLED==='true'
 if(!apple&&!google)return web
 const result=google
  ?service?await client.rpc('native_store_purchase_access',{p_owner:owner,p_include_apple:apple,p_include_google:true}):await client.rpc('my_native_store_purchase_access',{p_include_apple:apple,p_include_google:true})
  :service?await client.rpc('apple_purchase_access',{p_owner:owner}):await client.rpc('my_apple_purchase_access')
 if(result.error||!result.data||result.data.ownerId!==owner||!['playerExpiresAt','captainExpiresAt'].every(key=>result.data[key]===null||typeof result.data[key]==='string'&&Number.isFinite(Date.parse(result.data[key]))))throw Error('Apple access temporarily unavailable')
 if(result.data.proExpiresAt!=null&&(typeof result.data.proExpiresAt!=='string'||!Number.isFinite(Date.parse(result.data.proExpiresAt))))throw Error('Apple access temporarily unavailable')
 return mergeAppleAccess(web,result.data)
}
