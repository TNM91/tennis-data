import type {SupabaseClient} from '@supabase/supabase-js'
import {APPLE_MEMBERSHIP_PRODUCTS} from '../../lib/apple-membership-products'
import {createApplePurchases,type AppleStore} from '../../mobile/src/apple-purchases'

export * from '../../mobile/src/apple-purchases'

const prices = APPLE_MEMBERSHIP_PRODUCTS.map(product => ({
 id:product.productId,
 price:new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(product.expectedUSPriceCents/100),
}))
const unavailable = async () => { throw Error('Screenshots use a read-only purchase fixture') }
const store:AppleStore = {
 products:async()=>({available:true,products:prices}),
 pending:async()=>({transactions:[]}),
 addListener:async()=>({remove:async()=>{}}),
 purchase:unavailable,
 restore:unavailable,
 finish:unavailable,
 manage:unavailable,
}
const services=new WeakMap<SupabaseClient,ReturnType<typeof createApplePurchases>>()

export function applePurchases(client:SupabaseClient){
 let service=services.get(client)
 if(!service){
  service=createApplePurchases(client,{store,available:true,platform:'ios'})
  services.set(client,service)
 }
 return service
}
