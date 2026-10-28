import 'server-only'
import type {SupabaseClient} from '@supabase/supabase-js'
import {mergeAppleAccess} from './apple-purchase-contract'
import type {ProductEntitlementSnapshot} from './access-model-core'
export async function withAppleAccess(client:SupabaseClient,owner:string,web:ProductEntitlementSnapshot,service=false){
 if(process.env.APPLE_MEMBERSHIPS_ENABLED!=='true')return web
 const result=service?await client.rpc('apple_purchase_access',{p_owner:owner}):await client.rpc('my_apple_purchase_access')
 if(result.error||!result.data||result.data.ownerId!==owner||!['playerExpiresAt','captainExpiresAt'].every(key=>result.data[key]===null||typeof result.data[key]==='string'&&Number.isFinite(Date.parse(result.data[key]))))throw Error('Apple access temporarily unavailable')
 return mergeAppleAccess(web,result.data)
}
