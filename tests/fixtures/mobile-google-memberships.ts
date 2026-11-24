import type {SupabaseClient} from '@supabase/supabase-js'
import {createGooglePlayPurchases,GooglePlayPurchaseError,type GooglePlayStore,type GooglePlayFulfillment} from '../../mobile/src/google-play-purchases'
import type {GooglePlayTransaction} from '../../lib/google-play-products'
import {createGoogleMembershipService} from '../../mobile/src/google-membership-service'
import {mountGoogleMemberships} from '../../mobile/src/google-memberships'

const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',accountId='a'.repeat(64),sku='com.tenaceiq.app.pro.monthly',mode=new URL(location.href).searchParams.get('mode')||'ready'
let active=false,currentOwner=owner,transactions:GooglePlayTransaction[]=[],nativeChanged:(()=>void)|undefined,releaseCheckout:(()=>void)|undefined
const calls={context:0,products:0,purchase:0,reconcile:0,manage:0,accessChanged:0,operations:[] as string[]}
const context=()=>({ok:true,googlePurchases:1,ownerId:owner,enabled:mode!=='inactive',environment:'Test',accountId,canPurchase:!active&&!['paused','web'].includes(mode),active,otherAccess:mode==='web',manageRequired:mode==='paused',products:[{id:sku,name:'TenAceIQ Pro'}]})
const client={auth:{getSession:async()=>({data:{session:{user:{id:currentOwner},access_token:'synthetic-google-session'}},error:null})}} as unknown as SupabaseClient
const fulfillment:GooglePlayFulfillment={
 async context(){calls.context++;return context()},
 async prepare(_owner,intent){return {...intent,accountId,profileId:null}},
 async reconcile(_owner,tx,operationId){
  calls.reconcile++;calls.operations.push(operationId)
  if(mode==='sync-error'&&calls.reconcile===1)throw new GooglePlayPurchaseError('google_unavailable')
  active=true
  const tokenHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(tx.purchaseToken))),byte=>byte.toString(16).padStart(2,'0')).join('')
  return {productId:sku,tokenHash,accountId,profileId:null,delivered:true,settled:true,active:true}
 },
}
const store:GooglePlayStore={
 async products(){calls.products++;if(mode==='price-error'&&calls.products===1)throw new GooglePlayPurchaseError('google_products_unavailable');return {available:true,products:[{id:sku,type:'subs',currency:'USD',micros:4990000,price:'$4.99',period:'P1M'}]}},
 async purchase(){
  calls.purchase++;if(mode==='slow')await new Promise<void>(resolve=>{releaseCheckout=resolve})
  if(mode==='cancel')return {state:'cancelled'}
  const tx:GooglePlayTransaction={productId:sku,purchaseToken:'synthetic-google-purchase-token-for-ui',accountId,profileId:null,state:mode==='pending'?'pending':'purchased',acknowledged:false,suspended:false,quantity:1}
  transactions=[tx];return tx
 },
 async pending(){return {transactions}},
 async manage(){calls.manage++},
 async addListener(_name,listener){nativeChanged=listener;return {remove:async()=>{nativeChanged=undefined}}},
}
const controller=createGooglePlayPurchases(client,fulfillment,{store,platform:'android',available:mode!=='unavailable',autoRecover:false})
const service=createGoogleMembershipService(client,{controller,fulfillment,app:{addListener:async()=>({remove:async()=>{}})} as never});service.setOwner(owner)
const dialog=document.querySelector<HTMLDialogElement>('dialog')!,host=document.querySelector<HTMLElement>('#membership')!
let panel:ReturnType<typeof mountGoogleMemberships>|undefined
function open(){panel=mountGoogleMemberships(host,client,owner,()=>currentOwner===owner,()=>{calls.accessChanged++},service);dialog.showModal()}
function close(){panel?.dispose();dialog.close()}
document.querySelector<HTMLButtonElement>('[data-close]')!.onclick=close
Object.assign(window,{googleMembershipFixture:{calls,approve(){transactions=transactions.map(tx=>({...tx,state:'purchased'}));nativeChanged?.()},finish(){releaseCheckout?.()},close,open,switchOwner(){currentOwner=other;service.setOwner(other)}}})
open()
