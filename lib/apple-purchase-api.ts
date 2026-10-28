import 'server-only'
import {createHash} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
import {accountClient,accountResponse,verifiedAccount} from './mobile-account-auth'
import {APPLE_MEMBERSHIP_PRODUCTS,appleMembershipProduct} from './apple-membership-products'
import {DEFAULT_ENTITLEMENTS,buildProductAccessState} from './access-model-core'
import {normalizeSubscriptionStatus} from './subscription-status'
import {normalizeUserRole} from './roles'
import {appleUuid,appleTransactionId,type AppleEnvironment} from './apple-purchase-contract'
import {applePurchaseConfiguration,appleVerification,currentAppleMembership,type ApplePurchaseConfiguration} from './apple-purchase-server'
export type ApplePurchaseContext={owner:string;service:SupabaseClient;config:ApplePurchaseConfiguration;accountToken:string|null;webBlocked:boolean;activeProductId:string|null;canPurchase:boolean}
export const appleUnavailable=()=>accountResponse({ok:false,code:'apple_unavailable',message:'Apple membership is temporarily unavailable. Your purchase can be synced later.'},503)
export async function applePurchaseContext(request:Request):Promise<{response:Response}|{context:ApplePurchaseContext|null}>{
 const identity=await verifiedAccount(request)
 if(!identity)return {response:accountResponse({ok:false,code:'sign_in_required'},401)}
 const base=applePurchaseConfiguration(),key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
 if(!base||!key)return {context:null}
 const service=accountClient(key),ready=await service.rpc('apple_purchase_catalog_ready')
 if(ready.error||ready.data!==true)return {response:appleUnavailable()}
 const [profile,account,access]=await Promise.all([
  service.from('profiles').select('role,stripe_subscription_id,player_plus_subscription_active,player_plus_subscription_status,player_plus_access_expires_at,coach_subscription_active,coach_subscription_status,coach_access_expires_at,captain_subscription_active,captain_subscription_status,captain_access_expires_at,tiq_team_league_entry_enabled,tiq_individual_league_creator_enabled,league_access_expires_at').eq('id',identity.user.id).maybeSingle(),
  service.rpc('apple_purchase_account',{p_owner:identity.user.id}),service.rpc('apple_purchase_access',{p_owner:identity.user.id})
 ])
 if(profile.error||!profile.data||account.error||access.error||!access.data||access.data.ownerId!==identity.user.id||account.data&&account.data.ownerId!==identity.user.id)return {response:appleUnavailable()}
 if(base.mode==='sandbox'&&account.data?.sandboxEnabled!==true)return {context:null}
 const config={...base,environment:(account.data?.sandboxEnabled===true?'Sandbox':'Production') as AppleEnvironment}
 const row=profile.data,web={...DEFAULT_ENTITLEMENTS,playerPlusSubscriptionActive:row.player_plus_subscription_active===true,playerPlusSubscriptionStatus:normalizeSubscriptionStatus(row.player_plus_subscription_status),playerPlusAccessExpiresAt:row.player_plus_access_expires_at,coachSubscriptionActive:row.coach_subscription_active===true,coachSubscriptionStatus:normalizeSubscriptionStatus(row.coach_subscription_status),coachAccessExpiresAt:row.coach_access_expires_at,captainSubscriptionActive:row.captain_subscription_active===true,captainSubscriptionStatus:normalizeSubscriptionStatus(row.captain_subscription_status),captainAccessExpiresAt:row.captain_access_expires_at,tiqTeamLeagueEntryEnabled:row.tiq_team_league_entry_enabled===true,tiqIndividualLeagueCreatorEnabled:row.tiq_individual_league_creator_enabled===true,leagueAccessExpiresAt:row.league_access_expires_at}
 const known=buildProductAccessState(normalizeUserRole(row.role),web)
 const unresolvedWeb=!!row.stripe_subscription_id&&[row.player_plus_subscription_status,row.coach_subscription_status,row.captain_subscription_status].some(v=>['active','trial','trialing','past_due'].includes(String(v)))
 const webBlocked=known.canUseAdvancedPlayerInsights||known.canUseLeagueTools||unresolvedWeb
 const activeProductId=access.data.captainExpiresAt?'com.tenaceiq.app.captain.monthly':access.data.playerExpiresAt?'com.tenaceiq.app.player.monthly':null
 return {context:{owner:identity.user.id,service,config,accountToken:account.data?.accountToken||null,webBlocked,activeProductId,canPurchase:base.mode!=='off'&&!webBlocked&&!activeProductId}}
}
export function applePurchasePublicContext(ctx:ApplePurchaseContext|null){return ctx?{ok:true,applePurchases:1,enabled:true,environment:ctx.config.environment,canPurchase:ctx.canPurchase,webAccess:ctx.webBlocked,activeProductId:ctx.activeProductId,products:APPLE_MEMBERSHIP_PRODUCTS.map(p=>({id:p.productId,name:p.name}))}:{ok:true,applePurchases:1,enabled:false}}
export async function prepareApplePurchase(ctx:ApplePurchaseContext,productId:unknown){
 if(!appleMembershipProduct(productId))return accountResponse({ok:false,code:'invalid_product'},400)
 if(!ctx.canPurchase)return accountResponse({ok:false,code:'existing_access',message:'Manage your current membership before starting another subscription.'},409)
 const result=await ctx.service.rpc('apple_purchase_account',{p_owner:ctx.owner,p_create:true})
 if(result.error||result.data?.ownerId!==ctx.owner||!appleUuid(result.data?.accountToken)||ctx.config.environment==='Sandbox'&&result.data.sandboxEnabled!==true)return appleUnavailable()
 return accountResponse({ok:true,applePurchases:1,accountToken:result.data.accountToken,environment:ctx.config.environment,productId})
}
export async function reconcileApplePurchase(ctx:ApplePurchaseContext,operationId:unknown,signedTransaction:unknown,kind:'client'|'notification'='client'){
 if(!appleUuid(operationId)||!ctx.accountToken||typeof signedTransaction!=='string'||signedTransaction.length>24000)return accountResponse({ok:false,code:'invalid_transaction'},400)
 const fingerprint=createHash('sha256').update(signedTransaction).digest('hex')
 const claimed=await ctx.service.rpc('apple_purchase_claim',{p_owner:ctx.owner,p_operation:operationId,p_fingerprint:fingerprint,p_kind:kind})
 if(claimed.error)return appleUnavailable()
 if(claimed.data?.ok!==true){const status=[403,409,429].includes(claimed.data?.status)?claimed.data.status:503;return accountResponse({ok:false,code:status===429?'try_later':'purchase_sync_pending'},status,status===429?{'Retry-After':'900'}:{})}
 const receipt=claimed.data.receipt
 if(receipt){if(!appleTransactionId(receipt.transactionId)||receipt.accountToken!==ctx.accountToken||receipt.environment!==ctx.config.environment)return appleUnavailable();return accountResponse({ok:true,applePurchases:1,receipt})}
 if(!appleUuid(claimed.data.lease))return appleUnavailable()
 try{
  const canonical=await currentAppleMembership(signedTransaction,ctx.accountToken,ctx.config.environment,appleVerification(ctx.config))
  const result=await ctx.service.rpc('apple_purchase_commit',{p_owner:ctx.owner,p_operation:operationId,p_lease:claimed.data.lease,p_membership:canonical.membership,p_acknowledged:canonical.acknowledgedTransactionId})
  if(result.error||result.data?.ok!==true||result.data.receipt?.transactionId!==canonical.acknowledgedTransactionId||result.data.receipt?.accountToken!==ctx.accountToken||result.data.receipt?.environment!==ctx.config.environment)return appleUnavailable()
  return accountResponse({ok:true,applePurchases:1,receipt:result.data.receipt})
 }catch(error){
  if(error instanceof Error&&['apple_transaction_mismatch','apple_status_mismatch'].includes(error.message))return accountResponse({ok:false,code:'purchase_account_mismatch',message:'Use the TenAceIQ account that originally bought this membership.'},409)
  return appleUnavailable()
 }
}
