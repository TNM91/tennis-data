import {mountAppleMemberships} from '../../mobile/src/apple-memberships'
import {createApplePurchases,type AppleStore} from '../../mobile/src/apple-purchases'
import {AppleProductError} from '../../mobile/src/apple-product-catalog'
import {APPLE_MEMBERSHIP_PRODUCTS} from '../../lib/apple-membership-products'
import type {SupabaseClient} from '@supabase/supabase-js'
const owner='11111111-1111-4111-8111-111111111111',accountToken='33333333-3333-4333-8333-333333333333'
const mode=new URL(location.href).searchParams.get('mode')
const state={active:true,productCalls:0,buyCalls:0,restoreCalls:0,manageCalls:0,pendingCalls:0,prepareCalls:0,reconcileCalls:0,finishCalls:0,releasePurchase:undefined as ((result:string)=>void)|undefined}
Object.assign(window,{membershipFixture:state})
const client={auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:'synthetic-only'}},error:null})}} as unknown as SupabaseClient
const store:AppleStore={
 products:async()=>{state.productCalls++;if(mode==='failed'&&state.productCalls===1)throw new AppleProductError('products_request_failed','NSURLErrorDomain:-1009');const products=APPLE_MEMBERSHIP_PRODUCTS.map((p,i)=>({id:p.productId,price:i?'$4.99':'$1.99'}));return {available:true,products:mode==='partial'?products.slice(0,1):products}},
 pending:async()=>{state.pendingCalls++;if(mode==='history-timeout'&&state.pendingCalls===1)throw {code:'purchase_history_timeout'};return {transactions:[]}},
 purchase:async()=>{state.buyCalls++;if(mode==='native-preparation-error'&&state.buyCalls===1)throw {code:'purchase_preparation_failed',data:{supportCode:'app_receipt/NSURLErrorDomain:-1009',build:'168'},message:'Private Apple account text'};if(mode==='native-confirmation-error'&&state.buyCalls===1)throw {code:'store_unavailable',data:{supportCode:'confirmation/StoreKit.StoreKitError:0/ASDErrorDomain:500',build:'168'},message:'Private Apple account text'};if(mode==='prepare-timeout'&&state.buyCalls===1)throw {code:'purchase_preparation_timeout'};if(mode==='unknown-result'&&state.buyCalls===1)throw {code:'private_error',message:'Private Apple account text'};if(mode==='stalled'&&state.buyCalls===1)return new Promise<Awaited<ReturnType<AppleStore['purchase']>>>(resolve=>{state.releasePurchase=result=>resolve({state:result as 'cancelled'|'pending'})});return {state:'cancelled'}},
 restore:async()=>{state.restoreCalls++;return {transactions:[]}},finish:async()=>{state.finishCalls++;return {finished:true}},manage:async()=>{state.manageCalls++},addListener:async()=>({remove:async()=>{}})
}
const products=APPLE_MEMBERSHIP_PRODUCTS.map(p=>({id:p.productId,name:p.name}))
const http={get:async()=>({status:200,data:{ok:true,applePurchases:1,enabled:true,environment:'Sandbox',canPurchase:true,webAccess:false,activeProductId:null,products},headers:{},url:''}),post:async(options:{data?:unknown})=>{const body=options.data as {action:string;productId:string};if(body.action==='prepare')state.prepareCalls++;else state.reconcileCalls++;return {status:200,data:body.action==='prepare'?{ok:true,applePurchases:1,productId:body.productId,accountToken,environment:'Sandbox'}:{ok:true},headers:{},url:''}}}
const service=createApplePurchases(client,{store,http,available:true,platform:'ios'})
const host=document.querySelector<HTMLElement>('#membership')!,main=document.querySelector('main')!
main.insertAdjacentHTML('afterbegin','<button type="button" data-fixture-close>Close account settings</button><button type="button" data-fixture-reopen hidden>Reopen account settings</button>')
const close=main.querySelector<HTMLButtonElement>('[data-fixture-close]')!,reopen=main.querySelector<HTMLButtonElement>('[data-fixture-reopen]')!
let visit=0
const mount=()=>{const version=++visit;return mountAppleMemberships(host,client,owner,()=>state.active&&version===visit,()=>{},service)}
let panel=mount()
close.onclick=()=>{state.active=false;panel.dispose();host.hidden=true;close.hidden=true;reopen.hidden=false}
reopen.onclick=()=>{state.active=true;host.hidden=false;close.hidden=false;reopen.hidden=true;panel=mount()}
