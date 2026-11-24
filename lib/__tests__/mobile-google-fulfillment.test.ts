import {it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {HttpOptions,HttpResponse} from '@capacitor/core'
vi.mock('@capacitor/core',()=>({CapacitorHttp:{},Capacitor:{getPlatform:()=> 'web',isPluginAvailable:()=>false},registerPlugin:()=>({})}))
import {googlePlayFulfillment} from '../../mobile/src/google-play-fulfillment'
import {GOOGLE_PLAY_PRODUCTS,type GooglePlayTransaction} from '../google-play-products'
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',sku=GOOGLE_PLAY_PRODUCTS[0].id
function setup(){
 let owner=a
 const client={auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:'synthetic-session-token'}},error:null})}} as unknown as SupabaseClient
 const response=(data:object,status=200)=>({status,data,headers:{},url:'https://www.tenaceiq.com/api/mobile/google-purchases'}) satisfies HttpResponse
 const http={get:vi.fn(async(options:HttpOptions)=>{expect(options.disableRedirects).toBe(true);return response({ok:true,googlePurchases:1,ownerId:a,enabled:false})}),post:vi.fn(async(options:HttpOptions)=>{expect(options.disableRedirects).toBe(true);return response({ok:true,googlePurchases:1,ownerId:a,receipt:{settled:true}})})}
 return {http,service:googlePlayFulfillment(client,http),response,switchOwner(next:string){owner=next}}
}
it('uses a pinned authenticated HTTPS API, private POST bodies and bounded native timeouts',async()=>{
 const f=setup();await f.service.context(a);await f.service.prepare(a,{productId:sku,targetId:null})
 const tx:GooglePlayTransaction={productId:sku,purchaseToken:'synthetic-google-purchase-token',accountId:'a'.repeat(64),profileId:null,state:'purchased',acknowledged:false,suspended:false,quantity:1}
 await f.service.reconcile(a,tx,b)
 for(const call of [...f.http.get.mock.calls,...f.http.post.mock.calls]){
  const options=call[0] as unknown as {url:string;headers:{Authorization:string};disableRedirects:boolean;connectTimeout:number;readTimeout:number}
  expect(options.url).toBe('https://www.tenaceiq.com/api/mobile/google-purchases');expect(options.headers.Authorization).toBe('Bearer synthetic-session-token');expect(options.disableRedirects).toBe(true);expect(options.connectTimeout).toBe(12000);expect(options.readTimeout).toBeLessThanOrEqual(55000)
 }
 expect(f.http.post.mock.calls[1][0]).toMatchObject({data:{action:'reconcile',operationId:b,productId:sku,purchaseToken:tx.purchaseToken}})
 expect(JSON.stringify(f.http.post.mock.calls[1][0])).not.toContain('accountId')
})
it('rejects another account, pending transactions, event purchases and unexpected protocol responses',async()=>{
 const f=setup();f.switchOwner(b);await expect(f.service.context(a)).rejects.toThrow('owner_changed');expect(f.http.get).not.toHaveBeenCalled()
 f.switchOwner(a);await expect(f.service.prepare(a,{productId:GOOGLE_PLAY_PRODUCTS[1].id,targetId:b})).rejects.toThrow('google_products_unavailable');expect(f.http.post).not.toHaveBeenCalled()
 f.http.get.mockResolvedValueOnce(f.response({ok:true,googlePurchases:1,ownerId:b,enabled:true}));await expect(f.service.context(a)).rejects.toThrow('google_unavailable')
 f.http.get.mockImplementationOnce(async()=>{f.switchOwner(b);return f.response({ok:true,googlePurchases:1,ownerId:a})});await expect(f.service.context(a)).rejects.toThrow('owner_changed')
})
