import {accountClient,accountResponse,readAccountJson} from '@/lib/mobile-account-auth'
import {applePurchaseConfiguration,appleVerifier,APPLE_APP_ID} from '@/lib/apple-purchase-server'
import {appleUuid,type AppleEnvironment} from '@/lib/apple-purchase-contract'
import {appleUnavailable,reconcileApplePurchase} from '@/lib/apple-purchase-api'
export const runtime='nodejs'
export const maxDuration=60
export async function POST(request:Request,{params}:{params:Promise<{environment:string}>}){
 const {environment:route}=await params
 if(route!=='production'&&route!=='sandbox')return accountResponse({ok:false},404)
 const base=applePurchaseConfiguration(),key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
 if(!base||!key)return appleUnavailable()
 const environment:AppleEnvironment=route==='sandbox'?'Sandbox':'Production',body=await readAccountJson(request,32000)
 if(typeof body?.signedPayload!=='string'||body.signedPayload.length>28000)return accountResponse({ok:false},400)
 try{
  const verifier=appleVerifier(environment),payload=await verifier.verifyAndDecodeNotification(body.signedPayload)
  if(payload.version!=='2.0'||!appleUuid(payload.notificationUUID)||payload.data?.environment!==environment||payload.data.bundleId!=='com.tenaceiq.app'||environment==='Production'&&payload.data.appAppleId!==APPLE_APP_ID)return accountResponse({ok:false},400)
  if(payload.notificationType==='TEST'||!payload.data.signedTransactionInfo)return accountResponse({ok:true})
  const transaction=await verifier.verifyAndDecodeTransaction(payload.data.signedTransactionInfo)
  if(!appleUuid(transaction.appAccountToken))return accountResponse({ok:true})
  const service=accountClient(key),ready=await service.rpc('apple_purchase_catalog_ready');if(ready.error||ready.data!==true)return appleUnavailable()
  const account=await service.rpc('apple_purchase_account',{p_owner:null,p_token:transaction.appAccountToken})
  if(account.error)return appleUnavailable()
  if(!account.data)return accountResponse({ok:true}) // Deleted or unbound account: never recreate it from a notification.
  if(!appleUuid(account.data.ownerId)||account.data.accountToken?.toLowerCase()!==transaction.appAccountToken.toLowerCase())return accountResponse({ok:false},400)
  if(environment==='Sandbox'&&account.data.sandboxEnabled!==true)return accountResponse({ok:true})
  return reconcileApplePurchase({owner:account.data.ownerId,service,config:{...base,environment},accountToken:account.data.accountToken,webBlocked:false,activeProductId:null,canPurchase:false},payload.notificationUUID,payload.data.signedTransactionInfo,'notification')
 }catch{return appleUnavailable()}
}
