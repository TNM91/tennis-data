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

it('coalesces earlier-purchase checks instead of starting overlapping StoreKit reads',async()=>{
 const f=fixture();let release!:(v:{transactions:[]})=>void;f.store.pending.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve}))
 const first=f.service.recover(owner),second=f.service.recover(owner);await vi.waitFor(()=>expect(f.store.pending).toHaveBeenCalledOnce());release({transactions:[]});expect(await Promise.all([first,second])).toEqual([0,0]);expect(f.post).not.toHaveBeenCalled()
})
it('refuses another purchase, restore or manage while confirmation is unresolved, then unlocks after cancellation',async()=>{
 const f=fixture();let finish!:(v:never)=>void;f.store.purchase.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
 const first=f.service.purchase(owner,sku);await vi.waitFor(()=>expect(f.store.purchase).toHaveBeenCalledOnce())
 await expect(f.service.purchase(owner,sku)).rejects.toThrow('purchase_in_progress');await expect(f.service.restore(owner,'Sandbox')).rejects.toThrow('purchase_in_progress');await expect(f.service.manage(owner)).rejects.toThrow('purchase_in_progress');expect(f.post).toHaveBeenCalledOnce()
 finish({state:'cancelled'} as never);expect(await first).toBe('cancelled');expect(await f.service.purchase(owner,sku)).toBe('purchased');expect(f.store.purchase).toHaveBeenCalledTimes(2)
})
it('reports safe pre-confirmation timeouts without granting or retrying a purchase automatically',async()=>{
 for(const phase of ['history','prepare','native'] as const){const f=fixture();if(phase==='history')f.store.pending.mockRejectedValueOnce({code:'purchase_history_timeout',message:'private'});else if(phase==='prepare')f.fail();else f.store.purchase.mockRejectedValueOnce({code:'purchase_preparation_timeout',message:'private'})
 await expect(f.service.purchase(owner,sku)).rejects.toMatchObject({beforeConfirmation:true});expect(f.store.finish).not.toHaveBeenCalled();expect(f.post).toHaveBeenCalledTimes(phase==='history'?0:1);expect(f.store.purchase).toHaveBeenCalledTimes(phase==='native'?1:0)
 }
})
it('keeps purchase stage updates separate from successful transaction delivery',async()=>{
 const f=fixture(),phases:string[]=[];await f.service.purchase(owner,sku,phase=>{phases.push(phase);if(phase==='confirm')throw Error('display callback')});expect(phases).toEqual(['history','prepare','confirm','sync','finish']);expect(f.store.finish).toHaveBeenCalledOnce()
 const g=fixture();g.store.purchase.mockRejectedValueOnce({code:'private-secret',message:'private text'});await expect(g.service.purchase(owner,sku)).rejects.toMatchObject({message:'store_unavailable',beforeConfirmation:false})
})
it('discards a native failure received after the account changes',async()=>{
 const f=fixture();f.store.purchase.mockImplementationOnce(async()=>{f.switchOwner();throw {code:'purchase_preparation_timeout'}});await expect(f.service.purchase(owner,sku)).rejects.toThrow('owner_changed');expect(f.store.finish).not.toHaveBeenCalled()
})

it('keeps safe native failure details without acknowledging or retrying a failed purchase',async()=>{
 const f=fixture();f.store.purchase.mockRejectedValueOnce({code:'store_unavailable',data:{supportCode:'confirmation/SKErrorDomain:0',build:'168'},message:'private Apple account'})
 await expect(f.service.purchase(owner,sku)).rejects.toMatchObject({message:'store_unavailable',supportCode:'confirmation/SKErrorDomain:0',build:'168',beforeConfirmation:false});expect(f.store.purchase).toHaveBeenCalledOnce();expect(f.store.finish).not.toHaveBeenCalled();expect(f.post).toHaveBeenCalledOnce()
})
it('normalizes restore failures and rejects them after an account switch',async()=>{
 const f=fixture();f.store.restore.mockRejectedValueOnce({code:'store_unavailable',data:{supportCode:'restore/StoreKit.StoreKitError:0'},message:'private Apple account'})
 await expect(f.service.restore(owner,'Sandbox')).rejects.toMatchObject({message:'restore_unavailable',supportCode:'restore/StoreKit.StoreKitError:0'});expect(f.store.finish).not.toHaveBeenCalled();expect(f.post).not.toHaveBeenCalled()
 const changed=fixture();changed.store.restore.mockImplementationOnce(async()=>{changed.switchOwner();throw {code:'store_unavailable'}});await expect(changed.service.restore(owner,'Sandbox')).rejects.toThrow('owner_changed')
})

it('restores verified history through the server before finishing and blocks other operations until complete',async()=>{
 const f=fixture();let release!:(v:{transactions:typeof tx[]})=>void;f.store.restore.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve}))
 const first=f.service.restore(owner,'Sandbox');await vi.waitFor(()=>expect(f.store.restore).toHaveBeenCalledOnce())
 await expect(f.service.purchase(owner,sku)).rejects.toThrow('purchase_in_progress');await expect(f.service.restore(owner,'Sandbox')).rejects.toThrow('purchase_in_progress');await expect(f.service.manage(owner)).rejects.toThrow('purchase_in_progress');expect(f.post).not.toHaveBeenCalled()
 release({transactions:[tx]});expect(await first).toBe(1);expect(f.post).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({data:expect.objectContaining({action:'reconcile',signedTransaction:tx.signedTransaction})}));expect(f.store.finish.mock.invocationCallOrder[0]).toBeGreaterThan(f.post.mock.invocationCallOrder[0]);expect(f.store.purchase).not.toHaveBeenCalled();await f.service.manage(owner);expect(f.store.manage).toHaveBeenCalledOnce()
})
it('never finishes restored transactions when server delivery, acknowledgment or owner verification fails',async()=>{
 for(const breakIt of [(f:ReturnType<typeof fixture>)=>f.fail(),(f:ReturnType<typeof fixture>)=>f.wrongReceipt(),(f:ReturnType<typeof fixture>)=>f.switchOwner()]){
  const f=fixture();f.store.restore.mockImplementationOnce(async()=>{breakIt(f);return {transactions:[tx]}});await expect(f.service.restore(owner,'Sandbox')).rejects.toThrow();expect(f.store.finish).not.toHaveBeenCalled();expect(f.store.purchase).not.toHaveBeenCalled()
 }
})
it('keeps restore failure messages separate from purchases, makes no acknowledgment, and allows an explicit retry',async()=>{
 for(const code of ['store_unavailable','restore_unavailable','restore_history_timeout','restore_cancelled','private_code']){
  const f=fixture();f.store.restore.mockRejectedValueOnce({code,data:{supportCode:'restore/StoreKit.StoreKitError:2',build:'171'},message:'Private Apple account text'})
  await expect(f.service.restore(owner,'Sandbox')).rejects.toMatchObject({message:code.startsWith('restore_')?code:'restore_unavailable',supportCode:'restore/StoreKit.StoreKitError:2',build:'171',beforeConfirmation:false});expect(f.post).not.toHaveBeenCalled();expect(f.store.finish).not.toHaveBeenCalled();expect(f.store.purchase).not.toHaveBeenCalled();expect(await f.service.restore(owner,'Sandbox')).toBe(1)
 }
})
