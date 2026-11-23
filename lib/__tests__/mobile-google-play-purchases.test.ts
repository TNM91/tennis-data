import {describe,it,expect,vi} from 'vitest'
import {createHash} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
vi.mock('@capacitor/core',()=>({Capacitor:{getPlatform:()=> 'web',isPluginAvailable:()=>false},registerPlugin:()=>({})}))
import {createGooglePlayPurchases,type GooglePlayFulfillment,type GooglePlayStore} from '../../mobile/src/google-play-purchases'
import {GOOGLE_PLAY_PRODUCTS,type GooglePlayTransaction} from '../google-play-products'

const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',account='a'.repeat(64),profile='b'.repeat(64),target='33333333-3333-4333-8333-333333333333'
const pro=GOOGLE_PLAY_PRODUCTS[0],tournament=GOOGLE_PLAY_PRODUCTS[1],league=GOOGLE_PLAY_PRODUCTS[2]
const transaction=(productId:string=pro.id):GooglePlayTransaction=>({productId,purchaseToken:'synthetic-purchase-token-11111',accountId:account,profileId:productId===pro.id?null:profile,state:'purchased',quantity:1,acknowledged:false,suspended:false})
const receipt=(tx:GooglePlayTransaction)=>({delivered:true,settled:true,active:true,productId:tx.productId,tokenHash:createHash('sha256').update(tx.purchaseToken).digest('hex'),accountId:tx.accountId,profileId:tx.profileId})
function setup(){
 let current=a,changed:(()=>void)|undefined
 const remove=vi.fn(async()=>{}),client={auth:{getSession:vi.fn(async()=>({data:{session:{user:{id:current}}},error:null}))}} as unknown as SupabaseClient
 const store={products:vi.fn(async()=>({available:true,products:[{id:pro.id as string,type:'subs',currency:'USD',micros:4990000,price:'$4.99',period:'P1M'}]})),purchase:vi.fn(async()=>transaction()),pending:vi.fn(async()=>({transactions:[] as GooglePlayTransaction[]})),manage:vi.fn(async()=>{}),addListener:vi.fn(async(_name:string,fn:()=>void)=>{changed=fn;return {remove}})}
 const fulfillment={context:vi.fn(async()=>({enabled:true,canPurchase:true,accountId:account})),prepare:vi.fn(async(_owner:string,intent:{productId:string;targetId:string|null})=>({...intent,accountId:account,profileId:intent.productId===pro.id?null:profile})),reconcile:vi.fn(async(_owner:string,tx:GooglePlayTransaction,operationId:string)=>{expect(operationId).toMatch(/^[a-f0-9-]{36}$/);return receipt(tx)})}
 const service=createGooglePlayPurchases(client,fulfillment as GooglePlayFulfillment,{store:store as GooglePlayStore,available:true,platform:'android',autoRecover:false});service.setOwner(a)
 return {service,store,fulfillment,client,remove,switchOwner(next:string){current=next;service.setOwner(next)},changed:()=>changed?.()}
}

