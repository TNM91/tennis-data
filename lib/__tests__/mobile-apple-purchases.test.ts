import {describe,expect,it,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {createApplePurchases,parseAppleContext,type AppleStore} from '../../mobile/src/apple-purchases'
const owner='11111111-1111-4111-8111-111111111111',token='33333333-3333-4333-8333-333333333333',sku='com.tenaceiq.app.player.monthly'
const tx={transactionId:'1002',accountToken:token,signedTransaction:'signed.receipt.sig'}
function fixture(){
 let who=owner,status=200,receiptToken=token
 const client={auth:{getSession:vi.fn(async()=>({data:{session:{user:{id:who},access_token:'synthetic-token'}},error:null}))}} as unknown as SupabaseClient
 const store={products:vi.fn(async()=>({available:true,products:[{id:sku,price:'$1.99'},{id:'com.tenaceiq.app.captain.monthly',price:'$4.99'}]})),pending:vi.fn(async()=>({transactions:[]})),purchase:vi.fn(async()=>({state:'purchased' as const,...tx})),restore:vi.fn(async()=>({transactions:[tx]})),finish:vi.fn(async()=>({finished:true})),manage:vi.fn(async()=>{}),addListener:vi.fn(async()=>({remove:async()=>{}}))} satisfies AppleStore
 const get=vi.fn(async()=>({status:200,data:{ok:true,applePurchases:1,enabled:false}}))
 const post=vi.fn(async(options:{data?:unknown})=>{const body=options.data as {action:string};return {status,data:body.action==='prepare'?{ok:true,applePurchases:1,productId:sku,accountToken:token,environment:'Sandbox'}:{ok:status===200,applePurchases:1,receipt:{transactionId:tx.transactionId,accountToken:receiptToken,environment:'Sandbox'}}}})
 const service=createApplePurchases(client,{store,http:{get,post} as never,available:true})
 return {service,store,get,post,switchOwner(){who='22222222-2222-4222-8222-222222222222'},fail(){status=503},wrongReceipt(){receiptToken='44444444-4444-4444-8444-444444444444'}}
}
describe('native Apple purchase delivery',()=>{
 it('finishes only after a durable server receipt for the same account and transaction',async()=>{
  const f=fixture();expect(await f.service.purchase(owner,sku)).toBe('purchased');expect(f.post).toHaveBeenCalledTimes(2);expect(f.store.finish).toHaveBeenCalledExactlyOnceWith(expect.objectContaining(tx))
  const call=f.post.mock.calls[1][0] as {url:string;headers:unknown;data:Record<string,unknown>;disableRedirects:boolean;readTimeout:number}
  expect(call).toMatchObject({url:'https://www.tenaceiq.com/api/mobile/apple-purchases',headers:{Authorization:'Bearer synthetic-token'},disableRedirects:true,readTimeout:55000,data:{action:'reconcile',signedTransaction:tx.signedTransaction}})
  expect(Object.keys(call.data).sort()).toEqual(['action','operationId','signedTransaction']);expect(f.store.finish.mock.invocationCallOrder[0]).toBeGreaterThan(f.post.mock.invocationCallOrder[1])
 })
 it('leaves transactions unfinished when delivery fails, the receipt mismatches, or the account changes',async()=>{
  for(const breakIt of [(f:ReturnType<typeof fixture>)=>f.fail(),(f:ReturnType<typeof fixture>)=>f.wrongReceipt(),(f:ReturnType<typeof fixture>)=>f.switchOwner()]){
   const f=fixture();f.store.purchase.mockImplementationOnce(async()=>{breakIt(f);return {state:'purchased',...tx}})
   await expect(f.service.purchase(owner,sku)).rejects.toThrow();expect(f.store.finish).not.toHaveBeenCalled()
  }
 })
 it('treats canceled and pending purchases as outcomes without granting or finishing',async()=>{
  for(const state of ['cancelled','pending'] as const){const f=fixture();f.store.purchase.mockResolvedValueOnce({state} as never);expect(await f.service.purchase(owner,sku)).toBe(state);expect(f.post).toHaveBeenCalledOnce();expect(f.store.finish).not.toHaveBeenCalled()}
 })
 it('uses explicit restore and never calls App Store sync during ordinary recovery',async()=>{
  const f=fixture();expect(await f.service.recover(owner)).toBe(0);expect(f.store.restore).not.toHaveBeenCalled();expect(f.post).not.toHaveBeenCalled()
  expect(await f.service.restore(owner,'Sandbox')).toBe(1);expect(f.store.restore).toHaveBeenCalledExactlyOnceWith({environment:'Sandbox'});expect(f.store.finish).toHaveBeenCalledOnce()
 })
 it('stops a new buy when an unfinished earlier purchase cannot sync',async()=>{
  const f=fixture();f.store.pending.mockResolvedValueOnce({transactions:[tx]} as never);f.fail();await expect(f.service.purchase(owner,sku)).rejects.toThrow();expect(f.store.purchase).not.toHaveBeenCalled();expect(f.store.finish).not.toHaveBeenCalled()
 })
 it('does not turn a malformed availability response or an unknown SKU into a purchase',async()=>{
  expect(parseAppleContext({ok:true,applePurchases:1,enabled:false})).toEqual({enabled:false});for(const v of [{ok:true,enabled:true},{ok:true,applePurchases:1,enabled:true,canPurchase:true,environment:'Sandbox',webAccess:false,activeProductId:null,products:[{id:sku},{id:sku}]}])expect(()=>parseAppleContext(v)).toThrow()
  const f=fixture();await expect(f.service.purchase(owner,'com.tenaceiq.app.coach.monthly')).rejects.toThrow();expect(f.post).not.toHaveBeenCalled();expect(f.store.purchase).not.toHaveBeenCalled()
 })
})

it('price discovery never starts a purchase, restores, grants access or finishes a transaction',async()=>{
 const f=fixture();f.store.products.mockResolvedValueOnce({available:true,products:[{id:sku,price:'$1.99'}]})
 expect(await f.service.products(owner,'Sandbox')).toMatchObject([{productId:sku,price:'$1.99'}])
 expect(f.store.products).toHaveBeenCalledExactlyOnceWith({environment:'Sandbox'})
 for(const method of [f.store.purchase,f.store.restore,f.store.finish,f.post])expect(method).not.toHaveBeenCalled()
})
it('keeps safe native product failure details and refuses prices after an account switch',async()=>{
 const f=fixture();f.store.products.mockRejectedValueOnce({code:'products_request_failed',data:{supportCode:'ASDErrorDomain:500'},message:'private'})
 await expect(f.service.products(owner,'Sandbox')).rejects.toMatchObject({code:'products_request_failed',supportCode:'ASDErrorDomain:500'})
 const changed=fixture();changed.store.products.mockImplementationOnce(async()=>{changed.switchOwner();return {available:true,products:[{id:sku,price:'$1.99'}]}})
 await expect(changed.service.products(owner,'Sandbox')).rejects.toThrow('owner_changed')
 expect(changed.store.purchase).not.toHaveBeenCalled();expect(changed.post).not.toHaveBeenCalled()
})
