import type {ProductEntitlementSnapshot} from './access-model-core'
import {appleMembershipProduct} from './apple-membership-products'

export type AppleEnvironment='Production'|'Sandbox'
export type AppleMembership={environment:AppleEnvironment;originalTransactionId:string;transactionId:string;appAccountToken:string;productId:string;expiresAt:number;signedAt:number;status:number;revoked:boolean;upgraded:boolean}
export const appleUuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
export const appleTransactionId=(v:unknown):v is string=>typeof v==='string'&&/^[0-9]{1,32}$/.test(v)
export function appleMembership(value:Record<string,unknown>,environment:AppleEnvironment,token:string,status:number,now=Date.now()):AppleMembership {
 if(value.environment!==environment||value.bundleId!=='com.tenaceiq.app'||typeof value.appAccountToken!=='string'||value.appAccountToken.toLowerCase()!==token.toLowerCase()||!appleUuid(token)||!appleTransactionId(value.originalTransactionId)||!appleTransactionId(value.transactionId)||!appleMembershipProduct(value.productId)||value.type!=='Auto-Renewable Subscription'||value.inAppOwnershipType!=='PURCHASED'||value.storefront!=='USA'||![1,2,3,4,5].includes(status))throw Error('apple_transaction_mismatch')
 const expiresAt=value.expiresDate,signedAt=value.signedDate
 if(typeof expiresAt!=='number'||!Number.isSafeInteger(expiresAt)||expiresAt<=0||typeof signedAt!=='number'||!Number.isSafeInteger(signedAt)||signedAt<=0||signedAt>now+300000||value.revocationDate!==undefined&&(typeof value.revocationDate!=='number'||!Number.isSafeInteger(value.revocationDate)))throw Error('apple_transaction_mismatch')
 return {environment,originalTransactionId:value.originalTransactionId,transactionId:value.transactionId,appAccountToken:token,productId:value.productId as string,expiresAt,signedAt,status,revoked:value.revocationDate!==undefined,upgraded:value.isUpgraded===true}
}
export function mergeAppleAccess(web:ProductEntitlementSnapshot,apple:{playerExpiresAt:string|null;captainExpiresAt:string|null},now=Date.now()):ProductEntitlementSnapshot {
 const result={...web}
 for(const [key,expiry]of [['playerPlus',apple.playerExpiresAt],['captain',apple.captainExpiresAt]] as const){
  if(!expiry||!Number.isFinite(Date.parse(expiry))||Date.parse(expiry)<=now)continue
  const active=key==='playerPlus'?'playerPlusSubscriptionActive':'captainSubscriptionActive',status=key==='playerPlus'?'playerPlusSubscriptionStatus':'captainSubscriptionStatus',until=key==='playerPlus'?'playerPlusAccessExpiresAt':'captainAccessExpiresAt'
  const old=result[until]
  if(result[active]&&(!old||Number.isFinite(Date.parse(old))&&Date.parse(old)>=Date.parse(expiry)))continue
  result[active]=true;result[status]='active';result[until]=expiry
 }
 return result
}
