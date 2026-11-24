import 'server-only'
import type {SupabaseClient} from '@supabase/supabase-js'
import {accountResponse,readAccountJson} from './mobile-account-auth'
import {appleUuid} from './apple-purchase-contract'
import {GOOGLE_PLAY_PRODUCTS,googleBinding} from './google-play-products'
import {googleProNotificationPurchase,type GooglePlayConfiguration} from './google-play-server'
import {authenticateGoogleNotification,GoogleNotificationAuthError,type GoogleNotificationConfiguration} from './google-notification-auth'
import {googleNotificationEnvelope} from './google-notification-envelope'
import {reconcileGooglePro,type GooglePurchaseContext} from './google-purchase-api'

type Dependencies={
 configuration:GoogleNotificationConfiguration;play:GooglePlayConfiguration;service:()=>SupabaseClient
 authenticate?:typeof authenticateGoogleNotification
 discover?:typeof googleProNotificationPurchase
 reconcile?:typeof reconcileGooglePro
}
const unavailable=()=>accountResponse({ok:false,code:'google_notification_unavailable'},503,{'Retry-After':'60'})
// Notification types only trigger a canonical read; they never directly grant or
// revoke access. In particular an old refunded renewal must not cancel a later one.
export async function handleGoogleNotification(request:Request,deps:Dependencies){
 try{await (deps.authenticate??authenticateGoogleNotification)(request.headers.get('authorization'),deps.configuration)}
 catch(error){return error instanceof GoogleNotificationAuthError?accountResponse({ok:false},401):unavailable()}
 const event=googleNotificationEnvelope(await readAccountJson(request,24000),deps.configuration.subscription)
 if(!event)return accountResponse({ok:false},400)
 if(event.kind!=='pro')return accountResponse({ok:true})
 if(deps.play.mode!=='test')return unavailable()
 const service=deps.service()
 const key={p_message_hash:event.messageHash,p_fingerprint:event.fingerprint,p_token_hash:event.tokenHash}
 let lease:string|null=null
 try{
  const ready=await service.rpc('google_notification_catalog_ready')
  if(ready.error||ready.data!==true)return unavailable()
  const lookup=await service.rpc('google_notification_lookup',key),found=lookup.data
  if(lookup.error||found?.ok!==true)return unavailable()
  if(found.state==='done'||found.state==='ignored')return accountResponse({ok:true})
  if(found.state!=='lookup')return unavailable()
  let accountId:unknown=found.accountId
  if(accountId===null){accountId=(await (deps.discover??googleProNotificationPurchase)(deps.play,event.purchaseToken)).accountId}
  if(!googleBinding(accountId))return unavailable()
  const claimed=await service.rpc('google_notification_claim',{...key,p_account_id:accountId}),claim=claimed.data
  if(claimed.error||claim?.ok!==true)return unavailable()
  if(claim.state==='ignored'||claim.state==='done')return accountResponse({ok:true})
  if(claim.state!=='ready'||!appleUuid(claim.ownerId)||claim.accountId!==accountId||!appleUuid(claim.lease)||!appleUuid(claim.operationId))return unavailable()
  lease=claim.lease
  const ctx:GooglePurchaseContext={owner:claim.ownerId,accountId,service,config:deps.play,canPurchase:false,otherAccess:false,active:false,manageRequired:false}
  // Reverification occurs inside the shared purchase lease, after any discovery
  // read. This prevents stale notification snapshots overwriting a newer result.
  const result=await (deps.reconcile??reconcileGooglePro)(ctx,{productId:GOOGLE_PLAY_PRODUCTS[0].id,purchaseToken:event.purchaseToken,operationId:claim.operationId})
  if(result.status!==200)return unavailable()
  const completed=await service.rpc('google_notification_complete',{...key,p_lease:lease})
  return !completed.error&&completed.data===true?accountResponse({ok:true}):unavailable()
 }catch{return unavailable()}
 finally{
  if(lease)await service.rpc('google_notification_release',{p_message_hash:event.messageHash,p_lease:lease}).then(()=>{},()=>{})
 }
}
