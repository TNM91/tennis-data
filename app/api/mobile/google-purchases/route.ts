import {accountResponse,readAccountJson} from '@/lib/mobile-account-auth'
import {googlePurchaseContext,googlePublicContext,googleUnavailable,prepareGooglePro,reconcileGooglePro} from '@/lib/google-purchase-api'

export const maxDuration=60
export async function GET(request:Request){
 try{const loaded=await googlePurchaseContext(request);return 'response'in loaded?loaded.response:accountResponse(googlePublicContext(loaded.owner,loaded.context))}catch{return googleUnavailable()}
}
export async function POST(request:Request){
 try{
  const loaded=await googlePurchaseContext(request);if('response'in loaded)return loaded.response
  if(!loaded.context)return accountResponse({ok:false,code:'google_store_unavailable'},503)
  const body=await readAccountJson(request,6000);if(!body)return accountResponse({ok:false,code:'invalid_request'},400)
  if(body.action==='prepare'&&Object.keys(body).length===3)return prepareGooglePro(loaded.context,body.productId,body.targetId)
  if(body.action==='reconcile'&&Object.keys(body).length===4)return reconcileGooglePro(loaded.context,body)
  return accountResponse({ok:false,code:'invalid_request'},400)
 }catch{return googleUnavailable()}
}
