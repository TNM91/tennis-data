import {Capacitor,CapacitorHttp,registerPlugin,type HttpOptions,type HttpResponse,type PluginListenerHandle} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {appleMembershipProduct,APPLE_MEMBERSHIP_PRODUCTS} from '../../lib/apple-membership-products'
import {appleUuid,appleTransactionId,type AppleEnvironment} from '../../lib/apple-purchase-contract'
export type AppleTransaction={transactionId:string;accountToken:string;signedTransaction:string}
export type AppleStore={products:(options:{environment:AppleEnvironment})=>Promise<{available:boolean;products:{id:string;price:string}[]}>;purchase:(options:{productId:string;accountToken:string;environment:AppleEnvironment})=>Promise<{state:'purchased'|'cancelled'|'pending'}&Partial<AppleTransaction>>;pending:()=>Promise<{transactions:AppleTransaction[]}>;restore:(options:{environment:AppleEnvironment})=>Promise<{transactions:AppleTransaction[]}>;finish:(options:AppleTransaction)=>Promise<{finished:boolean}>;manage:()=>Promise<void>;addListener:(event:'transactionsChanged',listener:()=>void)=>Promise<PluginListenerHandle>}
export type AppleContext={enabled:false}|{enabled:true;environment:AppleEnvironment;canPurchase:boolean;webAccess:boolean;activeProductId:string|null}
const NativeApple=registerPlugin<AppleStore>('TiqPurchases')
const transaction=(v:unknown):v is AppleTransaction=>!!v&&typeof v==='object'&&appleTransactionId((v as AppleTransaction).transactionId)&&appleUuid((v as AppleTransaction).accountToken)&&typeof(v as AppleTransaction).signedTransaction==='string'&&(v as AppleTransaction).signedTransaction.length<=24000
export function parseAppleContext(value:unknown):AppleContext{
 if(!value||typeof value!=='object')throw Error('apple_unavailable')
 const r=value as Record<string,unknown>
 if(r.ok!==true||r.applePurchases!==1||typeof r.enabled!=='boolean')throw Error('apple_unavailable')
 if(!r.enabled)return {enabled:false}
 if(!['Production','Sandbox'].includes(String(r.environment))||typeof r.canPurchase!=='boolean'||typeof r.webAccess!=='boolean'||r.activeProductId!==null&&!appleMembershipProduct(r.activeProductId)||!Array.isArray(r.products)||r.products.length!==2||new Set(r.products.map(p=>p?.id)).size!==2||r.products.some(p=>!appleMembershipProduct(p?.id)))throw Error('apple_unavailable')
 return {enabled:true,environment:r.environment as AppleEnvironment,canPurchase:r.canPurchase,webAccess:r.webAccess,activeProductId:r.activeProductId as string|null}
}
export function createApplePurchases(client:SupabaseClient,options:{store?:AppleStore;available?:boolean;platform?:string;http?:{get:(o:HttpOptions)=>Promise<HttpResponse>;post:(o:HttpOptions)=>Promise<HttpResponse>}}={}){
 const platform=options.platform??Capacitor.getPlatform(),store=options.store||NativeApple,http=options.http||CapacitorHttp,available=options.available??(platform==='ios'&&Capacitor.isPluginAvailable('TiqPurchases'))
 let owner:string|null=null
 const operations=new Map<string,{jws:string;id:string}>(),inflight=new Map<string,Promise<void>>(),listeners=new Set<()=>void>()
 async function session(expected:string){const s=await client.auth.getSession();if(s.error||s.data.session?.user.id!==expected)throw Error('owner_changed');return s.data.session}
 async function request(expected:string,body?:Record<string,unknown>){
  const before=await session(expected),settings={url:'https://www.tenaceiq.com/api/mobile/apple-purchases',headers:{Authorization:'Bearer '+before.access_token,...(body?{'Content-Type':'application/json'}:{})},responseType:'json' as const,disableRedirects:true,connectTimeout:12000,readTimeout:body?55000:12000}
  const response=body?await http.post({...settings,data:body}):await http.get(settings)
  await session(expected)
  if(response.status!==200||response.data?.ok!==true)throw Error(['purchase_account_mismatch','existing_access','purchase_sync_pending','try_later','sign_in_required'].includes(response.data?.code)?response.data.code:'apple_unavailable')
  return response.data
 }
 const context=async(expected:string)=>parseAppleContext(await request(expected))
 async function reconcile(expected:string,tx:AppleTransaction){
  if(!transaction(tx))throw Error('apple_unavailable')
  const key=expected+':'+tx.transactionId,existing=inflight.get(key);if(existing)return existing
  const run=(async()=>{
   let operation=operations.get(key)
   if(!operation||operation.jws!==tx.signedTransaction){operation={jws:tx.signedTransaction,id:crypto.randomUUID()};operations.set(key,operation)}
   const r=await request(expected,{action:'reconcile',operationId:operation.id,signedTransaction:tx.signedTransaction}),receipt=r.receipt
   if(r.applePurchases!==1||receipt?.transactionId!==tx.transactionId||receipt.accountToken?.toLowerCase()!==tx.accountToken.toLowerCase()||!['Production','Sandbox'].includes(receipt.environment))throw Error('apple_unavailable')
   await session(expected)
   const finished=await store.finish(tx)
   if(finished.finished!==true)throw Error('purchase_sync_pending')
   operations.delete(key);listeners.forEach(fn=>fn())
  })();inflight.set(key,run)
  try{await run}finally{if(inflight.get(key)===run)inflight.delete(key)}
 }
 function transactions(value:{transactions:AppleTransaction[]}){if(!Array.isArray(value.transactions)||value.transactions.length>50||value.transactions.some(tx=>!transaction(tx)))throw Error('apple_unavailable');return value.transactions}
 async function recover(expected:string){if(!available)return 0;await session(expected);const rows=transactions(await store.pending());for(const tx of rows)await reconcile(expected,tx);return rows.length}
 if(available)void store.addListener('transactionsChanged',()=>{if(owner)void recover(owner).catch(()=>{})}).catch(()=>{})
 return {available,isIos:platform==='ios',context,
  setOwner(next:string|null){if(next===owner)return;owner=next;operations.clear();if(next&&available)void recover(next).catch(()=>{})},
  recover,
  async products(expected:string,environment:AppleEnvironment){await session(expected);const r=await store.products({environment});await session(expected);if(r.available!==true||!Array.isArray(r.products)||r.products.length!==2||new Set(r.products.map(p=>p.id)).size!==2||r.products.some(p=>!appleMembershipProduct(p.id)||typeof p.price!=='string'||!p.price.trim()||p.price.length>64))throw Error('products_unavailable');return APPLE_MEMBERSHIP_PRODUCTS.map(p=>({...p,price:r.products.find(v=>v.id===p.productId)!.price}))},
  async purchase(expected:string,productId:string){
   if(!available||!appleMembershipProduct(productId))throw Error('apple_unavailable')
   await recover(expected)
   const prepared=await request(expected,{action:'prepare',productId})
   if(prepared.applePurchases!==1||prepared.productId!==productId||!appleUuid(prepared.accountToken)||!['Production','Sandbox'].includes(prepared.environment))throw Error('apple_unavailable')
   await session(expected)
   const r=await store.purchase({productId,accountToken:prepared.accountToken,environment:prepared.environment})
   await session(expected)
   if(r.state==='cancelled'||r.state==='pending')return r.state
   if(r.state!=='purchased'||!transaction(r)||r.accountToken.toLowerCase()!==prepared.accountToken.toLowerCase())throw Error('apple_unavailable')
   await reconcile(expected,r);return 'purchased' as const
  },
  async restore(expected:string,environment:AppleEnvironment){await session(expected);const rows=transactions(await store.restore({environment}));await session(expected);for(const tx of rows)await reconcile(expected,tx);return rows.length},
  async manage(expected:string){await session(expected);await store.manage()},
  subscribe(fn:()=>void){listeners.add(fn);return()=>listeners.delete(fn)}
 }
}
export type ApplePurchases=ReturnType<typeof createApplePurchases>
const services=new WeakMap<SupabaseClient,ApplePurchases>()
export function applePurchases(client:SupabaseClient){let service=services.get(client);if(!service){service=createApplePurchases(client);services.set(client,service)}return service}