describe('Google native purchase delivery',()=>{
 it('does not install listeners or call Android billing on iOS even when available is incorrectly requested',async()=>{
  const f=setup();f.service.dispose();const store={...f.store,addListener:vi.fn()}
  const ios=createGooglePlayPurchases(f.client,f.fulfillment,{store,platform:'ios',available:true});ios.setOwner(a)
  expect(ios.available).toBe(false);await expect(ios.purchase(a,pro.id)).rejects.toThrow('google_store_unavailable');expect(store.addListener).not.toHaveBeenCalled()
 })
 it('uses the Google catalog price and suppresses an incorrect amount, period, currency or duplicate product',async()=>{
  const f=setup();expect(await f.service.product(a,pro.id)).toEqual({productId:pro.id,name:'TenAceIQ Pro',price:'$4.99'})
  const row={id:pro.id,type:'subs',currency:'USD',micros:4990000,price:'$4.99',period:'P1M'}
  for(const patch of [{micros:9990000},{period:'P1Y'},{currency:'CAD'},{id:league.id},{price:''}]){
   f.store.products.mockResolvedValueOnce({available:true,products:[{...row,...patch}]});await expect(f.service.product(a,pro.id)).rejects.toThrow('google_products_unavailable')
  }
  f.store.products.mockResolvedValueOnce({available:true,products:[row,row]});await expect(f.service.product(a,pro.id)).rejects.toThrow('google_products_unavailable')
  f.service.dispose()
 })
 it('requires server readiness and existing-access checks before opening a Google confirmation',async()=>{
  const f=setup();f.fulfillment.context.mockResolvedValueOnce({enabled:false,canPurchase:false,accountId:account})
  await expect(f.service.purchase(a,pro.id)).rejects.toThrow('google_store_unavailable');expect(f.store.purchase).not.toHaveBeenCalled()
  f.fulfillment.context.mockResolvedValue({enabled:true,canPurchase:false,accountId:account})
  await expect(f.service.purchase(a,pro.id)).rejects.toThrow('google_existing_access');expect(f.fulfillment.prepare).not.toHaveBeenCalled();expect(f.store.purchase).not.toHaveBeenCalled();f.service.dispose()
 })
 it.each([pro,tournament,league])('delivers $kind only after an account-bound server receipt',async product=>{
  const f=setup(),tx=transaction(product.id);f.store.purchase.mockResolvedValueOnce(tx)
  expect(await f.service.purchase(a,product.id,product.kind==='pro'?null:target)).toBe('purchased')
  expect(f.store.purchase).toHaveBeenCalledWith({productId:product.id,accountId:account,profileId:tx.profileId})
  expect(f.fulfillment.reconcile).toHaveBeenCalledWith(a,tx,expect.stringMatching(/^[a-f0-9-]{36}$/));expect(f.service.isBusy()).toBe(false);f.service.dispose()
 })
 it.each(['cancelled','pending'])('does not grant, acknowledge or consume a %s payment',async state=>{
  const f=setup();f.store.purchase.mockResolvedValueOnce({state} as GooglePlayTransaction)
  expect(await f.service.purchase(a,pro.id)).toBe(state);expect(f.fulfillment.reconcile).not.toHaveBeenCalled();f.service.dispose()
 })
 it('checks unfinished payments before buying and skips purchases owned by another app account',async()=>{
  const f=setup(),tx=transaction();f.store.pending.mockResolvedValue({transactions:[{...tx,state:'pending'}]})
  expect(await f.service.purchase(a,pro.id)).toBe('pending');expect(f.store.purchase).not.toHaveBeenCalled();expect(f.fulfillment.prepare).not.toHaveBeenCalled()
  f.store.pending.mockResolvedValue({transactions:[{...tx,accountId:'c'.repeat(64)}]})
  expect(await f.service.recover(a)).toEqual({restored:0,pending:0,foreign:1});expect(f.fulfillment.reconcile).not.toHaveBeenCalled();f.service.dispose()
 })
 it('keeps an idempotency key after delivery fails and restores an already acknowledged payment',async()=>{
  const f=setup(),tx={...transaction(),acknowledged:true};f.store.pending.mockResolvedValue({transactions:[tx]});f.fulfillment.reconcile.mockRejectedValueOnce(Error('server unavailable'))
  await expect(f.service.recover(a)).rejects.toThrow();expect(f.service.isBusy()).toBe(false)
  expect(await f.service.recover(a)).toMatchObject({restored:1})
  expect(f.fulfillment.reconcile.mock.calls[0][2]).toBe(f.fulfillment.reconcile.mock.calls[1][2]);f.service.dispose()
 })
 it('does not treat an uncommitted, unsettled or foreign receipt as a successful purchase',async()=>{
  const f=setup(),tx=transaction(),good=receipt(tx)
  for(const patch of [{delivered:false},{settled:false},{accountId:'c'.repeat(64)},{profileId:profile},{tokenHash:'d'.repeat(64)},{productId:league.id}]){
   f.fulfillment.reconcile.mockResolvedValueOnce({...good,...patch});await expect(f.service.purchase(a,pro.id)).rejects.toThrow('google_purchase_sync_pending')
  }
  f.service.dispose()
 })
 it('rejects invalid event targets, a wrong prepare binding or transaction account before delivery',async()=>{
  const f=setup();await expect(f.service.purchase(a,tournament.id,null)).rejects.toThrow();expect(f.fulfillment.prepare).not.toHaveBeenCalled()
  f.fulfillment.prepare.mockResolvedValueOnce({productId:pro.id,targetId:null,accountId:'c'.repeat(64),profileId:null})
  await expect(f.service.purchase(a,pro.id)).rejects.toThrow();expect(f.store.purchase).not.toHaveBeenCalled()
  f.store.purchase.mockResolvedValueOnce({...transaction(),accountId:'c'.repeat(64)})
  await expect(f.service.purchase(a,pro.id)).rejects.toThrow('google_account_mismatch');expect(f.fulfillment.reconcile).not.toHaveBeenCalled();f.service.dispose()
 })
 it('holds the purchase lock across an account change and ignores late SDK results',async()=>{
  const f=setup();let release!:(value:GooglePlayTransaction)=>void
  f.store.purchase.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve}))
  const running=f.service.purchase(a,pro.id);await vi.waitFor(()=>expect(f.store.purchase).toHaveBeenCalled())
  f.switchOwner(b);await expect(f.service.purchase(b,pro.id)).rejects.toThrow('google_purchase_in_progress')
  release(transaction());await expect(running).rejects.toThrow('owner_changed');expect(f.fulfillment.reconcile).not.toHaveBeenCalled();expect(f.service.isBusy()).toBe(false);f.service.dispose()
 })
 it('prevents a stale prepare response from opening a charge after account switching',async()=>{
  const f=setup();let release!:(value:Awaited<ReturnType<typeof f.fulfillment.prepare>>)=>void
  f.fulfillment.prepare.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve}))
  const running=f.service.purchase(a,pro.id);await vi.waitFor(()=>expect(f.fulfillment.prepare).toHaveBeenCalled());f.switchOwner(b)
  release({productId:pro.id,targetId:null,accountId:account,profileId:null});await expect(running).rejects.toThrow('owner_changed');expect(f.store.purchase).not.toHaveBeenCalled();f.service.dispose()
 })
 it('rechecks suspended payments with the server without granting their cached local state',async()=>{
  const f=setup(),tx={...transaction(),suspended:true};f.store.pending.mockResolvedValue({transactions:[tx]});f.fulfillment.reconcile.mockResolvedValueOnce({...receipt(tx),active:false})
  expect(await f.service.recover(a)).toMatchObject({restored:0});expect(f.fulfillment.reconcile).toHaveBeenCalled();f.service.dispose()
 })
 it('rejects malformed and duplicate recovery results rather than processing a partial list',async()=>{
  const f=setup(),tx=transaction();f.store.pending.mockResolvedValueOnce({transactions:[{...tx,quantity:2} as unknown as GooglePlayTransaction]})
  await expect(f.service.recover(a)).rejects.toThrow();expect(f.fulfillment.reconcile).not.toHaveBeenCalled()
  f.store.pending.mockResolvedValueOnce({transactions:[tx,tx]});await expect(f.service.recover(a)).rejects.toThrow();f.service.dispose()
 })
 it('recovers on a native resume/update event and removes its listener when disposed',async()=>{
  const f=setup();f.store.pending.mockResolvedValue({transactions:[transaction()]});await Promise.resolve();f.changed()
  await vi.waitFor(()=>expect(f.fulfillment.reconcile).toHaveBeenCalledOnce());f.service.dispose();await Promise.resolve();expect(f.remove).toHaveBeenCalledOnce()
 })
 it('checks unfinished purchases when a signed-in account is first attached after a cold launch',async()=>{
  const f=setup();f.service.dispose();f.store.pending.mockResolvedValue({transactions:[transaction()]})
  const service=createGooglePlayPurchases(f.client,f.fulfillment,{store:f.store,available:true,platform:'android'});service.setOwner(a)
  await vi.waitFor(()=>expect(f.fulfillment.reconcile).toHaveBeenCalledOnce());service.dispose()
 })
})
