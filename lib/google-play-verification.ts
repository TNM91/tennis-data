import 'server-only'
import {createHash,createHmac} from 'node:crypto'
import {GOOGLE_SUBSCRIPTION_STATES,googleBinding,googlePlayProduct,googlePurchaseToken,type GooglePlayProduct,type GoogleSubscriptionState} from './google-play-products'

export class GooglePurchaseVerificationError extends Error {
 constructor(code:'google_purchase_mismatch'|'google_purchase_pending'|'google_test_purchase'){super(code)}
}
const mismatch=():never=>{throw new GooglePurchaseVerificationError('google_purchase_mismatch')}
const object=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:mismatch()
const instant=(value:unknown)=>{
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)$/.test(value))return mismatch()
 const parsed=Date.parse(value);if(!Number.isFinite(parsed)||parsed<=0)return mismatch();return parsed
}
const timestamp=(value:unknown,now:number)=>{
 const parsed=instant(value);if(parsed>now+300000)return mismatch();return parsed
}
const uuid=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
export function googleAccountBinding(owner:string,secret:string){
 if(!uuid(owner)||Buffer.byteLength(secret)<32)throw Error('google_account_binding_unavailable')
 return createHmac('sha256',secret).update('tenaceiq:google:account:v1:'+owner.toLowerCase()).digest('hex')
}
export function googleEventBinding(owner:string,kind:'league'|'tournament',target:string,attempt:string,secret:string){
 if(!uuid(owner)||!uuid(target)||!uuid(attempt)||!['league','tournament'].includes(kind)||Buffer.byteLength(secret)<32)throw Error('google_event_binding_unavailable')
 return createHmac('sha256',secret).update(['tenaceiq:google:event:v1',owner.toLowerCase(),kind,target.toLowerCase(),attempt.toLowerCase()].join(':')).digest('hex')
}
export type GooglePurchaseExpectation={productId:string;purchaseToken:string;accountId:string;profileId:string|null;allowTest:boolean}
export type VerifiedGooglePurchase={productId:string;kind:GooglePlayProduct['kind'];tokenHash:string;accountId:string;profileId:string|null;environment:'Test'|'Production';subscriptionState:GoogleSubscriptionState|null;active:boolean;acknowledged:boolean;consumed:boolean;expiresAt:number|null;purchasedAt:number;linkedTokenHash:string|null}
export function verifiedGooglePurchase(value:unknown,expected:GooglePurchaseExpectation,now=Date.now()):VerifiedGooglePurchase {
 const product=googlePlayProduct(expected.productId),data=object(value)
 if(!product||!googlePurchaseToken(expected.purchaseToken)||!googleBinding(expected.accountId)||(product.kind==='pro'?expected.profileId!==null:!googleBinding(expected.profileId))||data.regionCode!=='US')return mismatch()
 const subscription=product.type==='subs',testField=subscription?'testPurchase':'testPurchaseContext'
 const test=data[testField]!==undefined
 if(test){const details=object(data[testField]);if(!subscription&&details.fopType!=='TEST')return mismatch();if(!expected.allowTest)throw new GooglePurchaseVerificationError('google_test_purchase')}
 const identifiers=subscription?object(data.externalAccountIdentifiers):data
 if(identifiers.obfuscatedExternalAccountId!==expected.accountId||(identifiers.obfuscatedExternalProfileId??null)!==expected.profileId)return mismatch()
 const acknowledged=data.acknowledgementState==='ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'
 if(!acknowledged&&data.acknowledgementState!=='ACKNOWLEDGEMENT_STATE_PENDING')return mismatch()
 let active=false,expiresAt:number|null=null,consumed=false,purchasedAt:number,linkedTokenHash:string|null=null,subscriptionState:GoogleSubscriptionState|null=null
 if(subscription){
  if(!Array.isArray(data.lineItems)||data.lineItems.length!==1)return mismatch()
  const line=object(data.lineItems[0]),offer=object(line.offerDetails),plan=object(line.autoRenewingPlan)
  if(line.productId!==product.id||offer.basePlanId!==product.basePlanId||offer.offerId!==undefined||typeof plan.autoRenewEnabled!=='boolean'||line.prepaidPlan!==undefined)return mismatch()
  if(!GOOGLE_SUBSCRIPTION_STATES.some(state=>state===data.subscriptionState))return mismatch()
  subscriptionState=data.subscriptionState as GoogleSubscriptionState
  if(data.subscriptionState==='SUBSCRIPTION_STATE_PENDING')throw new GooglePurchaseVerificationError('google_purchase_pending')
  purchasedAt=timestamp(data.startTime,now)
  expiresAt=instant(line.expiryTime);if(expiresAt<purchasedAt)return mismatch()
  active=expiresAt>now&&['SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_IN_GRACE_PERIOD','SUBSCRIPTION_STATE_CANCELED'].includes(String(data.subscriptionState))
  if(data.linkedPurchaseToken!==undefined){if(!googlePurchaseToken(data.linkedPurchaseToken)||data.linkedPurchaseToken===expected.purchaseToken)return mismatch();linkedTokenHash=createHash('sha256').update(data.linkedPurchaseToken).digest('hex')}
 }else{
  const state=object(data.purchaseStateContext).purchaseState
  if(state==='PENDING')throw new GooglePurchaseVerificationError('google_purchase_pending')
  if(!['PURCHASED','CANCELLED'].includes(String(state))||!Array.isArray(data.productLineItem)||data.productLineItem.length!==1)return mismatch()
  const line=object(data.productLineItem[0]),offer=object(line.productOfferDetails)
  if(line.productId!==product.id||offer.purchaseOptionId!==product.purchaseOptionId||offer.offerId!==undefined||offer.rentOfferDetails!==undefined||offer.preorderOfferDetails!==undefined||offer.quantity!==1||![0,1].includes(Number(offer.refundableQuantity))||typeof offer.refundableQuantity!=='number')return mismatch()
  if(!['CONSUMPTION_STATE_YET_TO_BE_CONSUMED','CONSUMPTION_STATE_CONSUMED'].includes(String(offer.consumptionState)))return mismatch()
  consumed=offer.consumptionState==='CONSUMPTION_STATE_CONSUMED'
  purchasedAt=timestamp(data.purchaseCompletionTime,now)
  active=state==='PURCHASED'&&offer.refundableQuantity===1
 }
 return {productId:product.id,kind:product.kind,tokenHash:createHash('sha256').update(expected.purchaseToken).digest('hex'),accountId:expected.accountId,profileId:expected.profileId,environment:test?'Test':'Production',subscriptionState,active,acknowledged,consumed,expiresAt,purchasedAt,linkedTokenHash}
}
