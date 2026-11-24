import 'server-only'
import {createHash} from 'node:crypto'
import {GOOGLE_PLAY_PACKAGE,GOOGLE_PLAY_PRODUCTS,googleBinding,googlePurchaseToken} from './google-play-products'
import {googlePublisherAuthorization,type GooglePlayConfiguration} from './google-play-server'
import {appleUuid} from './apple-purchase-contract'

export type GoogleSavedProPermit={saved:true;productId:string;tokenHash:string;accountId:string;environment:'Test';lease:string;active:true}
// Only an already saved, account-bound Pro grant can enter this narrow write path.
// Production acknowledgement is intentionally unavailable until notification/revocation rollout.
export function googleProSettlement(config:GooglePlayConfiguration,send:typeof fetch=fetch){
 return {async acknowledge(token:string,permit:GoogleSavedProPermit){
  if(config.mode!=='test'||!googlePurchaseToken(token)||permit?.saved!==true||permit.productId!==GOOGLE_PLAY_PRODUCTS[0].id||permit.environment!=='Test'||permit.active!==true||!googleBinding(permit.accountId)||!googleBinding(permit.tokenHash)||!appleUuid(permit.lease)||createHash('sha256').update(token).digest('hex')!==permit.tokenHash)throw Error('google_settlement_unavailable')
  try{
   const authorization=await googlePublisherAuthorization(config,send)
   const url=`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${GOOGLE_PLAY_PACKAGE}/purchases/subscriptions/${GOOGLE_PLAY_PRODUCTS[0].id}/tokens/${encodeURIComponent(token)}:acknowledge`
   const result=await send(url,{method:'POST',cache:'no-store',headers:{Authorization:authorization,'Content-Type':'application/json'},body:'{}',redirect:'error',signal:AbortSignal.timeout(10000)})
   if(result.status!==200&&result.status!==204)throw Error()
  }catch{throw Error('google_settlement_unavailable')}
 }}
}
