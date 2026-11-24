import 'server-only'
import {createHash} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
import {accountClient,accountResponse,verifiedAccount} from './mobile-account-auth'
import {appleUuid,mergeAppleAccess} from './apple-purchase-contract'
import {DEFAULT_ENTITLEMENTS,buildProductAccessState} from './access-model-core'
import {normalizeUserRole} from './roles'
import {normalizeSubscriptionStatus} from './subscription-status'
import {GOOGLE_PLAY_PRODUCTS,googleBinding,googlePurchaseToken} from './google-play-products'
import {googlePlayConfiguration,googlePurchaseReader,type GooglePlayConfiguration} from './google-play-server'
import {googleProSettlement,type GoogleSavedProPermit} from './google-pro-settlement'
import type {GooglePurchaseExpectation,VerifiedGooglePurchase} from './google-play-verification'

const pro=GOOGLE_PLAY_PRODUCTS[0]
export type GooglePurchaseContext={owner:string;service:SupabaseClient;config:GooglePlayConfiguration;accountId:string;canPurchase:boolean;otherAccess:boolean;active:boolean;manageRequired:boolean}
export const googleUnavailable=()=>accountResponse({ok:false,code:'google_unavailable'},503)
export async function googlePurchaseContext(request:Request):Promise<{response:Response}|{owner:string;context:GooglePurchaseContext|null}>{
 const identity=await verifiedAccount(request)
 if(!identity)return {response:accountResponse({ok:false,code:'sign_in_required'},401)}
 const owner=identity.user.id,config=googlePlayConfiguration(),key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
 if(!config||config.mode!=='test'||process.env.GOOGLE_PLAY_FULFILLMENT_ENABLED!=='true'||process.env.GOOGLE_PLAY_ENTITLEMENTS_ENABLED!=='true'||!key)return {owner,context:null}
 const service=accountClient(key),ready=await service.rpc('google_purchase_catalog_ready')
 if(ready.error||ready.data!==true)return {response:googleUnavailable()}
 const [account,access,apple,profile]=await Promise.all([
  service.rpc('google_purchase_account',{p_owner:owner}),service.rpc('google_purchase_access',{p_owner:owner}),service.rpc('apple_purchase_access',{p_owner:owner}),
  service.from('profiles').select('role,stripe_subscription_id,player_plus_subscription_active,player_plus_subscription_status,player_plus_access_expires_at,coach_subscription_active,coach_subscription_status,coach_access_expires_at,captain_subscription_active,captain_subscription_status,captain_access_expires_at').eq('id',owner).maybeSingle(),
 ])
 if(account.error||access.error||apple.error||profile.error||!profile.data||access.data?.ownerId!==owner||typeof access.data.purchaseBlocked!=='boolean'||apple.data?.ownerId!==owner)return {response:googleUnavailable()}
 if(!account.data)return {owner,context:null}
 if(account.data.ownerId!==owner||!googleBinding(account.data.accountId)||typeof account.data.testEnabled!=='boolean')return {response:googleUnavailable()}
 if(!account.data.testEnabled)return {owner,context:null}
 const row=profile.data,web={...DEFAULT_ENTITLEMENTS,
  playerPlusSubscriptionActive:row.player_plus_subscription_active===true,playerPlusSubscriptionStatus:normalizeSubscriptionStatus(row.player_plus_subscription_status),playerPlusAccessExpiresAt:row.player_plus_access_expires_at,
  coachSubscriptionActive:row.coach_subscription_active===true,coachSubscriptionStatus:normalizeSubscriptionStatus(row.coach_subscription_status),coachAccessExpiresAt:row.coach_access_expires_at,
  captainSubscriptionActive:row.captain_subscription_active===true,captainSubscriptionStatus:normalizeSubscriptionStatus(row.captain_subscription_status),captainAccessExpiresAt:row.captain_access_expires_at}
 for(const data of [apple.data,access.data])for(const name of data===access.data?['proExpiresAt']:['playerExpiresAt','captainExpiresAt','proExpiresAt'])if(data[name]!=null&&(typeof data[name]!=='string'||!Number.isFinite(Date.parse(data[name]))))return {response:googleUnavailable()}
 const existing=buildProductAccessState(normalizeUserRole(row.role),mergeAppleAccess(web,apple.data))
 const otherAccess=existing.canUseCaptainWorkflow||existing.canUseCoachWorkflow||!!row.stripe_subscription_id&&[row.coach_subscription_status,row.captain_subscription_status].some(status=>['active','trial','trialing','past_due'].includes(String(status)))
 const active=!!access.data.proExpiresAt&&Date.parse(access.data.proExpiresAt)>Date.now()
 return {owner,context:{owner,service,config,accountId:account.data.accountId,canPurchase:!active&&!otherAccess&&!access.data.purchaseBlocked,otherAccess,active,manageRequired:access.data.purchaseBlocked&&!active}}
}
export function googlePublicContext(owner:string,ctx:GooglePurchaseContext|null){
 return ctx?{ok:true,googlePurchases:1,ownerId:owner,enabled:true,environment:'Test',accountId:ctx.accountId,canPurchase:ctx.canPurchase,otherAccess:ctx.otherAccess,active:ctx.active,manageRequired:ctx.manageRequired,products:[{id:pro.id,name:pro.name}]}:{ok:true,googlePurchases:1,ownerId:owner,enabled:false}
}
export async function prepareGooglePro(ctx:GooglePurchaseContext,productId:unknown,targetId:unknown){
 if(productId!==pro.id||targetId!==null)return accountResponse({ok:false,code:'google_products_unavailable'},400)
 if(!ctx.canPurchase)return accountResponse({ok:false,code:'google_existing_access'},409)
 const result=await ctx.service.rpc('google_purchase_prepare',{p_owner:ctx.owner}),r=result.data
 if(result.error)return googleUnavailable()
 if(r?.ok!==true)return accountResponse({ok:false,code:r?.status===409?'google_existing_access':'google_unavailable'},r?.status===409?409:503)
 if(r.productId!==pro.id||r.targetId!==null||r.profileId!==null||r.accountId!==ctx.accountId)return googleUnavailable()
 return accountResponse({ok:true,googlePurchases:1,ownerId:ctx.owner,productId:pro.id,targetId:null,accountId:ctx.accountId,profileId:null})
}
type Delivery={verify:(expected:GooglePurchaseExpectation)=>Promise<VerifiedGooglePurchase>;acknowledge:(token:string,permit:GoogleSavedProPermit)=>Promise<void>}
export async function reconcileGooglePro(ctx:GooglePurchaseContext,body:Record<string,unknown>,delivery:Delivery={verify:googlePurchaseReader(ctx.config).verify,acknowledge:googleProSettlement(ctx.config).acknowledge}){
 const token=body.purchaseToken,operation=body.operationId
 if(body.productId!==pro.id||!googlePurchaseToken(token)||!appleUuid(operation))return accountResponse({ok:false,code:'invalid_request'},400)
 const digest=createHash('sha256').update(token).digest('hex'),fingerprint=createHash('sha256').update(pro.id+':'+digest).digest('hex')
 const claimed=await ctx.service.rpc('google_purchase_claim',{p_owner:ctx.owner,p_operation:operation,p_fingerprint:fingerprint,p_token_hash:digest})
 if(claimed.error)return googleUnavailable()
 if(claimed.data?.ok!==true){const status=[403,409,429].includes(claimed.data?.status)?claimed.data.status:503;return accountResponse({ok:false,code:status===429?'try_later':'google_purchase_sync_pending'},status,status===429?{'Retry-After':'900'}:{})}
 const lease=claimed.data.lease
 if(!appleUuid(lease)||claimed.data.tokenHash!==digest)return googleUnavailable()
 try{
  const canonical=await delivery.verify({productId:pro.id,purchaseToken:token,accountId:ctx.accountId,profileId:null,allowTest:true})
  if(canonical.environment!=='Test'||canonical.productId!==pro.id||canonical.tokenHash!==digest||canonical.accountId!==ctx.accountId||canonical.profileId!==null||canonical.kind!=='pro')throw Error('google_purchase_mismatch')
  const saved=await ctx.service.rpc('google_purchase_save',{p_owner:ctx.owner,p_operation:operation,p_lease:lease,p_evidence:canonical}),r=saved.data
  if(saved.error||r?.ok!==true||r.saved!==true||r.ownerId!==ctx.owner||r.lease!==lease||!receiptMatches(r.receipt,ctx,digest))throw Error('google_purchase_sync_pending')
  let acknowledged=canonical.acknowledged||r.receipt.acknowledged===true
  if(r.receipt.active&&!acknowledged){await delivery.acknowledge(token,{saved:true,active:true,environment:'Test',productId:pro.id,tokenHash:digest,accountId:ctx.accountId,lease});acknowledged=true}
  const settled=await ctx.service.rpc('google_purchase_settle',{p_owner:ctx.owner,p_operation:operation,p_lease:lease,p_acknowledged:acknowledged})
  if(settled.error||settled.data?.ok!==true||!receiptMatches(settled.data.receipt,ctx,digest)||settled.data.receipt.settled!==true)throw Error('google_purchase_sync_pending')
  const result=settled.data.receipt
  return accountResponse({ok:true,googlePurchases:1,ownerId:ctx.owner,receipt:{productId:pro.id,tokenHash:digest,accountId:ctx.accountId,profileId:null,delivered:true,settled:true,active:result.active,acknowledged:result.acknowledged===true}})
 }catch(error){
  if(error instanceof Error&&['google_purchase_mismatch','google_test_purchase'].includes(error.message))return accountResponse({ok:false,code:'google_account_mismatch'},409)
  if(error instanceof Error&&error.message==='google_purchase_pending')return accountResponse({ok:false,code:'google_purchase_pending'},409)
  return googleUnavailable()
 }finally{await ctx.service.rpc('google_purchase_release',{p_owner:ctx.owner,p_operation:operation,p_lease:lease}).then(()=>{},()=>{})}
}
function receiptMatches(value:unknown,ctx:GooglePurchaseContext,digest:string):value is {settled:boolean;acknowledged?:boolean;active:boolean}{
 if(!value||typeof value!=='object')return false
 const r=value as Record<string,unknown>
 return r.delivered===true&&r.productId===pro.id&&r.tokenHash===digest&&r.accountId===ctx.accountId&&r.profileId===null&&typeof r.settled==='boolean'&&typeof r.active==='boolean'
}
