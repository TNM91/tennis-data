import {APPLE_PRO_PRODUCT} from './apple-membership-products'
import {FIRST_PARTY_COMPETITION_FEES} from './first-party-competition-prices'

export const GOOGLE_PLAY_PACKAGE='com.tenaceiq.app'
export const GOOGLE_SUBSCRIPTION_STATES=['SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_IN_GRACE_PERIOD','SUBSCRIPTION_STATE_CANCELED','SUBSCRIPTION_STATE_EXPIRED','SUBSCRIPTION_STATE_ON_HOLD','SUBSCRIPTION_STATE_PAUSED','SUBSCRIPTION_STATE_PENDING','SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED'] as const
export type GoogleSubscriptionState=typeof GOOGLE_SUBSCRIPTION_STATES[number]
// Reuse the approved commercial terms. Google products/offers must be configured separately.
export const GOOGLE_PLAY_PRODUCTS=[
 {kind:'pro',id:APPLE_PRO_PRODUCT.productId,type:'subs',name:APPLE_PRO_PRODUCT.name,amountCents:APPLE_PRO_PRODUCT.expectedUSPriceCents,basePlanId:'monthly',purchaseOptionId:null},
 {kind:'tournament',id:FIRST_PARTY_COMPETITION_FEES.tournament.productId,type:'inapp',name:'Publish tournament',amountCents:FIRST_PARTY_COMPETITION_FEES.tournament.amountCents,basePlanId:null,purchaseOptionId:'standard'},
 {kind:'league',id:FIRST_PARTY_COMPETITION_FEES.league.productId,type:'inapp',name:'Publish league',amountCents:FIRST_PARTY_COMPETITION_FEES.league.amountCents,basePlanId:null,purchaseOptionId:'standard'},
] as const
export type GooglePlayProduct=typeof GOOGLE_PLAY_PRODUCTS[number]
export const googlePlayProduct=(id:unknown)=>GOOGLE_PLAY_PRODUCTS.find(product=>product.id===id)??null
export const googleBinding=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value)
export const googlePurchaseToken=(value:unknown):value is string=>typeof value==='string'&&/^[\x21-\x7e]{16,4096}$/.test(value)
export type GooglePlayTransaction={productId:string;purchaseToken:string;accountId:string;profileId:string|null;state:'purchased'|'pending';acknowledged:boolean;suspended:boolean;quantity:1}
export function googleTransaction(value:unknown):value is GooglePlayTransaction {
 if(!value||typeof value!=='object')return false
 const r=value as GooglePlayTransaction,product=googlePlayProduct(r.productId)
 return !!product&&googlePurchaseToken(r.purchaseToken)&&googleBinding(r.accountId)&&
  (product.kind==='pro'?r.profileId===null:googleBinding(r.profileId))&&['purchased','pending'].includes(r.state)&&typeof r.acknowledged==='boolean'&&typeof r.suspended==='boolean'&&r.quantity===1
}
