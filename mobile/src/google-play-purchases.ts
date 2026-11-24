import {Capacitor,registerPlugin,type PluginListenerHandle} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {googleBinding,googlePlayProduct,googleTransaction,type GooglePlayTransaction} from '../../lib/google-play-products'

export type GooglePlayStore={
 products:(options:{productId:string})=>Promise<unknown>
 purchase:(options:{productId:string;accountId:string;profileId:string|null})=>Promise<unknown>
 pending:()=>Promise<unknown>
 manage:()=>Promise<void>
 addListener:(name:'transactionsChanged',listener:()=>void)=>Promise<PluginListenerHandle>
}
// The app must supply authenticated, durable server fulfillment before mounting checkout.
// A local purchase result never grants access or acknowledges/consumes a purchase.
export type GooglePlayFulfillment={
 context:(owner:string)=>Promise<unknown>
 prepare:(owner:string,intent:{productId:string;targetId:string|null})=>Promise<unknown>
 reconcile:(owner:string,transaction:GooglePlayTransaction,operationId:string)=>Promise<unknown>
}
export const NativeGooglePlay=registerPlugin<GooglePlayStore>('TiqGooglePurchases')
const errorCodes=new Set(['google_store_unavailable','google_products_unavailable','google_purchase_in_progress','google_purchase_sync_pending','google_existing_purchase','google_account_mismatch','google_existing_access','google_purchase_pending','google_unavailable','owner_changed','sign_in_required','try_later'])
export class GooglePlayPurchaseError extends Error {
 constructor(code:string){super(errorCodes.has(code)?code:'google_unavailable')}
}
function fail(code='google_unavailable'):never{throw new GooglePlayPurchaseError(code)}
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:fail()
const nativeError=(value:unknown)=>{
 const r=value&&typeof value==='object'?value as {code?:unknown;message?:unknown}:{}
 return new GooglePlayPurchaseError(typeof r.code==='string'?r.code:typeof r.message==='string'?r.message:'google_unavailable')
}
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const tokenHash=async(token:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('')

export function createGooglePlayPurchases(client:SupabaseClient,fulfillment:GooglePlayFulfillment,options:{store?:GooglePlayStore;platform?:string;available?:boolean;autoRecover?:boolean}={}){
 const platform=options.platform??Capacitor.getPlatform(),store=options.store??NativeGooglePlay
 const available=platform==='android'&&(options.available??Capacitor.isPluginAvailable('TiqGooglePurchases'))
 let owner:string|null=null,epoch=0,disposed=false,busy=false,refreshRequested=false,handle:PluginListenerHandle|undefined
 const operations=new Map<string,string>(),inflight=new Map<string,Promise<boolean>>(),listeners=new Set<()=>void>(),busyListeners=new Set<()=>void>()
 const notifyBusy=()=>{for(const listener of busyListeners){try{listener()}catch{/* Display updates cannot interrupt billing. */}}}
 async function session(expected:string,visit:number){
  if(disposed||epoch!==visit||owner!==expected)fail('owner_changed')
  const result=await client.auth.getSession()
  if(disposed||epoch!==visit||owner!==expected||result.error||result.data.session?.user.id!==expected)fail('owner_changed')
 }
 async function native<T>(work:()=>Promise<T>,expected:string,visit:number){
  await session(expected,visit)
  try{const value=await work();await session(expected,visit);return value}catch(error){await session(expected,visit);throw nativeError(error)}
 }
 async function context(expected:string,visit:number){
  await session(expected,visit);const data=record(await fulfillment.context(expected));await session(expected,visit)
  if(data.enabled!==true){if(data.enabled===false)fail('google_store_unavailable');fail()}
  if(!googleBinding(data.accountId)||typeof data.canPurchase!=='boolean')fail()
  return {accountId:data.accountId,canPurchase:data.canPurchase}
 }
 async function deliver(expected:string,visit:number,tx:GooglePlayTransaction){
  if(!googleTransaction(tx)||tx.state!=='purchased')fail()
  const digest=await tokenHash(tx.purchaseToken),key=visit+':'+digest,prior=inflight.get(key)
  if(prior)return prior
  const work=(async()=>{
   await session(expected,visit)
   let operation=operations.get(key);if(!operation){operation=crypto.randomUUID();operations.set(key,operation)}
   const receipt=record(await fulfillment.reconcile(expected,tx,operation));await session(expected,visit)
   if(receipt.delivered!==true||receipt.settled!==true||receipt.productId!==tx.productId||receipt.tokenHash!==digest||receipt.accountId!==tx.accountId||receipt.profileId!==tx.profileId||typeof receipt.active!=='boolean')fail('google_purchase_sync_pending')
   operations.delete(key)
   for(const listener of listeners){try{listener()}catch{/* Display changes cannot interrupt delivery. */}}
   return receipt.active
  })();inflight.set(key,work)
  try{return await work}finally{if(inflight.get(key)===work)inflight.delete(key)}
 }
 async function recoverInside(expected:string,visit:number){
  const account=await context(expected,visit),data=record(await native(()=>store.pending(),expected,visit))
  if(!Array.isArray(data.transactions)||data.transactions.length>50||data.transactions.some(row=>!googleTransaction(row)))fail()
  const rows=data.transactions as GooglePlayTransaction[],seen=new Set<string>();let restored=0,pending=0,foreign=0
  for(const tx of rows){if(seen.has(tx.purchaseToken))fail();seen.add(tx.purchaseToken)}
  for(const tx of rows){
   if(tx.accountId!==account.accountId){foreign++;continue}
   if(tx.state==='pending'){pending++;continue}
   if(await deliver(expected,visit,tx))restored++
  }
  return {restored,pending,foreign,transactions:rows}
 }
 async function exclusive<T>(expected:string,work:(visit:number)=>Promise<T>){
  if(!available||disposed)fail('google_store_unavailable')
  if(busy)fail('google_purchase_in_progress')
  busy=true;notifyBusy();const visit=epoch
  try{await session(expected,visit);return await work(visit)}finally{
   busy=false;notifyBusy()
   if(refreshRequested){refreshRequested=false;if(owner&&!disposed)void recover(owner).catch(()=>{})}
  }
 }
 async function recover(expected:string){
  const result=await exclusive(expected,visit=>recoverInside(expected,visit))
  return {restored:result.restored,pending:result.pending,foreign:result.foreign}
 }
 if(available)void store.addListener('transactionsChanged',()=>{if(!owner||disposed)return;if(busy){refreshRequested=true;return}void recover(owner).catch(()=>{})}).then(listener=>{if(disposed)void listener.remove();else handle=listener}).catch(()=>{})
 return {available,isBusy:()=>busy,
  setOwner(next:string|null){
   if(owner===next)return;owner=next;epoch++;operations.clear();refreshRequested=false
   if(next&&available&&!disposed&&options.autoRecover!==false){
    if(busy)refreshRequested=true
    else{const visit=epoch;queueMicrotask(()=>{if(!disposed&&epoch===visit)void recover(next).catch(()=>{})})}
   }
  },
  recover,
  async product(expected:string,productId:string){
   const product=googlePlayProduct(productId);if(!product)fail()
   return exclusive(expected,async visit=>{
    const account=await context(expected,visit);if(!account.canPurchase)fail('google_existing_access')
    const data=record(await native(()=>store.products({productId}),expected,visit))
    if(data.available!==true||!Array.isArray(data.products)||data.products.length!==1)fail('google_products_unavailable')
    const row=record(data.products[0])
    if(row.id!==product.id||row.type!==product.type||row.currency!=='USD'||row.micros!==product.amountCents*10000||typeof row.price!=='string'||!row.price.trim()||row.price.length>80||product.type==='subs'&&row.period!=='P1M')fail('google_products_unavailable')
    return {productId:product.id,name:product.name,price:row.price}
   })
  },
  async purchase(expected:string,productId:string,targetId:string|null=null){
   const product=googlePlayProduct(productId)
   if(!product||(product.kind==='pro'?targetId!==null:!uuid(targetId)))fail()
   return exclusive(expected,async visit=>{
    const recovered=await recoverInside(expected,visit)
    if(recovered.transactions.some(tx=>tx.productId===productId&&tx.state==='pending'))return 'pending' as const
    const account=await context(expected,visit);if(!account.canPurchase)fail('google_existing_access')
    const prepared=record(await fulfillment.prepare(expected,{productId,targetId}));await session(expected,visit)
    if(prepared.productId!==productId||prepared.targetId!==targetId||prepared.accountId!==account.accountId||(product.kind==='pro'?prepared.profileId!==null:!googleBinding(prepared.profileId)))fail()
    const result=record(await native(()=>store.purchase({productId,accountId:account.accountId,profileId:prepared.profileId as string|null}),expected,visit))
    if(result.state==='cancelled'||result.state==='pending')return result.state
    if(!googleTransaction(result)||result.state!=='purchased'||result.productId!==productId||result.accountId!==account.accountId||result.profileId!==prepared.profileId)fail('google_account_mismatch')
    const active=await deliver(expected,visit,result);if(!active)fail('google_purchase_sync_pending')
    return 'purchased' as const
   })
  },
  async manage(expected:string){return exclusive(expected,visit=>native(()=>store.manage(),expected,visit))},
  subscribe(listener:()=>void){listeners.add(listener);return()=>listeners.delete(listener)},
  subscribeBusy(listener:()=>void){busyListeners.add(listener);return()=>busyListeners.delete(listener)},
  dispose(){disposed=true;epoch++;owner=null;operations.clear();listeners.clear();busyListeners.clear();void handle?.remove()},
 }
}
