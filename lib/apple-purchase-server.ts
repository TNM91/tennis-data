import 'server-only'
import {createPrivateKey} from 'node:crypto'
import fetch from 'node-fetch'
import {AppStoreServerAPIClient,Environment,SignedDataVerifier,type JWSTransactionDecodedPayload} from '@apple/app-store-server-library'
import {APPLE_TRUST_ROOTS} from './apple-trust-roots'
import {appleMembership,appleUuid,type AppleEnvironment} from './apple-purchase-contract'

export const APPLE_APP_ID=6826324431
export const APPLE_GROUP_ID='22523692'
export function applePurchaseConfiguration(env=process.env){
 if(env.APPLE_MEMBERSHIPS_ENABLED!=='true')return null
 const mode=env.APPLE_PURCHASE_MODE==='sandbox'?'sandbox':env.APPLE_PURCHASE_MODE==='production'?'production':'off'
 const key=env.APPLE_IAP_PRIVATE_KEY?.replace(/\\n/g,'\n').trim(),keyId=env.APPLE_IAP_KEY_ID?.trim(),issuerId=env.APPLE_IAP_ISSUER_ID?.trim()
 if(!key||!keyId||!issuerId||!/^[A-Z0-9]{10}$/.test(keyId)||!appleUuid(issuerId))return null
 try{const parsed=createPrivateKey(key);if(parsed.asymmetricKeyType!=='ec'||parsed.asymmetricKeyDetails?.namedCurve!=='prime256v1')return null}catch{return null}
 return {mode,environment:(mode==='sandbox'?'Sandbox':'Production') as AppleEnvironment,key,keyId,issuerId}
}
export type ApplePurchaseConfiguration=NonNullable<ReturnType<typeof applePurchaseConfiguration>>
class ReadOnlyAppleClient extends AppStoreServerAPIClient {
 constructor(private config:ApplePurchaseConfiguration){super(config.key,config.keyId,config.issuerId,'com.tenaceiq.app',config.environment==='Sandbox'?Environment.SANDBOX:Environment.PRODUCTION)}
 protected override async makeFetchRequest(path:string,query:URLSearchParams,method:string,body:string|Buffer|undefined,headers:Record<string,string>){
  if(method!=='GET'||body||!/^\/inApps\/v1\/subscriptions\/[0-9]{1,32}$/.test(path))throw Error('apple_request_scope')
  const origin=this.config.environment==='Sandbox'?'https://api.storekit-sandbox.apple.com':'https://api.storekit.apple.com'
  return fetch(origin+path+'?'+query,{method:'GET',headers,redirect:'error',timeout:10000,size:262144})
 }
}
const verifiers=new Map<AppleEnvironment,SignedDataVerifier>()
export function appleVerifier(environment:AppleEnvironment){
 let verifier=verifiers.get(environment)
 if(!verifier){verifier=new SignedDataVerifier(APPLE_TRUST_ROOTS.map(root=>Buffer.from(root,'base64')),true,environment==='Sandbox'?Environment.SANDBOX:Environment.PRODUCTION,'com.tenaceiq.app',environment==='Production'?APPLE_APP_ID:undefined);verifiers.set(environment,verifier)}
 return verifier
}
export type AppleVerification={decode:(jws:string)=>Promise<JWSTransactionDecodedPayload>;statuses:(id:string)=>ReturnType<AppStoreServerAPIClient['getAllSubscriptionStatuses']>}
export function appleVerification(config:ApplePurchaseConfiguration):AppleVerification {
 const verifier=appleVerifier(config.environment),client=new ReadOnlyAppleClient(config)
 return {decode:jws=>verifier.verifyAndDecodeTransaction(jws),statuses:id=>client.getAllSubscriptionStatuses(id)}
}
export async function currentAppleMembership(signedTransaction:string,token:string,environment:AppleEnvironment,verification:AppleVerification){
 if(!appleUuid(token)||typeof signedTransaction!=='string'||signedTransaction.length>24000||!/^[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+$/.test(signedTransaction))throw Error('apple_transaction_mismatch')
 const submitted=await verification.decode(signedTransaction)
 // A client transaction is evidence of ownership; current server status decides access.
 const initial=appleMembership(submitted as Record<string,unknown>,environment,token,1)
 if(submitted.subscriptionGroupIdentifier!==APPLE_GROUP_ID)throw Error('apple_transaction_mismatch')
 const status=await verification.statuses(initial.originalTransactionId)
 if(status.environment!==environment||status.bundleId!=='com.tenaceiq.app'||environment==='Production'&&status.appAppleId!==APPLE_APP_ID||!Array.isArray(status.data)||status.data.length>10)throw Error('apple_status_mismatch')
 const matches=status.data.filter(group=>group.subscriptionGroupIdentifier===APPLE_GROUP_ID).flatMap(group=>group.lastTransactions||[]).filter(row=>row.originalTransactionId===initial.originalTransactionId)
 if(matches.length!==1||!matches[0].signedTransactionInfo||!Number.isInteger(matches[0].status))throw Error('apple_status_mismatch')
 const latest=await verification.decode(matches[0].signedTransactionInfo)
 const membership=appleMembership(latest as Record<string,unknown>,environment,token,matches[0].status!)
 if(membership.originalTransactionId!==initial.originalTransactionId||latest.subscriptionGroupIdentifier!==APPLE_GROUP_ID)throw Error('apple_status_mismatch')
 return {membership,acknowledgedTransactionId:initial.transactionId}
}
